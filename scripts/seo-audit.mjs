#!/usr/bin/env node
/**
 * seo-audit.mjs — audit a node's page for AEO/SEO/EEAT citability and turn the PRODUCT gaps into
 * structured feedback. The harness can't change WikiClaws's frontend code, but it CAN measure what
 * stops crawlers + AI answer engines from parsing/citing a node, and file it (the existing feedback
 * loop). Distribution can't compound on pages AI can't read — so these gaps are growth-blocking.
 *
 *   node scripts/seo-audit.mjs <nodeId|path> [more...] [--feedback] [--json]
 *
 * Checks (per node): JSON-LD Article schema · self-referential canonical (flags the prod-pointer bug) ·
 *   og:title/description/image · twitter:card · article:published_time/modified_time · a quotable
 *   answer in the first ~150 words · author/date in the .md shadow (EEAT) · sitemap membership ·
 *   robots.txt AI-crawler allowance. Works on the web sandbox (only touches allowlisted *.fly.dev).
 *   --feedback files each PRODUCT gap via POST /v1/feedback, deduped against memory/bug-registry.md.
 *
 * Exit: 0 = all checks pass, 1 = ≥1 hard FAIL (a real gap). Read-only except the optional feedback POST.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const VIEWER = process.env.WIKICLAWS_VIEWER || BASE.replace("-backend", "");
const KEY = process.env.WIKICLAWS_API_KEY; // reads are public; key only needed for --feedback (POST)
const BUG_REGISTRY = fileURLToPath(new URL("../memory/bug-registry.md", import.meta.url));

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    else a._.push(argv[i]);
  }
  return a;
}
const a = parseArgs(process.argv.slice(2));
if (!a._.length) { console.error("usage: seo-audit.mjs <nodeId|path> [more...] [--feedback] [--json]"); process.exit(2); }

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (KEY) headers["X-API-Key"] = KEY;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${typeof j === "string" ? j.slice(0, 200) : JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function getText(url) { try { const r = await fetch(url, { redirect: "follow" }); return { status: r.status, text: r.ok ? await r.text() : "" }; } catch (e) { return { status: `ERR:${e.name}`, text: "" }; }
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function metaContent(html, key) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc(key)}["'][^>]*>`, "i"))?.[0];
  return tag ? (tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : null;
}
function linkHref(html, rel) {
  const tag = html.match(new RegExp(`<link[^>]+rel=["']${esc(rel)}["'][^>]*>`, "i"))?.[0];
  return tag ? (tag.match(/href=["']([^"']*)["']/i)?.[1] ?? null) : null;
}
function jsonLdTypes(html) {
  const types = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const o = JSON.parse(m[1].trim()); for (const n of [].concat(o["@graph"] || o)) if (n && n["@type"]) types.push([].concat(n["@type"]).join("/")); } catch { /* malformed */ }
  }
  return types;
}
function firstParaWords(md) {
  const body = md.replace(/^---[\s\S]*?---\s*/m, "").replace(/^#.*$/gm, "").trim();
  const para = body.split(/\n\s*\n/).map(s => s.trim()).find(s => s && !s.startsWith("```")) || "";
  return para.replace(/\[\[?\d+\]?\]\([^)]*\)/g, "").split(/\s+/).filter(Boolean).length;
}

// PRODUCT gaps → feedback (signature is used for bug-registry dedup).
const GAP = {
  jsonld:   { sig: "JSON-LD", category: "discovery", severity: "friction", body: u => `AEO/SEO gap: node pages have NO JSON-LD structured data. Audited ${u} — no <script type="application/ld+json">. This blocks Google rich results and structured extraction by AI answer engines (ChatGPT/Perplexity/AI Overviews). Add Article schema (headline, author as Person, datePublished, dateModified, mainEntityOfPage) + Organization on home + Person on author pages.` },
  canonical:{ sig: "canonical", category: "bug", severity: "friction", body: (u, h) => `SEO bug: ${u} has <link rel="canonical" href="${h}"> — it points away from the page itself (prod/home), not self-referential to this node. Crawlers consolidate ranking signals to the wrong URL or drop the page. Canonical should be the node's own URL.` },
  articletime:{ sig: "article:published_time", category: "discovery", severity: "polish", body: u => `Freshness gap: ${u} has no <meta property="article:published_time"/"article:modified_time">. compiledAt/updatedAt are known — emit them as article:* meta (and JSON-LD datePublished/dateModified). Powers Google News + AI-citation freshness.` },
  feed:     { sig: "RSS", category: "feature", severity: "polish", body: () => `Discovery gap: no RSS/JSON feed is discoverable (<link rel="alternate" type="application/rss+xml">). Feeds drive aggregator + AI-crawler discovery of fresh nodes. Add /feed.xml and per-namespace feeds.` },
};

