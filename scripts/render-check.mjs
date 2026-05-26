#!/usr/bin/env node
/**
 * render-check.mjs — no-browser content/structure QA for a node. Works on the Claude Code WEB
 * sandbox (only touches *.fly.dev, which is allowlisted) when Playwright can't run (the browser
 * CDN is blocked, so Chromium can't download). It does NOT check visual layout — for that you
 * need a real browser (see CLAUDE.md: bake Chromium at build + point the Playwright MCP at it).
 *
 * Usage: node scripts/render-check.mjs <nodeId|path> [more ids...]
 * Checks per node: exists · has title/type · body present & sized · ## TLDR section ·
 *   metadata.citations count · inline [[n]] markers align with citations · (best-effort) the
 *   frontend data path (/api/wv/nodes/:id) responds. Prints PASS/WARN/FAIL + the viewer URL.
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const VIEWER = process.env.WIKICLAWS_VIEWER || "https://wikiclaws-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const ids = process.argv.slice(2);
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
if (!ids.length) { console.error("usage: render-check.mjs <nodeId|path> [more...]"); process.exit(2); }

let hardFail = 0;
for (const id of ids) {
  console.log(`\n── ${id} ─────────────────────────────`);
  let node;
  try {
    const r = await fetch(`${BASE}/v1/nodes/${id}`, { headers: { "X-API-Key": KEY } });
    if (!r.ok) { console.log(`❌ FAIL — API ${r.status} fetching node (this IS a real failure: ${BASE} is allowlisted)`); hardFail++; continue; }
    node = await r.json();
  } catch (e) { console.log(`❌ FAIL — could not reach ${BASE} (${e.name}). Allowlist *.fly.dev on web.`); hardFail++; continue; }

  const m = node.metadata || {};
  const body = node.latestVersion?.content?.body || node.content?.body || "";
  const cites = m.citations || [];
  const checks = [];
  const ok = (cond, label, warnOnly = false) => checks.push({ pass: !!cond, label, warnOnly });

  ok(m.title, "has metadata.title");
  ok(node.type, `has type (${node.type || "—"})`);
  ok(body.length > 200, `body present (${body.length} chars)`);
  ok(/(^|\n)#{1,3}\s*TL;?DR/i.test(body), "has a TLDR section", true);
  ok(cites.length >= 3, `metadata.citations ≥ 3 (${cites.length})`, true);

  // inline [[n]](url) markers vs citation count (loose alignment, not exact)
  const markers = new Set([...body.matchAll(/\[\[(\d+)\]\]/g)].map(x => x[1]));
  ok(markers.size > 0, `inline [[n]] markers present (${markers.size} distinct)`, true);
  if (cites.length && markers.size) {
    const maxMarker = Math.max(...[...markers].map(Number));
    ok(maxMarker <= cites.length, `max marker [[${maxMarker}]] ≤ ${cites.length} citations`, true);
  }

  // best-effort: does the frontend data path serve it? (informational — auth/contract may vary)
  let bff = "n/a";
  try {
    const fr = await fetch(`${VIEWER}/api/wv/nodes/${node.id || id}`, { headers: { "X-API-Key": KEY } });
    bff = `${fr.status}`;
  } catch { bff = "unreachable"; }

  for (const c of checks) console.log(`  ${c.pass ? "✅" : (c.warnOnly ? "⚠️ " : "❌")} ${c.label}`);
  console.log(`  ℹ️  frontend data path /api/wv/nodes/: ${bff}`);
  const viewerPath = m.path || node.path;
  const ns = m.namespaceSlug || node.namespaceSlug || node.namespace;
  if (ns && viewerPath) console.log(`  🔗 visual check: ${VIEWER}/en/n/${ns}/p/${viewerPath}`);

  const failed = checks.filter(c => !c.pass && !c.warnOnly).length;
  const warned = checks.filter(c => !c.pass && c.warnOnly).length;
  if (failed) { console.log(`  → FAIL (${failed} hard)`); hardFail++; }
  else console.log(`  → ${warned ? `PASS with ${warned} warning(s)` : "PASS"}`);
}
console.log(`\nContent/structure QA done. ${hardFail ? `❌ ${hardFail} node(s) failed.` : "✅ all passed (structure)."}  Visual/layout QA still needs a real browser.`);
process.exit(hardFail ? 1 : 0);
