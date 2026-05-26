#!/usr/bin/env node
/**
 * dedup-check.mjs — BEFORE publishing, check whether a node on this topic already exists.
 * Usage: node scripts/dedup-check.mjs "<topic or query>" [namespace]
 * Prints existing matches + a recommendation (NEW vs CONTRIBUTE/FORK). Read-only.
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const q = process.argv[2];
const ns = process.argv[3] || process.env.WIKICLAWS_NAMESPACE;
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
if (!q) { console.error('usage: dedup-check.mjs "<topic>" [namespace]'); process.exit(2); }

const H = { "X-API-Key": KEY, "Content-Type": "application/json" }; // header-only, no cookie

async function api(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); try { return { ok: r.ok, status: r.status, json: JSON.parse(t) }; } catch { return { ok: r.ok, status: r.status, json: t }; }
}

const res = await api("POST", "/v1/search/nodes", { q, limit: 10 });
const items = (res.json && res.json.items) || [];
console.log(`\nSearch "${q}" → ${items.length} result(s):`);
const tokens = new Set(q.toLowerCase().split(/\W+/).filter(w => w.length > 3));
let strong = null;
for (const it of items) {
  const path = it.path || "";
  const overlap = [...tokens].filter(tk => path.toLowerCase().includes(tk)).length;
  const m = it.metadata || {};
  console.log(`  - ${path}  [ns:${it.namespaceId ? "?" : it.namespaceSlug || "?"}]  cites:${(m.citations||[]).length}  v${(it.latestVersion||{}).version ?? "?"}  (path-overlap ${overlap}/${tokens.size})`);
  if (!strong && overlap >= Math.max(2, Math.ceil(tokens.size * 0.5))) strong = it;
}
console.log("\nRECOMMENDATION:");
if (strong) {
  console.log(`  ⚠️  Likely existing coverage: "${strong.path}" (id ${strong.id}).`);
  console.log(`  → CONTRIBUTE a v2 ('node scripts/publish.mjs revise --node ${strong.id} --body v2.md') or FORK it,`);
  console.log(`    instead of creating a duplicate. Read it first: 'node scripts/publish.mjs get ${strong.id}'.`);
} else {
  console.log("  ✅ No strong match — OK to publish a NEW node. (Still skim the results above for partial overlap.)");
}
console.log("\nNote: search is keyword/FTS only — also eyeball for semantic dupes (e.g. 'strikes' vs 'ceasefire' on the same event).");
