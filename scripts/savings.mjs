#!/usr/bin/env node
/**
 * savings.mjs — measure the TOKEN SAVINGS from reusing an existing node (contribute / revise / fork)
 * instead of re-deriving from scratch. This is the "Savings" leg of the Quality × Savings ×
 * Collaboration value prop. Prints a one-line result AND appends a row to the shared ledger at
 * memory/token-savings.md (version-controlled = everyone's data accrues).
 *
 *   node scripts/savings.mjs --base <base.md> --new <new.md> [--node <id>] \
 *        [--action revise|contribute|fork|curate-merge] [--note "..."] [--no-log]
 *
 * METHOD (content proxy — an honest ESTIMATE; exact accounting needs a token-usage hook):
 *   • reused_chars = characters in lines IDENTICAL in both base and new (the part you did NOT regenerate)
 *   • new_chars    = characters in lines only in the new body (what you actually wrote this time)
 *   • tokens ≈ chars / 4   (rough English-prose ratio)
 *   • savings_pct  = reused_chars / (reused_chars + new_chars)  — fraction of the published node gotten "for free"
 *   • tokens_saved ≈ reused_chars / 4  — OUTPUT tokens avoided by not regenerating the base.
 *     (Research/input tokens saved by not re-researching are ADDITIONAL and not counted here — so this is conservative.)
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const a = (() => { const o = { _: [] }; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) v[i].startsWith("--") ? (o[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith("--") ? v[++i] : true) : o._.push(v[i]);
  return o; })();

if (!a.base || !a.new) {
  console.error('usage: savings.mjs --base <base.md> --new <new.md> [--node <id>] [--action revise|fork|contribute|curate-merge] [--note "..."] [--no-log]');
  process.exit(2);
}
const base = readFileSync(a.base, "utf8");
const next = readFileSync(a.new, "utf8");

// line-based reuse diff (multiset: a base line is "reused" once per identical new line)
const norm = s => s.replace(/\r/g, "").split("\n");
const baseLines = norm(base);
const pool = new Map();
for (const l of baseLines) pool.set(l, (pool.get(l) || 0) + 1);
let reusedChars = 0, newChars = 0;
for (const l of norm(next)) {
  if ((pool.get(l) || 0) > 0 && l.trim() !== "") { pool.set(l, pool.get(l) - 1); reusedChars += l.length; }
  else newChars += l.length;
}
const tok = c => Math.round(c / 4);
const total = reusedChars + newChars;
const pct = total ? Math.round((reusedChars / total) * 100) : 0;
const k = n => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
const action = a.action || "revise";
const tokensSaved = tok(reusedChars);

console.log(`\n♻️  Token savings (reuse vs re-derive) — ${action}${a.node ? ` · node ${a.node}` : ""}`);
console.log(`   reused ${k(reusedChars)} chars (~${k(tokensSaved)} output tokens) · new ${k(newChars)} chars (~${k(tok(newChars))} tok)`);
console.log(`   savings: ${pct}% of the published node reused → ~${k(tokensSaved)} tokens NOT re-derived.`);
console.log(`   Slack line:  ♻️ reused ~${k(tokensSaved)} tok (${pct}%) — ${action}${a.node ? ` ${a.node}` : ""}`);
console.log(`   (Conservative: counts reused OUTPUT only; research/input savings are extra. Estimate, ~4 chars/token.)`);

if (!a["no-log"]) {
  const path = fileURLToPath(new URL("../memory/token-savings.md", import.meta.url));
  if (!existsSync(path)) {
    appendFileSync(path, "# Token-savings ledger (the Savings value-prop metric)\n\nAppended by `scripts/savings.mjs` on every reuse (contribute/revise/fork/curate). Estimate: reused-output chars ÷ 4; conservative (excludes research-input savings). Sum the `tok` column for cumulative savings.\n\n| date | node | action | reused tok | reuse % | +new tok | note |\n|---|---|---|---|---|---|---|\n");
  }
  const date = new Date().toISOString().slice(0, 10);
  appendFileSync(path, `| ${date} | ${a.node || "—"} | ${action} | ${k(tokensSaved)} | ${pct}% | ${k(tok(newChars))} | ${(a.note || "").replace(/\|/g, "/")} |\n`);
  console.log(`   ✅ logged to memory/token-savings.md`);
}
