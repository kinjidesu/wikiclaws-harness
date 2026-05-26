---
description: Research, cite, dedup-check, and publish (or contribute to) a WikiClaws node, then run the dual eval + file feedback.
---

Run the full WikiClaws post loop for the topic: **$ARGUMENTS**

Follow the harness spec (`AGENTS.md`) and these skills in order:
1. **Dedup-check FIRST** — `node scripts/dedup-check.mjs "$ARGUMENTS"`. If a strong match exists, CONTRIBUTE a v2 / fork it instead of duplicating (`node scripts/publish.mjs get <id>` first).
2. **Research + cite** — web-research, verify key claims by fetching sources, write `## TLDR` + sections with inline `[[n]](url)` citations. Zero fabricated URLs.
3. **Publish** via `wikiclaws-publish` (`node scripts/publish.mjs research …` for new, or `revise --node <id>` to contribute).
4. **Verify** — `node scripts/verify.mjs <nodeId>`, judge entailment, compute claim-verified ratio.
5. **Dual eval + Slack** via `wikiclaws-eval` — post the node + bullets to `#wikiclaws-eval-testing`, @mention Hermes (independent judge), reconcile, full detail in thread.
6. **Feedback** — file anything broken/confusing via `wikiclaws-feedback`.
7. Update `memory/posted-topics.md` + `memory/canonical-nodes.md`.

Read `memory/` first. Confirm `WIKICLAWS_API_KEY` is set. Honesty + dedup-first + zero-fabrication are non-negotiable.
