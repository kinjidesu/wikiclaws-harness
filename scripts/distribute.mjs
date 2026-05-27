#!/usr/bin/env node
/**
 * distribute.mjs — turn a verified node into on-policy distribution. The ONLY auto path is Moltbook
 * (agent-native, on-policy); everything off-Moltbook (Reddit/X/HARO/PR) is AI-DRAFTED → written to a
 * HUMAN-APPROVAL queue → disclosed → a human posts it. Every draft is run through policy-guard.mjs
 * (the white-hat critic) and ABORTS on any violation — belt-and-suspenders with the PreToolUse hook.
 * Optimizes for trustworthy MENTIONS of WikiClaws as a source, not link-spam.
 *
 *   node scripts/distribute.mjs draft  --node <id> --platform moltbook|reddit|x|haro|pr [--target <s>] [--out <f>]
 *   node scripts/distribute.mjs moltbook-post --node <id> [--draft <f>] [--eval-passed] [--citability-passed]
 *   node scripts/distribute.mjs queue  --node <id> --platform reddit|x|haro|pr --draft <f> [--eval-passed] [--citability-passed]
 *   node scripts/distribute.mjs list   [--status pending-approval|approved|posted|ready-moltbook|rejected]
 *   node scripts/distribute.mjs approve --id <rowId> --by <name>
 *   node scripts/distribute.mjs reject  --id <rowId> [--reason <s>]
 *   node scripts/distribute.mjs mark-posted --id <rowId> --url <postUrl>
 *
 * Env: MOLTBOOK_API_KEY, MOLTBOOK_BASE (default https://www.moltbook.com/api/v1 — keep the www.),
 *      WIKICLAWS_DISCLOSURE, WIKICLAWS_VIEWER. Node reads are public (no WikiClaws key needed).
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const VIEWER = process.env.WIKICLAWS_VIEWER || BASE.replace("-backend", "");
const DISCLOSURE = process.env.WIKICLAWS_DISCLOSURE || "🤖 Posted by an AI agent on behalf of WikiClaws.";
const POLICY_GUARD = fileURLToPath(new URL("./policy-guard.mjs", import.meta.url));
const DRAFTS = fileURLToPath(new URL("../drafts", import.meta.url));
const QUEUE = fileURLToPath(new URL("../memory/distribution-queue.md", import.meta.url));
const today = () => new Date().toISOString().slice(0, 10);
const cell = s => String(s ?? "—").replace(/\|/g, "/").replace(/\n/g, " ").trim() || "—";
const QCOLS = ["id", "date", "node", "platform", "status", "guard", "draft", "approvedBy", "postedUrl", "outcome"];
const QUEUE_HEADER = `# Distribution queue — on-policy posting + the human-approval gate\n\nWritten by \`scripts/distribute.mjs\`. Moltbook auto-posts (status \`posted\`/\`ready-moltbook\`); off-Moltbook is \`pending-approval\` → a human \`approve\`s → posts → \`mark-posted\`. Off-Moltbook rows can NEVER be \`posted\` without an \`approved by\`. policy-guard must pass first.\n\n| id | date | node | platform | status | policy-guard | draft ref | approved by | posted url | outcome |\n|---|---|---|---|---|---|---|---|---|---|\n`;

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    else a._.push(argv[i]);
  }
  return a;
}
async function getNode(id) {
  const r = await fetch(`${BASE}/v1/nodes/${id}`); // public read
  if (!r.ok) throw new Error(`GET /v1/nodes/${id} -> ${r.status}`);
  return r.json();
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
function summarize(node, max) {
  const m = node.metadata || {};
  if (m.abstract) return trunc(m.abstract.trim(), max);
  const body = node.latestVersion?.content?.body || node.content?.body || "";
  const tldr = body.match(/#{1,3}\s*TL;?DR[\s\S]*?\n([\s\S]*?)(\n#{1,3}\s|\n*$)/i)?.[1] || "";
  const text = (tldr || body).replace(/^#.*$/gm, "").replace(/\[\[?\d+\]?\]\([^)]*\)/g, "").replace(/[*_>`-]/g, " ").replace(/\s+/g, " ").trim();
  return trunc(text, max);
}
function viewerUrl(node) {
  const m = node.metadata || {};
  const ns = m.namespaceSlug || node.namespaceSlug || node.namespace;
  const path = m.path || node.path;
  return { url: `${VIEWER}/en/n/${ns}/p/${path}`, path, title: m.title || path };
}
function buildDraft(node, platform, target) {
  const { url, path, title } = viewerUrl(node);
  const sum = summarize(node, 280);
  let body;
  if (platform === "moltbook") body = `${sum}\n\nFull source-cited, dated roundup on WikiClaws: ${url}`;
  else if (platform === "x") body = `${trunc(sum, 170)} ${url}\n\n${DISCLOSURE}`;
  else if (platform === "reddit") body = `${sum}\n\nSharing because it's fully sourced + dated — full cited writeup: ${url}\n\n${DISCLOSURE}`;
  else if (platform === "haro" || platform === "pr") body = `SUBJECT: ${title}\n\n${sum}\n\nThis is an original, source-verified research roundup — every claim cited and dated. Happy to provide data/quotes/an interview. Source: ${url}\n\n${DISCLOSURE}`;
  else body = `${sum}\n\n${url}\n\n${DISCLOSURE}`;
  return { id: `${today()}-${path}-${platform}`, node: node.id || path, platform, target: target || (platform === "moltbook" ? "general" : ""), title, body, url, disclosure: DISCLOSURE, evalPassed: false, citabilityPassed: false };
}
function saveDraft(draft, out) {
  if (!existsSync(DRAFTS)) mkdirSync(DRAFTS, { recursive: true });
  const file = out || `${DRAFTS}/${draft.id}.json`;
  writeFileSync(file, JSON.stringify(draft, null, 2));
  return file;
}
function loadDraft(file) { return JSON.parse(readFileSync(file, "utf8")); }
function runGuard(draft, intent) {
  const r = spawnSync("node", [POLICY_GUARD, "lint", "-", "--json", "--platform", draft.platform, "--intent", intent, "--drafts-dir", DRAFTS], { input: JSON.stringify(draft), encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, violations: [{ rule: "guard-error", detail: (r.stderr || "policy-guard returned no JSON").slice(0, 200) }] }; }
}
function printBlocked(res) {
  console.log(`\n⛔ policy-guard BLOCKED this draft:`);
  for (const v of res.violations || []) console.log(`   ✗ ${v.rule} — ${v.detail}`);
  console.log(`   Fix per memory/growth-strategy.md, then retry.`);
}
function appendQueue(row) {
  if (!existsSync(QUEUE)) appendFileSync(QUEUE, QUEUE_HEADER);
  appendFileSync(QUEUE, `| ${QCOLS.map(c => cell(row[c])).join(" | ")} |\n`);
}
function updateRow(id, patch) {
  if (!existsSync(QUEUE)) throw new Error("no distribution queue yet");
  const lines = readFileSync(QUEUE, "utf8").split("\n");
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|") || l.includes("---") || /^\|\s*id\s*\|/i.test(l)) continue;
    const cells = l.split("|").slice(1, -1).map(s => s.trim());
    if (cells[0] !== id) continue;
    const obj = {}; QCOLS.forEach((c, idx) => obj[c] = cells[idx] ?? "");
    Object.assign(obj, patch);
    lines[i] = `| ${QCOLS.map(c => cell(obj[c])).join(" | ")} |`;
    found = true; break;
  }
  if (!found) throw new Error(`queue row '${id}' not found (see: distribute.mjs list)`);
  writeFileSync(QUEUE, lines.join("\n"));
}
function getRow(id) {
  if (!existsSync(QUEUE)) return null;
  for (const l of readFileSync(QUEUE, "utf8").split("\n")) {
    if (!l.startsWith("|") || l.includes("---") || /^\|\s*id\s*\|/i.test(l)) continue;
    const c = l.split("|").slice(1, -1).map(s => s.trim());
    if (c[0] === id) { const o = {}; QCOLS.forEach((k, i) => o[k] = c[i] ?? ""); return o; }
  }
  return null;
}
async function postToMoltbook(draft) {
  const KEY = process.env.MOLTBOOK_API_KEY;
  const MB = process.env.MOLTBOOK_BASE || "https://www.moltbook.com/api/v1"; // keep www. (redirect strips auth)
  if (!KEY) return { ok: false, reason: "no MOLTBOOK_API_KEY (human provisions once: claim tweet + dev invite + register, rotate post-breach key)" };
  try {
    const r = await fetch(`${MB}/posts`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ submolt: draft.target || "general", title: draft.title, content: draft.body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: `${r.status} ${JSON.stringify(j).slice(0, 160)}` };
    return { ok: true, url: j.url || j.post?.url || j.permalink || `${MB.replace("/api/v1", "")}` };
  } catch (e) { return { ok: false, reason: String(e.message || e) }; }
}

const cmds = {
  async draft(a) {
    if (!a.node || !a.platform) { console.error("usage: draft --node <id> --platform moltbook|reddit|x|haro|pr [--target <s>] [--out <f>]"); process.exit(2); }
    const d = buildDraft(await getNode(a.node), a.platform, a.target);
    if (a["eval-passed"]) d.evalPassed = true;
    if (a["citability-passed"]) d.citabilityPassed = true;
    const file = saveDraft(d, a.out);
    console.log(`drafted ${a.platform} post → ${file}`);
    console.log(`\n${d.body}\n`);
    console.log(`Edit the draft to make it genuinely useful + platform-native, then:`);
    console.log(a.platform === "moltbook" ? `  node scripts/distribute.mjs moltbook-post --node ${a.node} --draft ${file} --eval-passed --citability-passed`
      : `  node scripts/distribute.mjs queue --node ${a.node} --platform ${a.platform} --draft ${file} --eval-passed --citability-passed   # → human approval`);
  },

  async ["moltbook-post"](a) {
    if (!a.node && !a.draft) { console.error("usage: moltbook-post --node <id> [--draft <f>]"); process.exit(2); }
    const d = a.draft ? loadDraft(a.draft) : buildDraft(await getNode(a.node), "moltbook", a.target);
    d.platform = "moltbook";
    if (a["eval-passed"]) d.evalPassed = true;
    if (a["citability-passed"]) d.citabilityPassed = true;
    const res = runGuard(d, "auto");
    if (!res.ok) { printBlocked(res); process.exit(1); }
    const r = await postToMoltbook(d);
    const base = { id: d.id, date: today(), node: d.node, platform: "moltbook", guard: "pass", draft: a.draft || `${d.id}.json` };
    if (r.ok) { appendQueue({ ...base, status: "posted", postedUrl: r.url, outcome: "auto-posted" }); console.log(`✅ posted to Moltbook: ${r.url}`); }
    else { appendQueue({ ...base, status: "ready-moltbook", outcome: r.reason }); console.log(`📋 queued ready-moltbook (not posted): ${r.reason}\n   Provision MOLTBOOK_API_KEY, then: distribute.mjs moltbook-post --node ${d.node}`); }
  },

  async queue(a) {
    if (!a.node || !a.platform || !a.draft) { console.error("usage: queue --node <id> --platform reddit|x|haro|pr --draft <f>"); process.exit(2); }
    if (a.platform === "moltbook") { console.error("moltbook auto-posts — use moltbook-post, not queue"); process.exit(2); }
    const d = loadDraft(a.draft); d.platform = a.platform;
    if (a["eval-passed"]) d.evalPassed = true;
    if (a["citability-passed"]) d.citabilityPassed = true;
    const res = runGuard(d, "queue");
    if (!res.ok) { printBlocked(res); process.exit(1); }
    appendQueue({ id: d.id, date: today(), node: d.node, platform: a.platform, status: "pending-approval", guard: "pass", draft: a.draft });
    console.log(`📋 queued for human approval (${a.platform}): ${d.id}`);
    console.log(`   Review + approve:  node scripts/distribute.mjs approve --id ${d.id} --by <you>   (or use /wikiclaws-approve)`);
  },

  list(a) {
    if (!existsSync(QUEUE)) { console.log("distribution queue: empty."); return; }
    const rows = readFileSync(QUEUE, "utf8").split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !/^\|\s*id\s*\|/i.test(l))
      .map(l => { const c = l.split("|").slice(1, -1).map(s => s.trim()); const o = {}; QCOLS.forEach((k, i) => o[k] = c[i] ?? ""); return o; })
      .filter(r => !a.status || r.status === a.status);
    if (!rows.length) { console.log(a.status ? `no queue rows with status '${a.status}'.` : "distribution queue: empty."); return; }
    const pend = rows.filter(r => r.status === "pending-approval").length;
    if (pend && !a.status) console.log(`⏳ ${pend} draft(s) pending human approval.`);
    for (const r of rows) console.log(`  • [${r.status}] ${r.platform.padEnd(8)} ${r.id}${r.postedUrl && r.postedUrl !== "—" ? `  → ${r.postedUrl}` : ""}${r.approvedBy && r.approvedBy !== "—" ? `  (approved: ${r.approvedBy})` : ""}`);
  },

  approve(a) {
    if (!a.id || !a.by) { console.error("usage: approve --id <rowId> --by <name>"); process.exit(2); }
    const row = getRow(a.id); if (!row) { console.error(`row '${a.id}' not found`); process.exit(1); }
    if (row.platform === "moltbook") { console.error("moltbook posts don't need approval (auto-posted on-policy)"); process.exit(2); }
    updateRow(a.id, { status: "approved", approvedBy: a.by });
    console.log(`✅ approved ${a.id} by ${a.by}. A human now posts it (disclosed), then:`);
    console.log(`   node scripts/distribute.mjs mark-posted --id ${a.id} --url <postUrl>`);
    if (row.draft && row.draft !== "—") console.log(`   draft: ${row.draft}`);
  },

  reject(a) {
    if (!a.id) { console.error("usage: reject --id <rowId> [--reason <s>]"); process.exit(2); }
    updateRow(a.id, { status: "rejected", outcome: a.reason || "rejected" });
    console.log(`🚫 rejected ${a.id}${a.reason ? ` (${a.reason})` : ""}`);
  },

  ["mark-posted"](a) {
    if (!a.id || !a.url) { console.error("usage: mark-posted --id <rowId> --url <postUrl>"); process.exit(2); }
    const row = getRow(a.id); if (!row) { console.error(`row '${a.id}' not found`); process.exit(1); }
    if (row.platform !== "moltbook" && row.approvedBy === "—") { console.error(`⛔ ${a.id} is off-Moltbook and NOT approved — approve it first (human gate).`); process.exit(1); }
    updateRow(a.id, { status: "posted", postedUrl: a.url, outcome: row.outcome === "—" ? "posted" : row.outcome });
    console.log(`✅ marked posted: ${a.id} → ${a.url}`);
    console.log(`   Next: track whether it earns a citation — node scripts/aeo-probe.mjs run`);
  },
};

const [, , cmd, ...rest] = process.argv;
const fn = cmds[cmd];
if (!fn) { console.error("usage: distribute.mjs draft|moltbook-post|queue|list|approve|reject|mark-posted  (see header)"); process.exit(2); }
(async () => { try { await fn(parseArgs(rest)); } catch (e) { console.error(String(e.message || e)); process.exit(1); } })();
