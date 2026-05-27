/**
 * lib/trust.mjs — pure trust-kernel helpers (WikiTrust × EigenTrust × Beta), no I/O.
 * Imported by revision-eval.mjs and the unit tests.
 */

// normalize a URL for citation-diff comparison (host+path, drop scheme/www/query/fragment/trailing-slash)
export const normUrl = u => String(u || "").trim().toLowerCase()
  .replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/^https?:\/\//, "").replace(/^www\./, "");

// classify citations between prior and current by normalized URL.
// claim-rebound = URL unchanged but its [[n]] marker moved onto a CHANGED line → claim changed → re-verify.
export function classifyCitations(prev, curr, changedText) {
  const prevByUrl = new Map(prev.map(c => [normUrl(c.url), c]));
  const currByUrl = new Map(curr.map(c => [normUrl(c.url), c]));
  const added = [], removed = [], unchanged = [], rebound = [];
  curr.forEach((c, i) => {
    const u = normUrl(c.url);
    if (!prevByUrl.has(u)) { added.push(c); return; }
    const idx = i + 1;   // marker index = position+1
    if (new RegExp(`\\[\\[${idx}\\]\\]`).test(changedText)) rebound.push(c);
    else unchanged.push(c);
  });
  for (const c of prev) if (!currByUrl.has(normUrl(c.url))) removed.push(c);
  return { added, removed, unchanged, rebound };
}

// Beta-style trust: mean overall + a confidence ± that tightens with independent evidence.
export function betaTrust(overalls, nIndep) {
  const n = overalls.length;
  const mean = n ? overalls.reduce((x, y) => x + y, 0) / n : 0;
  const effective = n + nIndep;                 // independents count double
  const ci = effective ? 0.8 / Math.sqrt(effective) : 0.8;
  return { mean: +mean.toFixed(2), ci: +ci.toFixed(2), n, nIndep };
}

// settledness uses CUMULATIVE independent validation (bestIndep across the lineage), not just the
// latest edit's independence — a self-revise shouldn't flip a previously-validated node to contested.
export function settledness({ churn, bestIndep, judgeGap, regression, baseline }) {
  if (baseline) return { label: "new", why: "baseline — not yet independently validated" };
  if (regression) return { label: "unstable", why: "regressed this revision" };
  if (judgeGap > 1.0 || churn >= 6) return { label: "contested", why: judgeGap > 1.0 ? "judges persistently diverge" : "high revision churn" };
  if (bestIndep >= 70 && judgeGap <= 0.5) return { label: "settled", why: "survived another agent + judges agree" };
  if (bestIndep < 50) return { label: "unproven", why: "not yet independently survived" };
  return { label: "settling", why: "improving but not yet stable" };
}
