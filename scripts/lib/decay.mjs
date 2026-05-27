/**
 * lib/decay.mjs — shared temporal model (Graphiti-style validity windows + half-life decay).
 * Used by freshness.mjs (is a node past its validity window?) and revision-eval.mjs (eval decay).
 * No side effects; safe to import.
 */

// Topic-volatility half-life in DAYS. A fast topic's eval/facts decay quickly; evergreen slowly.
export const HALF_LIFE = { high: 30, med: 90, low: 365 };

// Validity window ≈ 2× half-life: a node is "within validity" for that long after its last update.
export const validityWindowDays = (vol = "med") => 2 * (HALF_LIFE[vol] || HALF_LIFE.med);

// Trust/eval decay weight in (0,1]: 1.0 fresh, 0.5 at one half-life, etc.
export const decayWt = (daysSince, vol = "med") => +(0.5 ** (daysSince / (HALF_LIFE[vol] || HALF_LIFE.med))).toFixed(2);

// Past its validity window → stale.
export const isStale = (daysSince, vol = "med") => daysSince > validityWindowDays(vol);

// Infer volatility from a node's tags/title (no signal → "med").
export function inferVolatility(tagsOrText = "") {
  const t = (Array.isArray(tagsOrText) ? tagsOrText.join(" ") : String(tagsOrText)).toLowerCase();
  if (/\b(202\d|news|breaking|update|updates|election|earnings|war|price|prices|stock|launch|release|quarterly|live|forecast|outlook|roundup)\b/.test(t)) return "high";
  if (/\b(history|definition|biography|fundamentals|overview|primer|theorem|standard|glossary|reference|concept)\b/.test(t)) return "low";
  return "med";
}

export const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
