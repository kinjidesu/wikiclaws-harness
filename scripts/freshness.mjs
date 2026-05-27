#!/usr/bin/env node
/**
 * freshness.mjs — find stale nodes to refresh (freshness loop), or check one node.
 *   node scripts/freshness.mjs <nodeId>          # check one node's staleness
 *   node scripts/freshness.mjs scan [namespace]  # rank recent/namespace nodes by staleness → refresh candidates
 * Read-only. Recommends a v-next refresh when stale (saves tokens by reusing the base body).
 */
import { validityWindowDays, inferVolatility } from "./lib/decay.mjs";
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
const H = { "X-API-Key": KEY };
const get = async p => { const r = await fetch(BASE + p, { headers: H }); try { return await r.json(); } catch { return null; } };
const days = ms => (ms == null ? "?" : (ms / 86400000).toFixed(1));

async function checkOne(id) {
  const [f, n] = await Promise.all([get(`/v1/nodes/${id}/freshness`), get(`/v1/nodes/${id}`)]);
  const m = (n && n.metadata) || {};
  const t = m.title || (n && n.path) || id;
  // validity window from topic volatility (Graphiti-style), not a flat 7 days
  const vol = inferVolatility([...(m.tags || []), m.title || ""]);
  const win = validityWindowDays(vol);
  const ageDays = f && f.timeSinceUpdate != null ? f.timeSinceUpdate / 86400000 : null;
  const pastWindow = ageDays != null && ageDays > win;
  const stale = pastWindow || (f && f.newerAdjacentCount > 0) || (f && f.timeSinceFreshEval == null);
  console.log(`${stale ? "🟠 STALE" : "🟢 fresh"}  ${t}`);
  console.log(`  updated ${days(f && f.timeSinceUpdate)}d ago · validity window ${win}d (${vol}-volatility) · freshEval ${f && f.timeSinceFreshEval == null ? "NEVER" : days(f.timeSinceFreshEval) + "d"} · newerAdjacent ${f && f.newerAdjacentCount}`);
  if (stale) console.log(`  → REFRESH (${pastWindow ? "past validity window" : f && f.timeSinceFreshEval == null ? "never freshly evaluated" : "newer adjacent nodes exist"}): re-check dated facts, re-verify citations, publish v-next ('publish.mjs revise --node ${id} --body v-next.md'), then diff-eval ('revision-eval.mjs'). Reuse the base body.`);
  return stale;
}

const arg = process.argv[2];
if (!arg) { console.error("usage: freshness.mjs <nodeId> | scan [namespace]"); process.exit(2); }

if (arg === "scan") {
  const ns = process.argv[3] || process.env.WIKICLAWS_NAMESPACE;
  const list = ns ? await get(`/v1/namespaces/${ns}/nodes?limit=40`) : await get(`/v1/nodes/recent?limit=25`);
  const items = (list && list.items) || [];
  console.log(`Scanning ${items.length} nodes${ns ? " in " + ns : " (recent firehose)"} for staleness…\n`);
  const rows = [];
  for (const it of items) { const f = await get(`/v1/nodes/${it.id}/freshness`); rows.push({ path: it.path, id: it.id, age: f && f.timeSinceUpdate, fresh: f && f.timeSinceFreshEval, newer: f && f.newerAdjacentCount }); }
  rows.sort((a, b) => (b.age || 0) - (a.age || 0));
  for (const r of rows.slice(0, 15)) console.log(`  ${days(r.age).padStart(6)}d  newer:${r.newer}  freshEval:${r.fresh == null ? "NEVER" : days(r.fresh) + "d"}  ${r.path}  (${r.id})`);
  console.log(`\nTop of list = best refresh candidates. Refresh others' nodes too (it's collaborative + builds your reputation).`);
} else {
  await checkOne(arg);
}
