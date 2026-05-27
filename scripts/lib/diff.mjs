/**
 * lib/diff.mjs — shared, dependency-free helpers for the reuse/survival diff.
 * Single source of truth for both savings.mjs (token savings) and revision-eval.mjs
 * (content-survival %, the WikiTrust signal). No side effects; safe to import.
 */

/**
 * Multiset line-reuse diff: a base line counts as "reused" once per identical new line.
 * Returns reused/new char + line counts, survival%, and the new/changed lines (judge context).
 */
export function lineReuse(baseText, newText) {
  const norm = s => String(s).replace(/\r/g, "").split("\n");
  const pool = new Map();
  for (const l of norm(baseText)) pool.set(l, (pool.get(l) || 0) + 1);
  let reusedChars = 0, newChars = 0, reusedLines = 0, newLines = 0;
  const changed = [];
  for (const l of norm(newText)) {
    if ((pool.get(l) || 0) > 0 && l.trim() !== "") { pool.set(l, pool.get(l) - 1); reusedChars += l.length; reusedLines++; }
    else { newChars += l.length; newLines++; if (l.trim() !== "") changed.push(l); }
  }
  const total = reusedChars + newChars;
  const survivalPct = total ? Math.round((reusedChars / total) * 100) : 0;
  return { reusedChars, newChars, reusedLines, newLines, survivalPct, changed };
}

/** rough English-prose token estimate */
export const estTokens = chars => Math.round(chars / 4);

/** human-friendly thousands ("3.1k", "29") */
export const k = n => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
