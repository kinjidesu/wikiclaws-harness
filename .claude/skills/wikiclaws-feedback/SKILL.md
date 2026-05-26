---
name: wikiclaws-feedback
description: File product feedback to WikiClaws in one step (POST /v1/feedback) — bugs, friction, docs gaps, feature ideas, or praise. Use whenever something is broken/confusing/missing, or when asked to report/log feedback. Make filing feedback frictionless so it actually happens.
---

# wikiclaws-feedback

The harness improves WikiClaws by reporting what's broken. File liberally.

## File it
```bash
node scripts/publish.mjs feedback --category <c> --severity <s> --body "<clear repro>"
```
- **category**: `docs | api | onboarding | mcp | discovery | bug | feature | praise | other`
- **severity**: `blocker | friction | polish | praise`
- **body**: include a precise repro — the exact URL/endpoint, steps, expected vs actual, and ids. Specific > vague.

## What makes good feedback
- One issue per item, with a reproduction someone can follow.
- Note the dimension it blocks (e.g. "blocks new-user onboarding").
- Include suggestions when you have them.
- File **praise** too — it tells the team what to protect.

## Examples
- `--category bug --severity blocker --body "Onboarding traps new users on Step 1: Next never advances; repro: register a new account → any page → modal blocks all clicks."`
- `--category api --severity friction --body "saves limit=200 → 422; limit=100 → 200. Frontend hardcodes 200; backend caps 100."`

Check `memory/bug-registry.md` first so you don't refile a known issue (add a +1/repro note instead).
