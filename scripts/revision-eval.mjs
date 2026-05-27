#!/usr/bin/env node
/**
 * revision-eval.mjs — DIFF eval for a node revision (vN). The engine behind the "trust kernel"
 * (WikiTrust × EigenTrust × Beta). Two modes:
 *
 *   PREP  (default) — build the diff package the judges reason over (what changed, which citations
 *                     to re-verify vs carry-forward+liveness-check, claim maturity, prior top-fix,
 *                     decay/staleness of the last eval). Does NOT score — the LLM judges do that.
 *   RECORD          — given the judged scores, compute the delta/trajectory, regression guard, and
 *                     the trust primitives (independent-survival, Beta mean±conf, settledness,
 *                     decay), append a row to memory/eval-history.md, and print the Slack lines.
 *
 * Inputs work LOCALLY (no API needed — testable) or via --node (fetch versions from the API):
 *   node scripts/revision-eval.mjs prep   --node <id> --version <N> [--prev-body f --curr-body f] \
 *        [--prev-cites cites.json --curr-cites cites.json] [--volatility high|med|low]
 *   node scripts/revision-eval.mjs record --node <id> --version <N> --by <agent> \
 *        --scores scores.json [--prev-body f --curr-body f | --survival <pct>] \
 *        [--prior-agent <agent>] [--judge-gap <n>] [--volatility med] [--no-log]
 *
 * scores.json: {"citation":_,"truth":_,"source":_,"coverage":_,"neutrality":_,"freshness":_,
 *   "overall":_._,"verdict":"PASS|FAIL","claim_ratio":"M/N","top_fix":"…",
 *   "hermes_overall":_._,"claude_overall":_._,"contradicted":false,"rotted":false}
 *
 * Trust is OBSERVED: survival counts only when content survives ANOTHER agent (WikiTrust);
 * confidence tightens with independent evidence (Beta); the dual-judge + verify.mjs is the
 * pre-trusted anchor (EigenTrust). The regression guard FLAGS loudly + logs — it never auto-acts.
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lineReuse, k } from "./lib/diff.mjs";
import { decayWt, daysBetween } from "./lib/decay.mjs";

const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const LEDGER = fileURLToPath(new URL("../memory/eval-history.md", import.meta.url));

const argv = process.argv.slice(2);
const mode = (argv[0] && !argv[0].startsWith("--")) ? argv.shift() : "prep";
const a = (() => { const o = { _: [] }; for (let i = 0; i < argv.length; i++) argv[i].startsWith("--") ? (o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true) : o._.push(argv[i]); return o; })();

// ---------- helpers ----------
const readJSON = f => JSON.parse(readFileSync(f, "utf8"));
const normUrl = u => String(u || "").trim().toLowerCase()
  .replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");

async function api(path) {
  if (!KEY) throw new Error("set WIKICLAWS_API_KEY (or use local --prev-body/--curr-body)");
  const r = await fetch(BASE + path, { headers: { "X-API-Key": KEY } });
  if (!r.ok) throw new Error(`API ${r.status} ${path}`);
  return r.json();
}

// classify citations between prior and current by normalized URL.
// claim-rebound = URL unchanged but its [[n]] marker moved onto a CHANGED line → claim changed → re-verify.
function classifyCitations(prev, curr, changedText) {
  const prevByUrl = new Map(prev.map(c => [normUrl(c.url), c]));
  const currByUrl = new Map(curr.map(c => [normUrl(c.url), c]));
  const added = [], removed = [], unchanged = [], rebound = [];
  curr.forEach((c, i) => {
    const u = normUrl(c.url);
    if (!prevByUrl.has(u)) { added.push(c); return; }
    // marker index = position+1; if a changed line bears [[idx]], the claim moved
    const idx = i + 1;
    if (new RegExp(`\\[\\[${idx}\\]\\]`).test(changedText)) rebound.push(c);
    else unchanged.push(c);
  });
  for (const c of prev) if (!currByUrl.has(normUrl(c.url))) removed.push(c);
  return { added, removed, unchanged, rebound };
}

// parse prior lineage rows for this node from the markdown ledger
function loadLineage(node) {
  if (!existsSync(LEDGER)) return [];
  const lines = readFileSync(LEDGER, "utf8").split("\n").filter(l => l.startsWith("| ") && !/^\|\s*-+/.test(l) && !/\|\s*date\s*\|/.test(l));
  return lines.map(l => {
    const c = l.split("|").map(s => s.trim());
    // | _ | date | node | version | by | overall | dims | claim | surv | indep | Δ | trust | settled | decay | verdict | regression | judges |
    return { date: c[1], node: c[2], version: +c[3], by: c[4], overall: parseFloat(c[5]),
      survival: c[8], indep: c[9], verdict: c[14], regression: /yes|🔴/i.test(c[15] || ""), judges: c[16] };
  }).filter(r => r.node === node);
}

// Beta-style trust: mean overall + a confidence ± that tightens with independent evidence.
function betaTrust(overalls, nIndep) {
  const n = overalls.length;
  const mean = n ? overalls.reduce((x, y) => x + y, 0) / n : 0;
  const effective = n + nIndep;                 // independents count double
  const ci = effective ? 0.8 / Math.sqrt(effective) : 0.8;
  return { mean: +mean.toFixed(2), ci: +ci.toFixed(2), n, nIndep };
}

// settledness uses CUMULATIVE independent validation (bestIndep across the lineage), not just the
// latest edit's independence — a self-revise shouldn't flip a previously-validated node to contested.
function settledness({ churn, bestIndep, judgeGap, regression, baseline }) {
  if (baseline) return { label: "new", why: "baseline — not yet independently validated" };
  if (regression) return { label: "unstable", why: "regressed this revision" };
  if (judgeGap > 1.0 || churn >= 6) return { label: "contested", why: judgeGap > 1.0 ? "judges persistently diverge" : "high revision churn" };
  if (bestIndep >= 70 && judgeGap <= 0.5) return { label: "settled", why: "survived another agent + judges agree" };
  if (bestIndep < 50) return { label: "unproven", why: "not yet independently survived" };
  return { label: "settling", why: "improving but not yet stable" };
}

async function bodies() {
  if (a["prev-body"] && a["curr-body"]) return { prev: readFileSync(a["prev-body"], "utf8"), curr: readFileSync(a["curr-body"], "utf8") };
  if (a.node && a.version) {
    const vs = await api(`/v1/nodes/${a.node}/versions`);
    const items = vs.items || vs.versions || vs;
    const find = n => (items.find(v => (v.version ?? v.versionNumber) === n) || {});
    const get = v => v.content?.body || v.body || "";
    return { prev: get(find(+a.version - 1)), curr: get(find(+a.version)) };
  }
  throw new Error("need --prev-body+--curr-body OR --node+--version (with key)");
}

async function citations() {
  if (a["prev-cites"] && a["curr-cites"]) return { prev: readJSON(a["prev-cites"]), curr: readJSON(a["curr-cites"]) };
  if (a.node) { const node = await api(`/v1/nodes/${a.node}`); return { prev: [], curr: (node.metadata || {}).citations || [] }; }
  return { prev: [], curr: [] };
}

// ---------- PREP ----------
async function prep() {
  const { prev, curr } = await bodies();
  const { prev: pc, curr: cc } = await citations();
  const d = lineReuse(prev, curr);
  const changedText = d.changed.join("\n");
  const cite = classifyCitations(pc, cc, changedText);
  const lineage = loadLineage(a.node || "—");
  const last = lineage[lineage.length - 1];
  const vol = a.volatility || "med";
  const dWt = last ? decayWt(daysBetween(last.date, new Date().toISOString().slice(0, 10)), vol) : 1;
  const reverify = [...cite.added, ...cite.rebound];

  console.log(`\n=== REVISION-EVAL PREP — node ${a.node || "(local)"} v${a.version || "?"} ===`);
  console.log(`content survival: ${d.survivalPct}% (reused ${k(d.reusedChars)} / new ${k(d.newChars)} chars)`);
  if (d.survivalPct < 35) console.log(`⚠️  survival < 35% → MAJOR REWRITE: do a FULL eval, not a diff eval (the diff is meaningless).`);
  console.log(`\ncitations: ${cite.unchanged.length} unchanged · ${cite.added.length} added · ${cite.rebound.length} claim-rebound · ${cite.removed.length} removed`);
  console.log(`  RE-VERIFY (full entailment) — added + rebound:`);
  reverify.forEach(c => console.log(`    • ${c.url}`));
  console.log(`  CARRY FORWARD entailment, RE-CHECK LIVENESS only — unchanged:`);
  cite.unchanged.forEach(c => console.log(`    • ${c.url}`));
  console.log(`\nclaim maturity: ${cite.unchanged.length} carried (maturing) · ${cite.added.length} fresh-in-v${a.version || "N"}`);
  if (last) {
    console.log(`\nprior eval (v${last.version}, ${last.date}, by ${last.by}): overall ${last.overall} ${last.verdict}${last.regression ? " [regressed]" : ""}`);
    console.log(`decay-wt of prior eval: ${dWt}${dWt < 0.6 ? "  ⚠️ stale → re-eval worthwhile" : ""} (volatility=${vol})`);
    console.log(`prior top-fix to verify-addressed: (read from thread/lineage)`);
  } else console.log(`\nno prior eval in lineage — this is the baseline.`);
  console.log(`\n→ Judges: re-score ONLY dimensions the diff touches; untouched dims inherit prior scores.`);
  console.log(`→ Hermes stays BLIND to prior numeric scores: give it the changed text + prior top-fix as a TASK, not the numbers.`);
  console.log(`→ Then: node scripts/revision-eval.mjs record --node ${a.node || "<id>"} --version ${a.version || "<N>"} --by <agent> --scores scores.json --survival ${d.survivalPct} [--prior-agent ${last?.by || "<agent>"}] [--judge-gap <|H-C|>]`);
}

// ---------- RECORD ----------
function record() {
  const s = readJSON(a.scores);
  const node = a.node, version = +a.version, by = a.by || "?";
  if (!node || !version || !a.scores) { console.error("record needs --node --version --by --scores"); process.exit(2); }
  const lineage = loadLineage(node);
  const prior = lineage[lineage.length - 1];
  const priorAgent = a["prior-agent"] || prior?.by;

  // survival (from bodies or --survival), independent only if a DIFFERENT agent produced/judged vN
  let survival = a.survival != null ? +a.survival : null;
  if (survival == null && a["prev-body"] && a["curr-body"]) survival = lineReuse(readFileSync(a["prev-body"], "utf8"), readFileSync(a["curr-body"], "utf8")).survivalPct;
  if (survival == null) survival = 100;
  const independent = priorAgent && by && by !== priorAgent;
  const indepSurvival = independent ? survival : 0;

  // delta + regression guard (flag-only)
  const dims = ["citation", "truth", "source", "coverage", "neutrality", "freshness"];
  const delta = prior ? +(s.overall - prior.overall).toFixed(2) : 0;
  const drops = [];
  if (prior && delta < 0) drops.push(`overall ${prior.overall}→${s.overall}`);
  if (s.contradicted) drops.push("a claim is now CONTRADICTED");
  if (s.rotted) drops.push("a previously-live citation ROTTED → unverifiable");
  const regression = drops.length > 0;

  // Beta trust over the lineage incl. this eval
  const overalls = [...lineage.map(r => r.overall).filter(Number.isFinite), s.overall];
  const nIndep = lineage.filter(r => r.indep && parseFloat(r.indep) > 0).length + (independent ? 1 : 0);
  const trust = betaTrust(overalls, nIndep);

  // settledness
  const judgeGap = a["judge-gap"] != null ? +a["judge-gap"] : (Number.isFinite(s.hermes_overall) && Number.isFinite(s.claude_overall) ? Math.abs(s.hermes_overall - s.claude_overall) : 0);
  const bestIndep = Math.max(indepSurvival, ...lineage.map(r => parseFloat(r.indep) || 0));
  const settled = settledness({ churn: version, bestIndep, judgeGap, regression, baseline: !prior });
  const vol = a.volatility || "med";

  const emoji = regression ? "🔴" : (s.verdict === "PASS" ? "🟢" : "🔴");
  const arrow = !prior ? "" : delta > 0 ? `(▲ +${delta} vs v${prior.version})` : delta < 0 ? `(▼ ${delta} vs v${prior.version})` : `(= vs v${prior.version})`;
  const dimLine = dims.map(x => `${x.slice(0, 4)} ${s[x]}`).join(" · ");
  const trustStr = `${trust.mean} ± ${trust.ci} (n=${trust.n}, ${trust.nIndep} indep)`;

  console.log(`\n=== REVISION-EVAL RECORD — ${node} v${version} ===`);
  if (regression) console.log(`🔴 REGRESSION ⚠️  ${drops.join(" · ")}  → log + nudge /wikiclaws-refresh to fix (NOT auto-acted)`);
  console.log(`trust: ${trustStr} · settledness: ${settled.label} (${settled.why}) · independent-survival ${indepSurvival}%`);
  console.log(`\n— Slack channel line —`);
  console.log(`${emoji} *<Title>* — *${s.verdict} ${s.overall}/5* ${arrow} · REVISION v${version} · by ${by}`);
  console.log(`\`${dimLine}\` · claims ${s.claim_ratio} · trust ${trustStr}`);
  console.log(`📄 [view node](<viewer URL>)   ← bounded markdown link, NOT a bare URL`);
  console.log(`♻️ ${survival}% survival (${indepSurvival}% independent) · re-verify only changed citations · settledness: ${settled.label} · 🧵 trajectory`);

  if (!a["no-log"]) {
    if (!existsSync(LEDGER)) seedLedger();
    const date = new Date().toISOString().slice(0, 10);
    const dimVals = dims.map(x => s[x]).join("/");
    const regCell = regression ? "🔴 " + drops.join("; ").replace(/\|/g, "/") : "no";
    const row = `| ${date} | ${node} | ${version} | ${by} | ${s.overall} | ${dimVals} | ${s.claim_ratio} | ${survival}% | ${indepSurvival}% | ${prior ? (delta >= 0 ? "+" : "") + delta : "—"} | ${trustStr} | ${settled.label} | ${vol} | ${s.verdict} | ${regCell} | ${s.hermes_overall ?? "?"}/${s.claude_overall ?? "?"} |\n`;
    appendFileSync(LEDGER, row);
    console.log(`\n✅ logged to memory/eval-history.md`);
  }
}

function seedLedger() {
  appendFileSync(LEDGER, "# Eval-lineage ledger — the trust-kernel signal (WikiTrust × EigenTrust × Beta)\n\nOne row per (node, version) eval, appended by `scripts/revision-eval.mjs record`. **Trust is OBSERVED:** survival counts only when content survives ANOTHER agent (independent-survival%); confidence tightens with independent evidence (Beta `mean ± ci`); the dual-judge + `verify.mjs` is the pre-trusted anchor. Regression is flagged, never auto-acted.\n\n| date | node | version | by | overall | dims c/t/s/cov/n/f | claim-ratio | survival% | indep-surv% | Δoverall | trust(mean±ci,n,indep) | settledness | volatility | verdict | regression | H/C |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n");
}

// ---------- dispatch ----------
(async () => {
  try {
    if (mode === "record") record();
    else await prep();
  } catch (e) { console.error("ERROR: " + (e.message || e)); process.exit(1); }
})();
