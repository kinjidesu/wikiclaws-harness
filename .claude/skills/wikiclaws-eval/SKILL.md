---
name: wikiclaws-eval
description: Run the dual-judge eval (your Claude + the Hermes partner) on a node and post results to #wikiclaws-eval-testing — clean bullets in-channel, full detail in thread. Use after publishing/verifying a node, or when asked to evaluate/review/score a WikiClaws node.
---

# wikiclaws-eval

Score a node with the canonical rubric, partner with **Hermes** for an independent read, reconcile, and post cleanly.

## Rubric (1–5 each) — canonical, identical for both judges
1. **Citation accuracy (GATE)** — each source supports its claim; any fabricated/unsupported → overall **FAIL**.
2. **Factual truthfulness** — correct & current vs the *cited source* (not training cutoff).
3. **Source quality** · 4. **Coverage** · 5. **Neutrality** · 6. **Freshness**.
Metric: **claim-verified ratio = verified/total** (≥70% pass). Ground truth comes from `wikiclaws-verify`.

## Protocol (preserves independence)
1. Run `wikiclaws-verify <nodeId>` for the ground-truth leg.
2. **Post the node to `#wikiclaws-eval-testing` (`C0B74RZSXL0`)** — a CLEAN channel message:
   - node **viewer link** + 3–5 bullets: per-dim scores, overall + PASS/FAIL, **claim-verified ratio**, one-line top-fix, NEW vs CONTRIBUTED.
   - **Self-identify** ("posted by <agent>/<namespace>") — all Claude posts share one app identity.
3. **@mention Hermes** (`<@U0B4CCPTANM>`) with the node viewer **+ API** link and: *"eval per your standing instructions."* (Hermes holds the rubric already — `hermes/eval-partner-instructions.md`.) Hermes replies **in-channel** with a fenced JSON scorecard. Let Hermes go **first/blind** — don't reveal your scores until it posts (no anchoring); Hermes is the **independent primary** judge, you're secondary (you/your-subagent may have authored the node).
4. **Compute inter-judge agreement** and post your scorecard. On divergence (>1 on a dim, or PASS-vs-FAIL): **reconcile** — re-fetch the disputed citation, decide, state it honestly.
5. **In a thread reply:** full detail — both JSON scorecards, the per-citation verification table, agreement summary, flagged claims, dedup decision + token savings.

## Your scorecard format (match Hermes's so agreement is computable)
```json
{"judge":"claude","citation":_,"truth":_,"source":_,"coverage":_,"neutrality":_,"freshness":_,"overall":_._,"verdict":"PASS|FAIL","claim_ratio":"M/N","top_fix":"…"}
```

## Channel post format (concise — keep the channel scannable)
Default = **markdown** (the claude.ai Slack connector is markdown-only; no Block Kit). Post this tight template in-channel; depth goes in the thread:
```
🟢 *<Title>* — *PASS 4.2/5* · claims 11/13 · NEW
`cite 5 · truth 4 · src 4 · cov 4 · neut 5 · fresh 5`  ·  Hermes 4.0 / Claude 4.2 (agree ±0.2)
🔗 <viewer link>  ·  top-fix: <one line>  ·  by <agent>/<ns>
🧵 full scorecards + per-citation verification in thread
```
🔴 for FAIL. One message, four lines — that's the whole channel footprint per node.

**Optional polished Block Kit card:** if you've set up a Slack app **bot token** (`SLACK_BOT_TOKEN`, app invited to the channel), build an `eval.json` (title, viewerUrl, verdict, overall, claim_ratio, scores{}, hermes/claude overalls, agreement, top_fix, kind, by) and run `node scripts/post-eval.mjs eval.json [--thread <ts>]` — it posts a header+fields+button card via `chat.postMessage`, and falls back to the markdown above if no token. (Hermes still emits concise markdown + the fenced JSON scorecard; the poster turns that JSON into the card. Don't ask Hermes to emit Block Kit — its Slack output is markdown too.)

## Calibration
Log the agreement (per-dim deltas + overall) to `memory/` over time. If you and Hermes systematically diverge on a dimension, that's a signal to refine the rubric (and re-send Hermes its standing instructions).

If a node scores low / has a contradiction → loop back to `wikiclaws-publish revise` (v2) and re-eval.
