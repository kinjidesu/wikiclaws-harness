#!/usr/bin/env node
/**
 * policy-guard.mjs — the white-hat CRITIC for the growth/distribution loop.
 * Lints a distribution draft against the BANNED ruleset in memory/growth-strategy.md and
 * REFUSES (exit 1) anything that would trade durable EEAT/authority for a Google penalty or a
 * platform ban. No network, pure heuristics. This is the structural guardrail the mission demands:
 * distribute.mjs shells out to it before any post, and scripts/hooks/guard-post.mjs runs it on
 * every social-post tool call so the human-approval gate + disclosure are UNBYPASSABLE.
 *
 *   node scripts/policy-guard.mjs rules
 *   node scripts/policy-guard.mjs lint <draft.json|@draft.md|-> [--platform moltbook|reddit|x|haro|pr]
 *        [--intent auto|queue|draft] [--drafts-dir <dir>] [--json]
 *
 * Draft JSON shape (what distribute.mjs writes; "-" reads this JSON from stdin):
 *   { id, node, platform, target, title, body, url, disclosure, evalPassed, citabilityPassed, notes? }
 *
 * Exit codes: 0 = clean, 1 = BLOCKED (prints rule ids + details), 2 = usage.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lineReuse } from "./lib/diff.mjs";

const DISCLOSURE = process.env.WIKICLAWS_DISCLOSURE || "🤖 Posted by an AI agent on behalf of WikiClaws.";
const DRAFTS_DEFAULT = fileURLToPath(new URL("../drafts", import.meta.url));
const NEAR_DUP_PCT = 80; // line-reuse % above which two drafts for different targets = mass cross-post

// Source of truth for the lint logic; mirrors the BANNED table in memory/growth-strategy.md.
const RULES = [
  { id: "auto-post-off-moltbook", why: "Reddit/X ban automated posting; off-Moltbook MUST go through human approval." },
  { id: "undisclosed-ai",         why: "FTC requires disclosing AI authorship/sponsorship; platforms ban undisclosed bots." },
  { id: "fake-persona",           why: "Sock-puppet / posing as an unaffiliated human is deceptive + a platform/FTC violation." },
  { id: "undisclosed-astroturf",  why: "Coordinated 'organic'-looking promo that hides the WikiClaws affiliation = manipulation." },
  { id: "mass-cross-post",        why: "Duplicative posting across places/accounts → X/Reddit bans + Google scaled-content-abuse." },
  { id: "parasite-seo",           why: "Republishing our content on third-party hosts to exploit their ranking = site-reputation abuse." },
  { id: "pbn",                    why: "Private blog networks / link farms are an explicit Google link-scheme violation." },
  { id: "pay-for-link",           why: "Buying links/placements is an explicit Google guideline violation." },
  { id: "scaled-unsupervised",    why: "Distributing a node that hasn't passed eval + citability = scaled content abuse." },
];

// Heuristic phrase denylists (case-insensitive). Conservative — strategic abuse still needs the human critic.
const PHRASES = {
  "fake-persona": [
    "i'm not affiliated", "i am not affiliated", "not affiliated with", "no affiliation",
    "i have no connection", "i don't work for", "i do not work for", "just a regular user",
    "as a regular user", "i randomly found", "i stumbled upon", "i'm a real person", "i am human",
    "totally unbiased", "as an unbiased third", "no connection to wikiclaws",
  ],
  "undisclosed-astroturf": [
    "make it look organic", "pretend to be", "don't mention we", "do not mention we",
    "hide the affiliation", "without disclosing", "act like a user", "astroturf",
  ],
  "pbn": ["pbn", "private blog network", "link farm", "link network", "guest post network"],
  "pay-for-link": [
    "buy backlink", "buy a backlink", "buy link", "buy links", "paid link", "paid backlink",
    "link exchange", "sponsored do-follow", "sponsored dofollow", "dofollow link for", "pay for placement",
    "link insertion service", "purchase a link",
  ],
  "parasite-seo": [
    "republish the full", "republish full", "syndicate the full", "syndicate full content",
    "post the entire article on", "post the full article on", "host our content on their",
    "piggyback their domain", "rank on their domain", "exploit their domain authority",
  ],
};

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    else a._.push(argv[i]);
  }
  return a;
}

function loadDraft(arg, platformFlag) {
  let raw;
  if (arg === "-" || arg === undefined) raw = readFileSync(0, "utf8"); // stdin (used by the hook)
  else if (arg.startsWith("@")) return { body: readFileSync(arg.slice(1), "utf8"), platform: platformFlag, _markdown: true };
  else raw = readFileSync(arg, "utf8");
  try { return JSON.parse(raw); } catch { return { body: raw, platform: platformFlag, _markdown: true }; }
}

function hasDisclosure(text) {
  if (text.includes(DISCLOSURE)) return true;
  return /\b(ai[- ]?(agent|generated|authored)|on behalf of wikiclaws|i help build wikiclaws|affiliated with wikiclaws|🤖)\b/i.test(text);
}

function matchPhrases(text, list) {
  const lc = text.toLowerCase();
  return list.filter(p => lc.includes(p));
}

function nearDuplicates(body, target, platform, draftsDir, selfId) {
  if (!body || !existsSync(draftsDir)) return [];
  const hits = [];
  for (const f of readdirSync(draftsDir).filter(f => f.endsWith(".json"))) {
    let other; try { other = JSON.parse(readFileSync(`${draftsDir}/${f}`, "utf8")); } catch { continue; }
    if (!other.body || other.id === selfId) continue;
    const sameSlot = (other.target || "") === (target || "") && (other.platform || "") === (platform || "");
    if (sameSlot) continue; // a re-draft of the SAME target/platform is a revision, not a cross-post
    const pct = Math.max(lineReuse(other.body, body).survivalPct, lineReuse(body, other.body).survivalPct);
    if (pct >= NEAR_DUP_PCT) hits.push({ id: other.id || f, target: other.target, platform: other.platform, pct });
  }
  return hits;
}

const cmds = {
  rules() {
    console.log(`\nPolicy-guard ruleset — BANNED (hard refuse). Canon: memory/growth-strategy.md\n`);
    for (const r of RULES) console.log(`  ✗ ${r.id}\n      ${r.why}`);
    console.log(`\nDisclosure required off-Moltbook: "${DISCLOSURE}"`);
    console.log(`Channel rule: auto-post ONLY on Moltbook; Reddit/X/HARO/PR = AI-draft → human-approve → disclose.\n`);
  },

  lint(a) {
    const draft = loadDraft(a._[0], a.platform);
    const platform = (a.platform || draft.platform || "").toLowerCase();
    const intent = (a.intent || "queue").toLowerCase(); // auto | queue | draft
    const draftsDir = a["drafts-dir"] || DRAFTS_DEFAULT;
    const text = [draft.title, draft.body, draft.notes, draft.disclosure].filter(Boolean).join("\n");
    const v = []; // {rule, detail}
    const add = (rule, detail) => v.push({ rule, detail });

    if (!platform) { console.error("missing --platform (or draft.platform): moltbook|reddit|x|haro|pr"); process.exit(2); }

    // 1. scaled-unsupervised — distribution must follow the quality gates, never precede them.
    if (intent !== "draft" && !(draft.evalPassed === true && draft.citabilityPassed === true))
      add("scaled-unsupervised", `node not gated (evalPassed=${draft.evalPassed}, citabilityPassed=${draft.citabilityPassed}). Pass eval + wikiclaws-citability first, then set both true.`);

    // 2. auto-post-off-moltbook — the channel rule.
    if (intent === "auto" && platform !== "moltbook")
      add("auto-post-off-moltbook", `auto-post intent on '${platform}'. Only Moltbook may auto-post; queue this for human approval instead.`);

    // 3. undisclosed-ai — off-Moltbook posts must carry the disclosure.
    if (platform !== "moltbook" && !hasDisclosure(text))
      add("undisclosed-ai", `off-Moltbook draft has no AI disclosure. Include: "${DISCLOSURE}"`);

    // 4–5 / 7–8. phrase-based heuristics.
    for (const [rule, list] of Object.entries(PHRASES)) {
      const hit = matchPhrases(text, list);
      if (hit.length) add(rule, `matched: ${hit.map(h => `"${h}"`).join(", ")}`);
    }

    // 6. mass-cross-post — near-duplicate vs other queued drafts for a different target.
    for (const d of nearDuplicates(draft.body, draft.target, platform, draftsDir, draft.id))
      add("mass-cross-post", `~${d.pct}% identical to draft ${d.id} (target ${d.target}/${d.platform}). Write a platform-native variant, don't duplicate.`);

    const ok = v.length === 0;
    if (a.json) { console.log(JSON.stringify({ ok, platform, intent, violations: v }, null, 2)); process.exit(ok ? 0 : 1); }

    if (ok) {
      console.log(`\n✅ policy-guard PASS — ${platform} (intent: ${intent}). No banned-tactic signals.`);
      if (platform === "moltbook" && intent === "auto") console.log(`   (Moltbook auto-post allowed — agent-native, on-policy.)`);
      process.exit(0);
    }
    console.log(`\n⛔ policy-guard BLOCKED — ${platform} (intent: ${intent}). ${v.length} violation(s):`);
    for (const x of v) console.log(`   ✗ ${x.rule} — ${x.detail}`);
    console.log(`\n   Why these lose: they trade durable authority for a penalty/ban. See memory/growth-strategy.md.`);
    console.log(`   Fix: disclose + queue for human approval (off-Moltbook), write platform-native variants, and pass eval+citability first.`);
    process.exit(1);
  },
};

const [, , cmd, ...rest] = process.argv;
const fn = cmds[cmd];
if (!fn) { console.error("usage: policy-guard.mjs rules | lint <draft.json|@draft.md|-> [--platform p] [--intent auto|queue|draft] [--json]"); process.exit(2); }
try { fn(parseArgs(rest)); }
catch (e) { console.error(String(e.message || e)); process.exit(2); }
