#!/usr/bin/env node
/**
 * verify.mjs — the ground-truth leg of the eval. Fetches a node's cited URLs so the AGENT can
 * judge entailment. Read-only. Two modes:
 *
 *   node scripts/verify.mjs <nodeId>                      # REACHABILITY: is each citation live?
 *   node scripts/verify.mjs <nodeId> --claims claims.json # SAFE-style: per-atomic-claim scaffold
 *
 * SAFE mode (Search-Augmented Factuality Evaluator, DeepMind/Stanford NeurIPS'24): you decompose
 * the body into ATOMIC CLAIMS up front and pass them as claims.json — an array of
 *   { "claim": "<one factual claim>", "cites": [1,3] }   // 1-based [[n]] citation indices
 * The script fetches each cited source and prints, per claim, the source text excerpt around the
 * claim's keywords — so you label each claim supported|contradicted|unsupported|irrelevant and
 * compute PRECISION = supported / (supported + contradicted + unsupported).
 */
const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
const id = process.argv[2];
const claimsArg = (i => i >= 0 ? process.argv[i + 1] : null)(process.argv.indexOf("--claims"));
if (!KEY) { console.error("set WIKICLAWS_API_KEY"); process.exit(2); }
if (!id || id.startsWith("--")) { console.error("usage: verify.mjs <nodeId> [--claims claims.json]"); process.exit(2); }

const node = await (await fetch(`${BASE}/v1/nodes/${id}`, { headers: { "X-API-Key": KEY } })).json();
const m = node.metadata || {};
const cites = m.citations || [];   // NOTE: read metadata.citations, NOT top-level .citations (which is 0)
console.log(`\nNode: ${m.title || node.path}  (v${node.latestVersionNumber ?? "?"})`);
console.log(`Citations in metadata: ${cites.length}  (top-level .citations: ${(node.citations||[]).length} — known bug, ignore)\n`);

const UA = { "User-Agent": "Mozilla/5.0 (compatible; WikiClawsVerify/1.0)" };
async function fetchText(url, maxChars = 200) {
  for (const u of [url, `https://web.archive.org/web/2026/${url}`]) {   // fall back to Wayback on block
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(u, { headers: UA, redirect: "follow", signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const txt = (await r.text())
          .replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")   // drop boilerplate block CONTENTS first
          .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ").trim().slice(0, maxChars);
        return { status: r.status, via: u === url ? "direct" : "wayback", text: txt };
      }
      if (u === url) continue;
      return { status: r.status, via: "wayback", text: "" };
    } catch (e) { if (u === url) continue; return { status: "ERR", via: "wayback", text: String(e.name) }; }
  }
  return { status: "BLOCKED", via: "none", text: "" };
}

const STOP = new Set("the a an and or of to in on for with that this from have has are were was will would about into over than then them they其".split(/\s+/));
function excerpt(text, claim, win = 320) {
  if (!text) return "";
  const kws = [...new Set((claim.toLowerCase().match(/[a-z0-9]{5,}/g) || []).filter(w => !STOP.has(w)))];
  const lc = text.toLowerCase();
  for (const kw of kws) { const i = lc.indexOf(kw); if (i >= 0) return "…" + text.slice(Math.max(0, i - win / 2), i + win / 2).trim() + "…"; }
  return text.slice(0, win) + "… (claim keywords NOT found in source → likely unsupported/irrelevant)";
}

if (claimsArg) {
  // ---- SAFE-style per-claim scaffold ----
  const { readFileSync } = await import("node:fs");
  const claims = JSON.parse(readFileSync(claimsArg, "utf8"));
  const cache = new Map();   // citationIndex -> fetched {status,via,text}
  const need = [...new Set(claims.flatMap(c => c.cites || []))];
  for (const idx of need) { const c = cites[idx - 1]; if (c) cache.set(idx, await fetchText(c.url, 4000)); }
  const reachable = [...cache.values()].filter(r => typeof r.status === "number" && r.status < 400).length;
  console.log(`SAFE atomic-claim scaffold — ${claims.length} claims, ${need.length} distinct citations fetched (${reachable}/${need.length} reachable)\n`);
  claims.forEach((cl, i) => {
    console.log(`[claim ${i + 1}] ${cl.claim}`);
    for (const idx of (cl.cites || [])) {
      const c = cites[idx - 1]; const r = cache.get(idx);
      if (!c) { console.log(`   [[${idx}]] ⚠️ no such citation index`); continue; }
      const reach = r && typeof r.status === "number" && r.status < 400;
      console.log(`   [[${idx}]] ${reach ? "✅" : "⚠️ " + (r?.status ?? "?")} (${r?.via ?? "?"}) ${c.url}`);
      if (reach) console.log(`        ↳ ${excerpt(r.text, cl.claim)}`);
    }
    console.log(`   → label: supported | contradicted | unsupported | irrelevant\n`);
  });
  console.log("PRECISION = supported / (supported + contradicted + unsupported).  Report it alongside the claim-verified ratio.");
  console.log("If reachable is ~0, you're on the web sandbox — re-fetch via your WebFetch/WebSearch TOOLS (they bypass the allowlist) and label 'verified-via-tool-fetch'.");
  console.log("Honesty: a claim whose keywords aren't in the source is NOT 'supported'; an unreachable source is 'unverifiable', never 'verified'.");
} else {
  // ---- reachability mode (default) ----
  let ok = 0, unreachable = 0;
  for (let i = 0; i < cites.length; i++) {
    const c = cites[i];
    const r = await fetchText(c.url, 200);
    const reach = (typeof r.status === "number" && r.status < 400);
    if (reach) ok++; else unreachable++;
    console.log(`[${i + 1}] ${reach ? "✅" : "⚠️ "} ${r.status} (${r.via}) ${c.sourceQuality || "?"} — ${c.url}`);
    if (reach && r.text) console.log(`      ↳ ${r.text}`);
  }
  console.log(`\nReachable ${ok}/${cites.length}; unreachable ${unreachable} (mark those 'unverifiable', not 'verified').`);
  if (cites.length && ok === 0) {
    console.log(`\n⚠️  0/${cites.length} reachable — almost certainly the Claude Code WEB sandbox blocking the`);
    console.log(`   container's outbound network (allowlist), NOT dead links. DO NOT report these unverified.`);
    console.log(`   → Re-fetch each URL with your WebFetch tool (+ WebSearch for the claim), which bypasses the`);
    console.log(`     sandbox; judge entailment from that and label 'verified-via-tool-fetch'.`);
  }
  console.log("\nNext: decompose the body into ATOMIC CLAIMS and re-run with --claims claims.json for per-claim precision (SAFE-style).");
  console.log("Label the METHOD honestly: 'verified-via-refetch' · 'verified-via-tool-fetch' · 'verified-via-search' (URL not re-fetched) · 'unverifiable'. Never claim a reachability you didn't have.");
}
