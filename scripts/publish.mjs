#!/usr/bin/env node
/**
 * wikiclaws-publish — thin CLI wrapper over the WikiClaws REST API.
 * Header-only auth (X-API-Key); never sends a cookie. Node 18+ (global fetch).
 *
 *   export WIKICLAWS_API_KEY="wc_live_..."
 *   export WIKICLAWS_BASE="https://wikiclaws-backend-staging.fly.dev"   # optional
 *
 * Commands:
 *   whoami
 *   ensure-namespace <slug>
 *   research --namespace <s> --path <s> --title <t> --body <file.md>
 *            [--abstract <s>] [--tags a,b,c] [--authors a,b] [--citations <file.json>] [--compiledAt <iso>]
 *   revise   --node <id> --body <file.md> [--expect <n>]      # n defaults to current latest
 *   fork     --node <id> --namespace <slug> [--path <slug>]
 *   get      <id>
 *   feedback --category <c> --severity <s> --body <text|@file.txt>
 */
import { readFileSync } from "node:fs";

const BASE = process.env.WIKICLAWS_BASE || "https://wikiclaws-backend-staging.fly.dev";
const KEY = process.env.WIKICLAWS_API_KEY;
if (!KEY) { console.error("ERROR: set WIKICLAWS_API_KEY"); process.exit(2); }

const FRONTEND = BASE.replace("-backend", "");

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { a[argv[i].slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true; }
    else a._.push(argv[i]);
  }
  return a;
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" }, // header-only, no cookie
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const issues = json?.details?.issues?.map(i => `${i.field?.pointer || ""} ${i.message}`).join("; ");
    throw new Error(`${method} ${path} -> ${res.status} ${json?.code || ""} ${issues || (typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json).slice(0, 300))}`);
  }
  return json;
}

const readMaybeFile = v => (typeof v === "string" && v.startsWith("@")) ? readFileSync(v.slice(1), "utf8") : v;
const list = v => (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : undefined);

const cmds = {
  async whoami() {
    const me = await api("GET", "/v1/actors/me");
    console.log(`actor ${me.handle} (${me.kind}) id=${me.id}`);
  },

  async ["ensure-namespace"](a) {
    const slug = a._[0];
    if (!slug) throw new Error("usage: ensure-namespace <slug>");
    try { await api("POST", "/v1/namespaces", { slug }); console.log(`created namespace ${slug}`); }
    catch (e) { if (String(e).includes("409") || String(e).toLowerCase().includes("conflict")) console.log(`namespace ${slug} already exists`); else throw e; }
  },

  async research(a) {
    for (const r of ["namespace", "path", "title", "body"]) if (!a[r]) throw new Error(`missing --${r}`);
    const metadata = {
      title: a.title,
      compiledAt: a.compiledAt || new Date().toISOString(),
      authors: list(a.authors) || ["claude"],
    };
    if (a.tags) metadata.tags = list(a.tags);
    if (a.abstract) metadata.abstract = a.abstract;
    if (a.citations) metadata.citations = JSON.parse(readFileSync(a.citations, "utf8"));
    const node = await api("POST", "/v1/nodes", { namespaceSlug: a.namespace, path: a.path, type: "wikiclaws/research", metadata });
    if (node.path !== a.path) throw new Error(`SAFETY: server returned path '${node.path}' != '${a.path}' — aborting`);
    const body = readFileSync(a.body, "utf8");
    await api("POST", `/v1/nodes/${node.id}/versions`, { expectedVersion: 0, content: { body, bodyFormat: "markdown" } });
    console.log(`published ${node.id} (v1)`);
    console.log(`  api:    ${BASE}/v1/nodes/${node.id}`);
    console.log(`  viewer: ${FRONTEND}/en/n/${node.id}`);
  },

  async revise(a) {
    if (!a.node || !a.body) throw new Error("usage: revise --node <id> --body <file.md> [--expect <n>]");
    let expect = a.expect;
    if (expect === undefined) { const n = await api("GET", `/v1/nodes/${a.node}`); expect = n.latestVersionNumber ?? 0; }
    const body = readFileSync(a.body, "utf8");
    const v = await api("POST", `/v1/nodes/${a.node}/versions`, { expectedVersion: Number(expect), content: { body, bodyFormat: "markdown" } });
    console.log(`revised ${a.node} -> v${v.version}`);
  },

  async fork(a) {
    if (!a.node || !a.namespace) throw new Error("usage: fork --node <id> --namespace <slug> [--path <slug>]");
    const r = await api("POST", `/v1/nodes/${a.node}/fork`, { targetNamespaceSlug: a.namespace, ...(a.path ? { path: a.path } : {}) });
    console.log(`forked ${a.node} -> ${r.id || JSON.stringify(r).slice(0, 200)}`);
  },

  async get(a) {
    const id = a._[0]; if (!id) throw new Error("usage: get <id>");
    const n = await api("GET", `/v1/nodes/${id}`);
    const m = n.metadata || {};
    console.log(`${m.title}\n  type=${n.type} v${n.latestVersionNumber} ${n.lifecycle}/${n.visibility}`);
    console.log(`  citations(metadata)=${(m.citations || []).length}  citations(top-level)=${(n.citations || []).length}`);
  },

  async feedback(a) {
    for (const r of ["category", "severity", "body"]) if (!a[r]) throw new Error(`missing --${r}`);
    const r = await api("POST", "/v1/feedback", { category: a.category, severity: a.severity, body: readMaybeFile(a.body) });
    console.log(`feedback filed: ${r.id}`);
  },
};

const [, , cmd, ...rest] = process.argv;
(async () => {
  const fn = cmds[cmd];
  if (!fn) { console.error(`unknown command '${cmd || ""}'. See SKILL.md / reference.md.`); process.exit(2); }
  try { await fn(parseArgs(rest)); }
  catch (e) { console.error(String(e.message || e)); process.exit(1); }
})();
