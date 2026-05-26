#!/usr/bin/env node
/**
 * curate.mjs — find near-duplicate clusters on a topic and recommend a canonical + supersedes edges.
 *   node scripts/curate.mjs "<topic>"
 * Read-only (recommends). The platform has NO semantic dedup, so curation keeps the graph clean.
 * To act: improve the canonical (publish.mjs revise) and point dupes at it (graph-link link --type supersedes).
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const q = process.argv[2];
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
if (!q) { console.error('usage: curate.mjs "<topic>"'); process.exit(2); }
const H = { "X-API-Key": KEY, "Content-Type": "application/json" };

const res = await (await fetch(BASE + "/v1/search/nodes", { method: "POST", headers: H, body: JSON.stringify({ q, limit: 12 }) })).json();
const items = (res.items || []);
const enriched = [];
for (const it of items) {
  const n = await (await fetch(`${BASE}/v1/nodes/${it.id}`, { headers: H })).json();
  const m = n.metadata || {};
  enriched.push({ path: it.path, id: it.id, cites: (m.citations || []).length, v: n.latestVersionNumber ?? 0, updated: n.updatedAt });
}
console.log(`\nCluster for "${q}" — ${enriched.length} candidate(s):`);
enriched.forEach(e => console.log(`  - ${e.path}  cites:${e.cites}  v${e.v}  updated:${(e.updated||'').slice(0,10)}  (${e.id})`));
if (enriched.length <= 1) { console.log("\n✅ No cluster — nothing to consolidate."); process.exit(0); }
// canonical = most citations, then highest version, then most recent
const canonical = [...enriched].sort((a, b) => b.cites - a.cites || b.v - a.v || (b.updated || "").localeCompare(a.updated || ""))[0];
console.log(`\nRECOMMENDED CANONICAL: ${canonical.path} (${canonical.id}) — best-sourced/most-developed.`);
console.log("Consolidate the rest INTO it:");
for (const e of enriched) {
  if (e.id === canonical.id) continue;
  console.log(`  • Merge any unique facts from "${e.path}" into the canonical (publish.mjs revise --node ${canonical.id}), then:`);
  console.log(`    node scripts/graph-link.mjs link --from ${e.id} --to ${canonical.id} --type supersedes`);
}
console.log("\n⚠️ Don't delete others' nodes — supersede + point at the canonical (provenance preserved).");
