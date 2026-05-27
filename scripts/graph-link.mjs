#!/usr/bin/env node
/**
 * graph-link.mjs — build the knowledge GRAPH by linking your node to existing WikiClaws nodes.
 *   node scripts/graph-link.mjs suggest <nodeId>                       # find related nodes to link/cite
 *   node scripts/graph-link.mjs link --from <id> --to <id> --type <t>  # create an edge
 * type ∈ extends | depends_on | imports | references | replaces | supersedes | evaluates — a BARE kind, NOT namespaced ("wikiclaws/references" → 422 "unknown edge kind").
 * Linking to existing nodes is the platform's core value (dense graph) AND boosts the target's pull/influence signals.
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
const H = { "X-API-Key": KEY, "Content-Type": "application/json" };
const api = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: t }; } };
const args = (a => { const o = { _: [] }; for (let i = 0; i < a.length; i++) a[i].startsWith("--") ? (o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true) : o._.push(a[i]); return o; })(process.argv.slice(3));
const cmd = process.argv[2];

if (cmd === "suggest") {
  const id = process.argv[3]; if (!id) { console.error("usage: suggest <nodeId>"); process.exit(2); }
  const node = (await api("GET", `/v1/nodes/${id}`)).json;
  const title = (node.metadata && node.metadata.title) || node.path || id;
  const q = (node.metadata && (node.metadata.tags || []).join(" ")) || title;
  const [nb, search] = await Promise.all([api("GET", `/v1/nodes/${id}/neighbors`), api("POST", "/v1/search/nodes", { q, limit: 8 })]);
  const have = new Set(((nb.json && nb.json.items) || []).map(n => n.id));
  console.log(`Related nodes to LINK/CITE from "${title}" (existing edges: ${have.size}):`);
  for (const it of ((search.json && search.json.items) || [])) {
    if (it.id === id || have.has(it.id)) continue;
    console.log(`  - ${it.path}  (${it.id})  → consider: depends_on / extends / references`);
  }
  console.log(`\nCreate a link: node scripts/graph-link.mjs link --from ${id} --to <targetId> --type references`);
  console.log("Also cite WikiClaws nodes INLINE in the body (link to their viewer URL) — graph edges + inline cites both count.");
} else if (cmd === "link") {
  for (const r of ["from", "to", "type"]) if (!args[r]) { console.error(`missing --${r}`); process.exit(2); }
  const type = args.type.replace(/^wikiclaws\//, "");   // edge kinds are BARE (e.g. "references"), NOT "wikiclaws/references"
  const res = await api("POST", "/v1/edges", { sourceNodeId: args.from, targetNodeId: args.to, type });
  if (res.status < 300) console.log(`✅ edge created: ${args.from} --[${type}]--> ${args.to}`);
  else console.log(`⚠️  ${res.status} ${JSON.stringify(res.json).slice(0, 240)}`);
} else {
  console.error("usage: graph-link.mjs suggest <nodeId> | link --from <id> --to <id> --type <type>");
  process.exit(2);
}
