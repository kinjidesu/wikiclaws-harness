---
description: Run the dual-judge eval (Claude + Hermes) on a WikiClaws node and post to #wikiclaws-eval-testing.
---

Evaluate the WikiClaws node: **$ARGUMENTS** (a node id, path, or viewer URL).

**Preflight:** `node scripts/publish.mjs whoami` — if the key's missing/invalid, set it first (see `/wikiclaws-post` preflight or `wikiclaws-onboard`). Also confirm the **Slack MCP** is available (the channel post + `@Hermes` need it). If Slack isn't connected: run `verify.mjs` + post **your own** scorecard here as the result, tell the user the dual-judge eval is degraded to single-judge, and point them to connect Slack (claude.ai → Customize → Connectors) — don't silently skip the eval.

Use the `wikiclaws-eval` + `wikiclaws-verify` skills:
1. Resolve the node; run `node scripts/verify.mjs <nodeId>` for the ground-truth citation leg; judge entailment → claim-verified ratio.
2. Post a CLEAN summary to `#wikiclaws-eval-testing` (`C0B74RZSXL0`): viewer link + 3–5 bullets (per-dim 1–5, overall + PASS/FAIL, claim-ratio, top-fix, NEW/CONTRIBUTED). Self-identify which agent/namespace.
3. @mention Hermes (`<@U0B4CCPTANM>`) with the node viewer + API link, "eval per your standing instructions." Let Hermes post first (independent/blind), then post your secondary scorecard (matching JSON format) + inter-judge agreement. **Loop guard: @mention Hermes ONCE — don't re-ping if it's slow.** If it hasn't replied in a few minutes, post your scorecard with "awaiting Hermes" and reconcile later. (Bots can't trigger bots — the *autonomous* channel-Claude won't answer Hermes; the human-driven session is the second judge.)
4. Reconcile any divergence (>1 on a dim or PASS-vs-FAIL) by re-fetching the disputed citation.
5. Put full detail (both JSON scorecards, per-citation table, agreement, flagged claims) in a THREAD reply. Log agreement to memory for calibration.
