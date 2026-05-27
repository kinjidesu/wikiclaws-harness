#!/usr/bin/env node
/**
 * aeo-probe.mjs — the NORTH-STAR engine: measure WikiClaws's AI-citation share. For a target query,
 * does an AI answer engine (Perplexity / OpenAI / Claude / Gemini / Google AI Overviews) CITE a
 * wikiclaws* URL or MENTION "WikiClaws"? Logged over time to memory/aeo-scoreboard.md so we can
 * trend citation-share % — the metric the whole growth flywheel optimizes (mentions correlate ~3×
 * more than backlinks with AI citation, so we track both cited + mentioned).
 *
 *   node scripts/aeo-probe.mjs scan "<seed topic>"        # expand a seed into target-queries.md rows
 *   node scripts/aeo-probe.mjs run [--query "<q>"] [--engine perplexity|openai|claude|gemini|google|all]
 *        [--mode api|manual] [--domain wikiclaws] [--competitors a.com,b.com] [--no-log]
 *   node scripts/aeo-probe.mjs log --query "<q>" --engine <e> --cited yes|no|partial
 *        [--method cited-via-tool-search] [--position N] [--node <url>] [--competitor <domain>]
 *   node scripts/aeo-probe.mjs report [--since <iso>] [--quiet]
 *
 * api-mode calls a source-returning engine API (needs that engine's key) and auto-logs. manual-mode
 * (default when no keys / on the web sandbox) prints a probe worklist; you run each query via your
 * own WebSearch/WebFetch and record the result with `log` (label the method honestly — never claim a
 * citation you didn't observe; same discipline as verify.mjs).
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DOMAIN = "wikiclaws";
const SCOREBOARD = fileURLToPath(new URL("../memory/aeo-scoreboard.md", import.meta.url));
const TARGETS = fileURLToPath(new URL("../memory/target-queries.md", import.meta.url));
const today = () => new Date().toISOString().slice(0, 10);
const cell = s => String(s ?? "").replace(/\|/g, "/").replace(/\n/g, " ");

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    else a._.push(argv[i]);
  }
  return a;
}
const list = v => (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : []);
const inDomain = (url, d) => { try { return new URL(url).hostname.includes(d); } catch { return String(url).includes(d); } };

function appendRow(file, header, row) {
  if (!existsSync(file)) appendFileSync(file, header);
  appendFileSync(file, row);
}
const SCOREBOARD_HEADER = `# AEO scoreboard — the north-star metric (AI-citation share)\n\nAppended by \`scripts/aeo-probe.mjs\`. Each row = one target-query × engine probe: was a wikiclaws* URL **cited**, or was "WikiClaws" **mentioned**? \`report\` rolls up cited/probed = citation-share %. Method is honest (api vs tool-search vs unprobed).\n\n| date | query | engine | cited? | position | our node | competitor cited | method | trend |\n|---|---|---|---|---|---|---|---|---|\n`;
const TARGETS_HEADER = `# Target queries — the citation watchlist\n\nAppended by \`scripts/aeo-probe.mjs scan\` (and curated by hand / wikiclaws-demand). These are the questions where WikiClaws SHOULD be the cited source. status ∈ watching | gap-no-node | gap-not-cited | covered.\n\n| date | query | topic cluster | have node? (id) | priority | status |\n|---|---|---|---|---|---|\n`;

// ── engine adapters (api-mode) ────────────────────────────────────────────────
function classify(sources, content, domain, comps) {
  const idx = sources.findIndex(u => inDomain(u, domain));
  const citedUrls = sources.filter(u => inDomain(u, domain));
  return {
    cited: citedUrls.length > 0,
    mentioned: new RegExp(domain, "i").test(content || ""),
    position: idx >= 0 ? idx + 1 : null,
    node: citedUrls[0] || null,
    competitor: comps.find(c => sources.some(u => inDomain(u, c))) || null,
    sources: sources.length,
  };
}
async function jpost(url, headers, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
const ENGINES = {
  perplexity: { env: "PERPLEXITY_API_KEY", run: async (q, d, c) => {
    const j = await jpost("https://api.perplexity.ai/chat/completions", { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      { model: process.env.PERPLEXITY_MODEL || "sonar", messages: [{ role: "user", content: q }] });
    const sources = [...(j.search_results || []).map(s => s.url), ...(j.citations || [])];
    return classify(sources, j.choices?.[0]?.message?.content || "", d, c);
  } },
  openai: { env: "OPENAI_API_KEY", run: async (q, d, c) => {
    const j = await jpost("https://api.openai.com/v1/responses", { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      { model: process.env.OPENAI_MODEL || "gpt-4.1", tools: [{ type: "web_search" }], input: q });
    const urls = [], texts = [];
    for (const it of j.output || []) for (const cc of it.content || []) { if (cc.text) texts.push(cc.text); for (const an of cc.annotations || []) if (an.type === "url_citation" && an.url) urls.push(an.url); }
    return classify(urls, texts.join(" "), d, c);
  } },
  claude: { env: "ANTHROPIC_API_KEY", run: async (q, d, c) => {
    const j = await jpost("https://api.anthropic.com/v1/messages", { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      { model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 1024, tools: [{ type: process.env.ANTHROPIC_WEBSEARCH_TOOL || "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: q }] });
    const urls = [], texts = [];
    for (const b of j.content || []) {
      if (b.type === "text") { texts.push(b.text || ""); for (const ci of b.citations || []) if (ci.url) urls.push(ci.url); }
      if (b.type === "web_search_tool_result") for (const r of b.content || []) if (r.url) urls.push(r.url);
    }
    return classify(urls, texts.join(" "), d, c);
  } },
  gemini: { env: "GEMINI_API_KEY", run: async (q, d, c) => {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const j = await jpost(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {},
      { contents: [{ parts: [{ text: q }] }], tools: [{ google_search: {} }] });
    const gm = j.candidates?.[0]?.groundingMetadata || {};
    const sources = (gm.groundingChunks || []).map(g => g.web?.uri || "").filter(Boolean);
    const titles = (gm.groundingChunks || []).map(g => g.web?.title || "").join(" "); // vertex redirect → match title
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join(" ");
    const r = classify(sources, text + " " + titles, d, c);
    if (!r.cited && new RegExp(d, "i").test(titles)) { r.cited = true; r.node = "(via grounding title)"; }
    return r;
  } },
  google: { env: "SERPAPI_KEY", run: async () => { throw new Error("google AI Overviews via SerpApi not wired (paid + legal-risk); use --mode manual / agent WebSearch"); } },
};

// ── subcommands ────────────────────────────────────────────────────────────────
function readWatching() {
  if (!existsSync(TARGETS)) return [];
  return readFileSync(TARGETS, "utf8").split("\n")
    .filter(l => l.startsWith("|") && !l.includes("---") && !/^\|\s*date\s*\|/i.test(l))
    .map(l => l.split("|").map(s => s.trim()))
    .filter(c => c[2] && /watching|gap/i.test(c[6] || "")).map(c => c[2]);
}

const cmds = {
  scan(a) {
    const seed = a._[0]; if (!seed) { console.error('usage: scan "<seed topic>"'); process.exit(2); }
    const y = new Date().getFullYear();
    const queries = [...new Set([seed, `what is ${seed}`, `latest ${seed} ${y}`, `${seed} explained`, `${seed} timeline ${y}`, `best sources on ${seed}`])];
    for (const q of queries) appendRow(TARGETS, TARGETS_HEADER, `| ${today()} | ${cell(q)} | ${cell(seed)} | ? | med | watching |\n`);
    console.log(`Added ${queries.length} target queries for "${seed}" → memory/target-queries.md`);
    queries.forEach(q => console.log(`  • ${q}`));
    console.log(`\nNext: probe them → node scripts/aeo-probe.mjs run   (api-mode if engine keys set, else manual worklist)`);
  },

  async run(a) {
    const domain = a.domain || DOMAIN;
    const comps = list(a.competitors);
    const queries = a.query ? [a.query] : readWatching();
    if (!queries.length) { console.error('no queries — pass --query "<q>" or run `scan "<seed>"` first'); process.exit(2); }
    const want = (a.engine && a.engine !== "all") ? [a.engine] : Object.keys(ENGINES);
    const keyed = want.filter(e => ENGINES[e] && process.env[ENGINES[e].env]);
    const mode = a.mode || (keyed.length ? "api" : "manual");

    if (mode === "manual" || !keyed.length) {
      console.log(`\nMANUAL PROBE WORKLIST (no engine API keys detected / web sandbox).`);
      console.log(`For each query, run it in the engine OR your own WebSearch, check if a ${domain}* URL is cited or "${domain}" is mentioned, then log it:\n`);
      for (const q of queries) for (const e of want)
        console.log(`  [ ] ${e.padEnd(10)} "${q}"\n        → node scripts/aeo-probe.mjs log --query ${JSON.stringify(q)} --engine ${e} --cited yes|no --method cited-via-tool-search [--position N] [--node <url>] [--competitor <domain>]`);
      console.log(`\n(Label method honestly: cited-via-api · cited-via-tool-search · not-cited · unprobed. Then: aeo-probe.mjs report)`);
      return;
    }

    console.log(`\nProbing ${queries.length} quer${queries.length > 1 ? "ies" : "y"} × ${keyed.join(", ")} (api-mode, domain=${domain})…`);
    for (const q of queries) {
      for (const e of keyed) {
        try {
          const r = await ENGINES[e].run(q, domain, comps);
          const method = r.cited ? "cited-via-api" : "not-cited";
          const citedStr = r.cited ? "yes" : (r.mentioned ? "partial" : "no");
          console.log(`  ${r.cited ? "✅" : (r.mentioned ? "≈" : "❌")} ${e.padEnd(10)} cited=${citedStr}${r.position ? ` @${r.position}` : ""}${r.competitor ? ` (competitor: ${r.competitor})` : ""} — "${q.slice(0, 60)}"`);
          if (!a["no-log"]) appendRow(SCOREBOARD, SCOREBOARD_HEADER, `| ${today()} | ${cell(q)} | ${e} | ${citedStr} | ${r.position ?? "—"} | ${cell(r.node || "—")} | ${cell(r.competitor || "—")} | ${method} | — |\n`);
        } catch (err) {
          console.log(`  ⚠️  ${e.padEnd(10)} probe failed: ${String(err.message || err).slice(0, 120)}`);
        }
      }
    }
    const skipped = want.filter(e => !keyed.includes(e));
    if (skipped.length) console.log(`  (skipped — no key: ${skipped.join(", ")}. Set ${skipped.map(e => ENGINES[e]?.env).filter(Boolean).join("/")} or probe them via --mode manual.)`);
    if (!a["no-log"]) console.log(`\n→ logged to memory/aeo-scoreboard.md · roll up: node scripts/aeo-probe.mjs report`);
  },

  log(a) {
    for (const r of ["query", "engine", "cited"]) if (!a[r]) { console.error(`missing --${r}`); process.exit(2); }
    const method = a.method || (a.cited === "yes" ? "cited-via-tool-search" : "not-cited");
    appendRow(SCOREBOARD, SCOREBOARD_HEADER, `| ${today()} | ${cell(a.query)} | ${cell(a.engine)} | ${cell(a.cited)} | ${a.position ?? "—"} | ${cell(a.node || "—")} | ${cell(a.competitor || "—")} | ${cell(method)} | — |\n`);
    console.log(`logged: ${a.engine} · cited=${a.cited} · "${a.query}" → memory/aeo-scoreboard.md`);
  },

  report(a) {
    if (!existsSync(SCOREBOARD)) { if (!a.quiet) console.log("AEO scoreboard: no probes logged yet. Run `aeo-probe.mjs run` (or `scan` first)."); return; }
    const rows = readFileSync(SCOREBOARD, "utf8").split("\n")
      .filter(l => l.startsWith("|") && !l.includes("---") && !/^\|\s*date\s*\|/i.test(l))
      .map(l => l.split("|").map(s => s.trim())).filter(c => c.length >= 9)
      .map(c => ({ date: c[1], query: c[2], engine: c[3], cited: c[4], method: c[8] }))
      .filter(r => !a.since || r.date >= a.since);
    const probed = rows.filter(r => r.method !== "unprobed");
    const citedYes = probed.filter(r => r.cited === "yes");
    const share = probed.length ? Math.round((citedYes.length / probed.length) * 100) : 0;

    // trend: this metric vs the prior distinct date
    const dates = [...new Set(probed.map(r => r.date))].sort();
    let trend = "";
    if (dates.length >= 2) {
      const prevDate = dates[dates.length - 2];
      const prev = probed.filter(r => r.date <= prevDate);
      const prevShare = prev.length ? Math.round((prev.filter(r => r.cited === "yes").length / prev.length) * 100) : 0;
      const d = share - prevShare; trend = ` (${d >= 0 ? "+" : ""}${d}pp vs ${prevDate})`;
    }

    if (a.quiet) { console.log(`📊 AEO citation-share: ${share}% (${citedYes.length}/${probed.length} probes)${trend}`); return; }
    console.log(`\n📊 NORTH STAR — AI-citation share: ${share}%  (${citedYes.length} cited / ${probed.length} probed)${trend}`);
    const byEngine = {};
    for (const r of probed) { (byEngine[r.engine] ||= { c: 0, n: 0 }).n++; if (r.cited === "yes") byEngine[r.engine].c++; }
    for (const [e, v] of Object.entries(byEngine)) console.log(`   ${e.padEnd(10)} ${Math.round((v.c / v.n) * 100)}%  (${v.c}/${v.n})`);
    const mentioned = rows.filter(r => r.cited === "partial").length;
    if (mentioned) console.log(`   mentioned-not-cited (the gap to close): ${mentioned}`);
    console.log(`\n   Mentions correlate ~3× more than backlinks with AI citation — turn 'partial' (mentioned) into 'yes' (cited).`);
  },
};

const [, , cmd, ...rest] = process.argv;
const fn = cmds[cmd];
if (!fn) { console.error("usage: aeo-probe.mjs scan|run|log|report  (see header)"); process.exit(2); }
(async () => { try { await fn(parseArgs(rest)); } catch (e) { console.error(String(e.message || e)); process.exit(1); } })();
