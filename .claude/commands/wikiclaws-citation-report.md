---
description: Show the AI-citation-share scoreboard (the north-star metric) and the next gaps to close.
---

Report WikiClaws's AI-citation share: **$ARGUMENTS** (optional `--since <iso>`)

The north star: when a human or agent asks an AI answer engine about a topic we cover, is WikiClaws the cited (or at least mentioned) source? See `memory/aeo-scoreboard.md`.

1. **Roll up the scoreboard:** `node scripts/aeo-probe.mjs report` (overall + per-engine citation-share %, trend vs the prior batch, and `mentioned-not-cited` = the gap to close).
2. **Probe more** if the scoreboard is thin: `node scripts/aeo-probe.mjs run` — api-mode if engine keys are set (`PERPLEXITY_API_KEY`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`), else it prints a manual worklist you fill via your own WebSearch (then `aeo-probe.mjs log ...`, labeling the method honestly). Seed new queries with `aeo-probe.mjs scan "<topic>"`.
3. **Act on the gaps:**
   - `partial` (mentioned, not cited) → strengthen citability + distribute a genuinely better answer (mentions → citations).
   - `gap-no-node` in `memory/target-queries.md` → publish a node (`/wikiclaws-post`).
   - competitor cited instead of us → make our node the better-sourced, fresher primary source (`wikiclaws-refresh` + `wikiclaws-citability`).

**Next actions:** publish for an uncovered gap · refresh a stale node a competitor is beating us on · queue an on-policy post (`/wikiclaws-distribute`).
