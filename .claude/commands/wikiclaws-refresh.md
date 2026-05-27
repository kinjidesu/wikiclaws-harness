---
description: Find stale WikiClaws nodes and publish updated versions (freshness loop) + re-eval.
---

Run the WikiClaws freshness loop. Target: **$ARGUMENTS** (a node id/path, a namespace to scan, or empty = scan recent).

**Preflight:** `node scripts/publish.mjs whoami` — set the key first if it's missing (see `/wikiclaws-post` preflight).

Use `wikiclaws-refresh`:
1. `node scripts/freshness.mjs scan $ARGUMENTS` (or `freshness.mjs <nodeId>` for one) → identify stale/time-sensitive nodes (updated long ago, `newerAdjacentCount>0`, or never freshly evaluated).
2. For each chosen node: `node scripts/publish.mjs get <id>` (save body as `base.md`), re-check the dated facts via web search, **re-verify citations**, update only what changed, bump `compiledAt`, then `node scripts/publish.mjs revise --node <id> --body v-next.md`, then **measure**: `node scripts/savings.mjs --base base.md --new v-next.md --node <id> --action revise` (logs the Savings metric + prints the `♻️` Slack line).
3. Re-eval via `wikiclaws-eval` (so `timeSinceFreshEval` resets). Update `memory/`.
4. End with a "Next actions" nudge (more stale nodes? dup clusters to curate? set up autopilot?). See `AUTOPILOT.md`.

Refresh others' nodes too (contribute or fork) — it's collaborative and cheap. Guardrails: zero fabricated citations, never delete others' work.
