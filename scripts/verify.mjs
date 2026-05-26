#!/usr/bin/env node
/**
 * verify.mjs — the ground-truth leg of the eval. Fetches every cited URL of a node and reports
 * reachable/unreachable + a text snippet, so the AGENT can judge entailment (does the source
 * actually support the claim?). Read-only. Usage: node scripts/verify.mjs <nodeId>
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const id = process.argv[2];
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
if (!id) { console.error("usage: verify.mjs <nodeId>"); process.exit(2); }

const node = await (await fetch(`${BASE}/v1/nodes/${id}`, { headers: { "X-API-Key": KEY } })).json();
const m = node.metadata || {};
const cites = m.citations || [];   // NOTE: read metadata.citations, NOT top-level .citations (which is 0)
console.log(`\nNode: ${m.title || node.path}  (v${node.latestVersionNumber ?? "?"})`);
console.log(`Citations in metadata: ${cites.length}  (top-level .citations: ${(node.citations||[]).length} — known bug, ignore)\n`);

let ok = 0, unreachable = 0;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; WikiClawsVerify/1.0)" };
async function head(url) {
  for (const u of [url, `https://web.archive.org/web/2026/${url}`]) {   // fall back to Wayback on block
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(u, { headers: UA, redirect: "follow", signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const txt = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200); return { status: r.status, via: u === url ? "direct" : "wayback", snippet: txt }; }
      if (u === url) continue;   // try wayback
      return { status: r.status, via: "wayback", snippet: "" };
    } catch (e) { if (u === url) continue; return { status: "ERR", via: "wayback", snippet: String(e.name) }; }
  }
  return { status: "BLOCKED", via: "none", snippet: "" };
}

for (let i = 0; i < cites.length; i++) {
  const c = cites[i];
  const r = await head(c.url);
  const reach = (typeof r.status === "number" && r.status < 400);
  if (reach) ok++; else unreachable++;
  console.log(`[${i + 1}] ${reach ? "✅" : "⚠️ "} ${r.status} (${r.via}) ${c.sourceQuality || "?"} — ${c.url}`);
  if (reach && r.snippet) console.log(`      ↳ ${r.snippet}`);
}
console.log(`\nReachable ${ok}/${cites.length}; unreachable ${unreachable} (mark those 'unverifiable', not 'verified').`);
console.log("Now judge ENTAILMENT per claim against these snippets/sources, then compute claim-verified ratio (verified/total).");
