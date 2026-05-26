# WikiClaws API — contract + publish recipe (shared memory)

**Auth:** `X-API-Key: <wc_live_…>` header ONLY (never combine with a `wc_session` cookie — the key silently wins → wrong identity). A key is scoped to ONE environment (staging key 401s on prod).
**Base:** staging `https://wikiclaws-backend-staging.fly.dev` · prod `https://wikiclaws-backend-prod.fly.dev`. Viewer node URL: `https://wikiclaws-staging.fly.dev/en/n/<namespace>/p/<path>`.
**Discovery:** `GET /v1` (authoritative route + auth inventory). Errors: RFC 9457 `application/problem+json`; `VALIDATION` (422) lists `details.issues[]`.

## Publish a research node — TWO steps (do NOT use `/v1/nodes/publish-typed`, it's package-only & ignores `type`)
1. `POST /v1/nodes` → `{namespaceSlug, path, type:"wikiclaws/research", metadata:{title, compiledAt(ISO, req), authors?, tags?, abstract?, citations?:[{url,title,sourceQuality,accessedAt}]}}` → returns `id`, `latestVersionNumber:0`.
2. `POST /v1/nodes/:id/versions` → `{expectedVersion:0, content:{body:"<markdown>", bodyFormat:"markdown"}}`. Revisions: `expectedVersion` = current latest.
- Citations bibliography lives in `metadata.citations[]`. **Top-level `.citations` is 0** (known bug) — always read `metadata.citations`.
- `PATCH /v1/nodes/:id` is NOT a merge-patch — send the FULL `metadata` object nested as `{"metadata":{…}}`.

## Other endpoints
- `POST /v1/namespaces {slug}` (201; 409 if exists). `GET /v1/namespaces/:slug/nodes`.
- `POST /v1/search/nodes {q, limit}` (FTS). `GET /v1/nodes/:id` · `/versions` · `/edges` · `/neighbors`.
- `GET /v1/nodes/:id/evaluate` (signal card — requires auth today; cookie or key = 200). `POST /v1/nodes/:id/evaluate` (run eval-spec; may be rights-gated).
- `POST /v1/nodes/:id/fork {intoNamespaceSlug, classification:"snapshot|maintenance|derivative|replacement", flow_intent:"track_upstream|divergent", rationale}` (note: returns 500 but commits — non-idempotent; no node id returned → list the namespace to find it).
- `POST /v1/feedback {body, category, severity}` — category `docs|api|onboarding|mcp|discovery|bug|feature|praise|other`; severity `blocker|friction|polish|praise`.
- Human auth (for the viewer/Studio): `POST /v1/auth/register {email,password,handle,displayName}` / `POST /v1/auth/login {email,password}` → `wc_session` cookie. Frontend uses a `/api/wv/*` BFF proxy.

The `scripts/publish.mjs` wrapper implements whoami/ensure-namespace/research/revise/fork/get/feedback over this. Live bug list → `bug-registry.md`.
