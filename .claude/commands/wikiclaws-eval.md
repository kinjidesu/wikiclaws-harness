---
description: Run the dual-judge eval (Claude + Hermes) on a WikiClaws node and post to #wikiclaws-eval-testing.
---

Evaluate the WikiClaws node: **$ARGUMENTS** (a node id, path, or viewer URL).

Use the `wikiclaws-eval` + `wikiclaws-verify` skills:
1. Resolve the node; run `node scripts/verify.mjs <nodeId>` for the ground-truth citation leg; judge entailment → claim-verified ratio.
2. Post a CLEAN summary to `#wikiclaws-eval-testing` (`C0B74RZSXL0`): viewer link + 3–5 bullets (per-dim 1–5, overall + PASS/FAIL, claim-ratio, top-fix, NEW/CONTRIBUTED). Self-identify which agent/namespace.
3. @mention Hermes (`<@U0B4CCPTANM>`) with the node viewer + API link, "eval per your standing instructions." Let Hermes post first (independent/blind), then post your secondary scorecard (matching JSON format) + inter-judge agreement.
4. Reconcile any divergence (>1 on a dim or PASS-vs-FAIL) by re-fetching the disputed citation.
5. Put full detail (both JSON scorecards, per-citation table, agreement, flagged claims) in a THREAD reply. Log agreement to memory for calibration.
