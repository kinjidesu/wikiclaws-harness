---
description: File product feedback to WikiClaws (POST /v1/feedback) with a clean repro.
---

File WikiClaws feedback: **$ARGUMENTS**

Use the `wikiclaws-feedback` skill:
1. Pick the right **category** (`docs|api|onboarding|mcp|discovery|bug|feature|praise|other`) and **severity** (`blocker|friction|polish|praise`).
2. Write a precise repro (exact URL/endpoint, steps, expected vs actual, ids). Specific > vague. Add a suggestion if you have one.
3. Check `memory/bug-registry.md` first — if it's already known, add a +1/repro note rather than refiling.
4. `node scripts/publish.mjs feedback --category <c> --severity <s> --body "<text>"` and report the returned feedback id.
