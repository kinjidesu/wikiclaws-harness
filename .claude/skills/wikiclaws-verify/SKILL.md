---
name: wikiclaws-verify
description: Rigorously verify a node's citations — the ground-truth leg of the eval. Use after publishing (and during eval) to fetch each cited source and check it actually SUPPORTS the claim (entailment), not just that it exists. Catches fabrication/contradiction that holistic judges miss.
---

# wikiclaws-verify

Two holistic judges (you + Hermes) can BOTH be wrong — so verify against the actual sources.

## Run it — two modes
```bash
node scripts/verify.mjs <nodeId>                       # reachability: is each citation live?
node scripts/verify.mjs <nodeId> --claims claims.json  # SAFE-style: per-atomic-claim scaffold
```
Reachability mode fetches every URL in `metadata.citations[]` (Wayback fallback on 403) and prints reachable/unreachable + a snippet.

## SAFE-style atomic-claim verification (the rigorous path — adopt this)
Grounded in **SAFE** (Search-Augmented Factuality Evaluator, DeepMind/Stanford, NeurIPS'24): don't eyeball "is the node true" — **decompose the body into ATOMIC CLAIMS**, verify each against its cited source, and score precision.
1. Extract atomic claims into `claims.json`: `[{"claim":"<one factual claim>","cites":[1,3]}, …]` (1-based `[[n]]` indices). One verifiable assertion per claim.
2. `node scripts/verify.mjs <nodeId> --claims claims.json` → for each claim it fetches the cited source(s) and prints the **excerpt around the claim's keywords** so you can judge entailment.
3. Label each claim: **supported** | **contradicted** (GATE FAIL — flag loudly) | **unsupported** (source doesn't actually say it) | **irrelevant** (source off-point).
4. **Precision = supported / (supported + contradicted + unsupported)** — report it alongside the claim-verified ratio. (SAFE-style; a claim whose keywords aren't even in the source is NOT "supported".)
On the web sandbox `verify.mjs` may reach ~0 — re-fetch via the TOOL path (below) and judge from that.

## ⚠️ Claude Code web: use the TOOL fetch path, not the container fetch
There are **two network paths** and they don't behave the same:
- **Container egress** — what `verify.mjs` (Node `fetch`) and `curl` use. On the web sandbox this is gated by the **Allowed-domains allowlist**, so it's blocked for everything except what you allowlisted (e.g. `*.fly.dev`). `verify.mjs` can return **0 reachable even though the links are live** — that's the sandbox, not dead links.
- **Claude's `WebFetch` / `WebSearch` tools** — run on Anthropic infra and **bypass the sandbox allowlist**, so they keep working when container egress is blocked.

**So on web (or any time `verify.mjs` reports ~0 reachable): verify via the tools.** For each load-bearing claim, `WebFetch` the cited URL (and/or `WebSearch` the claim) and judge entailment from *that*. Don't report a false "unverified" just because the container couldn't reach it. (Power-user alternative: broaden the env's Network access so the container can fetch citation domains — but `WebFetch` is more robust since many sources 403 datacenter IPs anyway.)

## Label the METHOD honestly (this is the integrity of the ground-truth leg)
For every claim, record HOW it was verified — never claim a reachability you didn't have:
- `verified-via-refetch` — `verify.mjs` reached the exact URL (strongest).
- `verified-via-tool-fetch` — `WebFetch` reached the exact URL (just as strong; the normal web path).
- `verified-via-search` — `WebSearch` surfaced the source's text but you didn't re-fetch the exact URL (weaker — note it).
- `unverifiable` — couldn't reach it on **any** path (NOT "verified").
- `contradicted` — source says otherwise → GATE FAIL, flag loudly.

## Then YOU judge entailment (the part a script can't do)
For each load-bearing claim:
- Does the fetched source **actually support the specific claim** (number/date/quote/holding)? → **supported**.
- Related but weaker/different → **partial**. Source unreachable even via Wayback → **unverifiable** (NOT "verified"). Source says otherwise → **contradicted** (GATE FAIL — flag loudly).
- Future-dated/current-events content: judge against the **cited source**, not your training cutoff.

## Output
- **claim-verified ratio = supported / total** (≥70% to pass; <60% or any contradiction → revise to v2 before/at eval) **+ SAFE precision = supported/(supported+contradicted+unsupported)**.
- A short list of flagged/weak claims with the fix.

Feed this into `wikiclaws-eval` as the ground-truth third leg alongside the Hermes + Claude holistic scores.