(async () => {
  // Site-wide fetches (once).
  const robots = await getText(`${VIEWER}/robots.txt`);
  const sitemap = await getText(`${VIEWER}/sitemap.xml`);
  const aiCrawlersOK = /GPTBot|ClaudeBot|PerplexityBot|anthropic-ai/i.test(robots.text);

  const gapsToFile = new Map(); // sig -> body (dedup within this run)
  let hardFail = 0;
  const report = [];

  for (const id of a._) {
    const out = { id, checks: [] };
    const ok = (pass, label, warnOnly = false, gap = null) => out.checks.push({ pass: !!pass, label, warnOnly, gap });
    let node; try { node = await api("GET", `/v1/nodes/${id}`); }
    catch (e) { out.error = String(e.message || e); report.push(out); hardFail++; continue; }

    const m = node.metadata || {};
    const ns = m.namespaceSlug || node.namespaceSlug || node.namespace;
    const path = m.path || node.path;
    out.viewer = ns && path ? `${VIEWER}/en/n/${ns}/p/${path}` : null;
    const html = out.viewer ? (await getText(out.viewer)).text : "";
    const md = out.viewer ? (await getText(out.viewer + ".md")).text : "";

    if (!html) { ok(false, `viewer page reachable (${out.viewer || "no path"})`); report.push(out); hardFail++; continue; }

    // JSON-LD Article (PRODUCT gap)
    const types = jsonLdTypes(html);
    const hasArticle = types.some(t => /Article|NewsArticle|CreativeWork|Report/i.test(t));
    ok(hasArticle, `JSON-LD Article schema (${types.join(", ") || "none"})`, false, hasArticle ? null : GAP.jsonld);

    // canonical self-referential (PRODUCT bug)
    const canon = linkHref(html, "canonical");
    const selfCanon = canon && path && canon.includes(path);
    ok(selfCanon, `canonical self-referential (${canon || "absent"})`, false, selfCanon ? null : { ...GAP.canonical, body: u => GAP.canonical.body(u, canon || "absent") });

    // OG + twitter (these exist — confirm)
    ok(metaContent(html, "og:title") != null, "og:title present", true);
    ok(metaContent(html, "og:description") != null, "og:description present", true);
    ok(metaContent(html, "og:image") != null, "og:image present (social unfurl)", true);
    ok(metaContent(html, "twitter:card") != null, "twitter:card present", true);

    // article:* time (PRODUCT gap)
    const hasPub = metaContent(html, "article:published_time") != null || metaContent(html, "article:modified_time") != null;
    ok(hasPub, "article:published_time / modified_time", false, hasPub ? null : GAP.articletime);

    // quotable answer in the first ~150 words (CONTENT — citability skill fixes)
    const words = md ? firstParaWords(md) : 0;
    ok(words >= 20 && words <= 80, `quotable lead answer 20–80 words (${words || "?"})`, true);
    ok(/(^|\n)#{1,3}\s*TL;?DR/i.test(md || html), "TL;DR / direct answer block", true);

    // EEAT from the .md shadow
    ok(/\nauthor:/i.test(md), "author named (.md frontmatter)", true);
    ok(/\n(published|updated):/i.test(md), "published/updated date (.md)", true);

    // sitemap membership + AI-crawler allowance (site-wide)
    ok(path && sitemap.text.includes(path), `in sitemap.xml`, true);
    ok(aiCrawlersOK, "robots.txt allows AI crawlers (GPTBot/ClaudeBot/PerplexityBot)", true);

    // RSS feed discovery (PRODUCT gap) — require a real feed MIME type, not just an hreflang alternate
    const hasFeed = /<link[^>]+type=["']application\/(rss\+xml|atom\+xml|feed\+json)["']/i.test(html);
    ok(hasFeed, "RSS/feed discovery link", false, hasFeed ? null : GAP.feed);

    for (const c of out.checks) if (c.gap) gapsToFile.set(c.gap.sig, c.gap.body(out.viewer));
    if (out.checks.some(c => !c.pass && !c.warnOnly)) hardFail++;
    report.push(out);
  }

  // Optional: file the product gaps as feedback, deduped vs the bug registry.
  let filed = [];
  if (a.feedback && !KEY) console.log(`\n⚠️  --feedback needs WIKICLAWS_API_KEY to POST; skipping filing (audit ran read-only). Set the key to file the gaps below.`);
  if (a.feedback && KEY && gapsToFile.size) {
    const registry = existsSync(BUG_REGISTRY) ? readFileSync(BUG_REGISTRY, "utf8") : "";
    for (const [sig, body] of gapsToFile) {
      if (registry.includes(sig)) { filed.push({ sig, status: "already-known (bug-registry)" }); continue; }
      const g = Object.values(GAP).find(x => x.sig === sig) || { category: "discovery", severity: "friction" };
      try { const r = await api("POST", "/v1/feedback", { category: g.category, severity: g.severity, body }); filed.push({ sig, id: r.id }); }
      catch (e) { filed.push({ sig, error: String(e.message || e) }); }
    }
  }

  if (a.json) { console.log(JSON.stringify({ report, gaps: [...gapsToFile.keys()], filed, aiCrawlersOK }, null, 2)); process.exit(hardFail ? 1 : 0); }

  for (const o of report) {
    console.log(`\n── ${o.id} ${o.viewer ? "· " + o.viewer : ""} ─────────`);
    if (o.error) { console.log(`  ❌ ${o.error}`); continue; }
    for (const c of o.checks) console.log(`  ${c.pass ? "✅" : (c.warnOnly ? "⚠️ " : "❌")} ${c.label}${c.gap && !c.pass ? "  → product gap" : ""}`);
  }
  if (gapsToFile.size) {
    console.log(`\nPRODUCT gaps (frontend — file as feedback; the harness can't fix these in code):`);
    for (const sig of gapsToFile.keys()) console.log(`  • ${sig}`);
    if (a.feedback) for (const f of filed) console.log(`    ${f.sig}: ${f.id ? "filed " + f.id : f.status || f.error}`);
    else console.log(`  → re-run with --feedback to file them (deduped vs memory/bug-registry.md).`);
  }
  console.log(`\nContent gaps (⚠️) are fixable by the wikiclaws-citability skill (revise the node). ${hardFail ? `❌ ${hardFail} node(s) have a hard gap.` : "✅ no hard gaps."}`);
  process.exit(hardFail ? 1 : 0);
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
