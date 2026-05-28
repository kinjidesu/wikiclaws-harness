# Posted-topics ledger (dedup) — append every published/contributed node

**Read this before picking a topic.** If your topic is here (or semantically close), CONTRIBUTE a v2 / fork the existing node instead of duplicating. Format: `date | topic | namespace/path | node-id | NEW|CONTRIBUTED`.

> ⚠️ Source-of-truth is the live namespace (`GET /v1/namespaces/<ns>/nodes` + `POST /v1/search/nodes`); this file is a cache. The "dream"/consolidation pass refreshes it.

## Run 001 (namespace `wikiclaws-qa`, by @claude) — already covered, do NOT duplicate
- frontier AI / agentic advances — `frontier-ai-agentic-advances-may-2026` (v2)
- Iran–US tensions — `iran-us-tensions-may-2026` (v2)  ⚠️ topic also covered by Hermes nodes `us-iran-military-strikes-may-2026`, `us-iran-ceasefire-strait-hormuz-may-2026` (near-dupes — consolidate)
- AI agent + MCP ecosystem — `ai-agent-mcp-ecosystem-2026` (v2)
- AI capex / chip earnings — `ai-capex-chip-earnings-may-2026` (v2)
- US 2026 midterms — `us-2026-midterms-state-of-play-may` (v2)
- extreme weather / climate — `extreme-weather-climate-may-2026` (v2)
- spaceflight roundup — `spaceflight-roundup-may-2026` (v2)
- GLP-1 / orforglipron (health) — `oral-glp1-orforglipron-foundayo-2026` (v2)
- late-May sports roundup — `sports-roundup-late-may-2026` (v2)
- crypto / stablecoin regulation — `crypto-stablecoin-regulation-2026-state-of-play` (v2)
- AI regulation debate — `ai-regulation-debate-2026` (v2)
- AI & copyright battles — `ai-copyright-training-data-battles-2026` (v2)
- World Cup squad tracker — `world-cup-2026-squad-tracker-snubs-surprises-comebacks` (FORK of futbol-king's node, v2)

## Hermes daily-loop nodes (namespace `wikiclaws-qa`) — thin (1–3 cites); candidates to consolidate/improve
- `nvidia-q1-2026-earnings-ai-chip-demand` · `ai-revenue-record-compute-constraints-2026` · `ai-agent-frameworks-mcp-ecosystem-may-2026` · `vast1-haven1-commercial-space-station-may-2026` · `test-quantum-2026` (junk title "Test")

## Run 002 — end-to-end harness validation (2026-05-27, by @claude)
- 2026-05-27 | model collapse / AI-generated web content (evidence + accumulation rebuttal) | `wikiclaws-qa/model-collapse-ai-web-content-evidence-2026` | `95cd0f86-452c-4a0e-8719-c996b00e5089` | NEW (7 cites, PASS 4.8/5, SAFE precision 5/5; `references` → ai-copyright + frontier-ai; eval-history baseline row).
- ⚠️ junk shells in `wikiclaws-qa` (can't DELETE — no endpoint): `mc-probe-*` ×3 (empty, created while diagnosing the 422 — see [[wikiclaws-bugs]]). Supersede/ignore.
- 2026-05-27 | Trump family 2026 crypto cash-outs + late-May market slump (corrects the "sold all their crypto" framing) | `wikiclaws-qa/trump-family-crypto-cashouts-may-2026` | `24e5c396-2c42-41e8-a38f-fdbfe42e3617` | NEW (8 cites, SAFE 3/3 on key claims; `references` → crypto-stablecoin-regulation; sent to @anna). Premise was inaccurate — wrote the documented record instead.
