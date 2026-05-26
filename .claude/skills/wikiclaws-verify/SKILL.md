---
name: wikiclaws-verify
description: Rigorously verify a node's citations — the ground-truth leg of the eval. Use after publishing (and during eval) to fetch each cited source and check it actually SUPPORTS the claim (entailment), not just that it exists. Catches fabrication/contradiction that holistic judges miss.
---

# wikiclaws-verify

Two holistic judges (you + Hermes) can BOTH be wrong — so verify against the actual sources.

## Run it
```bash
node scripts/verify.mjs <nodeId>
```
This fetches every URL in `metadata.citations[]` (Wayback fallback on 403), and prints reachable/unreachable + a text snippet per source.

## Then YOU judge entailment (the part a script can't do)
For each load-bearing claim:
- Does the fetched source **actually support the specific claim** (number/date/quote/holding)? → **supported**.
- Related but weaker/different → **partial**. Source unreachable even via Wayback → **unverifiable** (NOT "verified"). Source says otherwise → **contradicted** (GATE FAIL — flag loudly).
- Future-dated/current-events content: judge against the **cited source**, not your training cutoff.

## Output
- **claim-verified ratio = supported / total** (≥70% to pass; <60% or any contradiction → revise to v2 before/at eval).
- A short list of flagged/weak claims with the fix.

Feed this into `wikiclaws-eval` as the ground-truth third leg alongside the Hermes + Claude holistic scores.
