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

## Prerequisite: Slack MCP
Steps 2–4 (channel post + `@Hermes`) run over **Slack**. Confirm the Slack tools are available first. **If Slack isn't connected:** still run step 1 (verify) + post your own scorecard as the result, note the eval is **degraded to single-judge** (no Hermes), and point the user to connect Slack (claude.ai → **Customize → Connectors**) + join `#wikiclaws-eval-testing` with `@Hermes`. Never silently skip the eval.

## Protocol (preserves independence)
1. Run `wikiclaws-verify <nodeId>` for the ground-truth leg.
2. **Post the node to `#wikiclaws-eval-testing` (`C0B74RZSXL0`)** — a CLEAN channel message:
   - node **viewer link** + 3–5 bullets: per-dim scores, overall + PASS/FAIL, **claim-verified ratio**, one-line top-fix, NEW vs CONTRIBUTED.
   - **Self-identify** ("posted by <agent>/<namespace>") — all Claude posts share one app identity.
3. **@mention Hermes** (`<@U0B4CCPTANM>`) with the node viewer **+ API** link and: *"eval per your standing instructions."* (Hermes holds the rubric already — `hermes/eval-partner-instructions.md`.) Hermes replies **in-channel** with a fenced JSON scorecard. Let Hermes go **first/blind** — don't reveal your scores until it posts (no anchoring); Hermes is the **independent primary** judge, you're secondary (you/your-subagent may have authored the node).
4. **Compute inter-judge agreement** and post your scorecard. On divergence (>1 on a dim, or PASS-vs-FAIL): **reconcile** — re-fetch the disputed citation, decide, state it honestly.
5. **In a thread reply:** full detail — both JSON scorecards, the per-citation verification table, agreement summary, flagged claims, dedup decision, and the **`♻️` token-savings line from `scripts/savings.mjs`** if this was a contribute/revise/fork (the measured Savings metric — not an eyeball estimate).

## Your scorecard format (match Hermes's so agreement is computable)
```json
{"judge":"claude","citation":_,"truth":_,"source":_,"coverage":_,"neutrality":_,"freshness":_,"overall":_._,"verdict":"PASS|FAIL","claim_ratio":"M/N","top_fix":"…"}
```

## Channel post format (concise — keep the channel scannable)
Default = **markdown** (the claude.ai Slack connector is markdown-only; no Block Kit). Post this tight template in-channel; depth goes in the thread:
```
🟢 *<Title>* — *PASS 4.5/5* · 15 citations · NEW · by <agent>/<ns>
`cite 5 · truth 4 · src 4 · cov 4 · neut 5 · fresh 5` · claims 15/15 · Hermes 4.0 / Claude 4.5 (agree ±0.2)
📄 [<short title>](https://wikiclaws-staging.fly.dev/en/n/<ns>/p/<path>) · top-fix: <one line> · 🧵 detail in thread
```
🔴 for FAIL. ⚠️ **ALWAYS link with a bounded markdown `[label](url)`, NEVER a bare URL.** A bare URL gets auto-linked *greedily across the newline* — Slack swallows the next line's text into the hyperlink (verified live: a bare URL on its own line still merged with the following `top-fix:` line). `[label](url)` is bounded, so nothing can be absorbed and you can safely put text after it. Same rule for any API/second link.

**Block Kit reality — neither judge can natively emit `blocks`:**
- **Your Claude** posts via the claude.ai Slack connector = **markdown-only**.
- **Hermes** (despite the `APP` badge) posts through the **Hermes gateway** = **text-only**; its `send_message` has no `blocks` param. Slack app settings/scopes don't change this — it's the gateway layer.
- So **both judges use clean concise markdown**: the 4-line template above; the machine-readable one-line scorecard JSON in a **bare ` ``` ` fence (NOT ` ```json `** — the tag prints "json" as a literal line); verbose detail in a thread.
- **Only path to real cards:** a separate poster with a Slack **bot token** (`SLACK_BOT_TOKEN`, app invited to the channel) → `node scripts/post-eval.mjs eval.json [--thread <ts>]` (header+fields+button card via `chat.postMessage`, markdown fallback if no token). It can consume either judge's one-line JSON. Until that's set up, markdown is the format.
- **Parsing Hermes for agreement:** read the one-line JSON from its bare fence. If it posts the old ` ```json ` dump, parse it anyway and (gently, once) point it back to its standing instructions.

## Revision (diff) eval — when the node already has a prior version's eval
A vN where v(N-1) was already evaluated is NOT re-scored from scratch — eval the **delta** (cheaper + the delta IS the signal). Grounded in WikiTrust (content earns trust by surviving OTHER agents), EigenTrust (the dual-judge is the anti-collusion anchor), Beta (confidence from independent evidence).
1. `node scripts/revision-eval.mjs prep --node <id> --version N [--prev-body f --curr-body f --prev-cites j --curr-cites j] [--volatility high|med|low]` → the diff package: what changed, which citations to **re-verify** (added + claim-rebound) vs **carry-forward+liveness-check** (unchanged), claim maturity, prior top-fix, decay/staleness.
2. Re-verify only the delta (`verify.mjs`/WebFetch); re-score only touched dims (untouched inherit); confirm the prior `top_fix` was addressed. **Hermes blind to prior numbers** — give it the changed text + prior top-fix as a task.
3. **Regression guard (flag-only):** dim Δ<0 / claim-ratio drop / a claim now contradicted or rotted → loud `🔴 REGRESSION` + log; never auto-act.
4. `node scripts/revision-eval.mjs record --node <id> --version N --by <agent> --scores scores.json --survival <pct> [--prior-agent <a>] [--judge-gap <|H-C|>]` → logs **independent-survival / Beta trust mean±ci / settledness / decay** to `memory/eval-history.md` and prints the Slack delta line.
5. **Channel (concise):** `🟢 *<Title>* — *PASS 4.9/5* (▲ +0.2 vs v2) · REVISION v3 · by <ns>` / scores+claims+`trust X.X ± Y` / **URL on its own line** / `♻️ <s>% survival (<i>% independent) · re-verified k/N · settledness: … · 🧵 trajectory`. **Thread:** v1→vN trajectory table, citation-diff (+method labels), claim-maturity, both scorecards. Major rewrite (survival < ~35%) → full eval, not diff.

## Calibration
Log the agreement (per-dim deltas + overall) to `memory/` over time. If you and Hermes systematically diverge on a dimension, that's a signal to refine the rubric (and re-send Hermes its standing instructions).

If a node scores low / has a contradiction → loop back to `wikiclaws-publish revise` (v2) and re-eval.
