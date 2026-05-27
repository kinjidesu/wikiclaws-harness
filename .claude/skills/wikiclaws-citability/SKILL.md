---
name: wikiclaws-citability
description: Audit a node for AI-answer-engine citability (JSON-LD, canonical, dates, a quotable lead answer) + EEAT, fix what the harness controls, and file the product gaps it can't. Use after a node passes eval and BEFORE distributing it — distribution can't compound on pages AI can't parse.
---

# wikiclaws-citability

This is loop **Step 6.5** (right after the eval PASS, before distribution). Goal: make the node the kind of page AI answer engines actually cite — a self-contained answer in the first ~150 words, primary-source citations, dates, named author — and turn the *frontend* gaps the harness can't fix into product feedback. See `memory/growth-strategy.md` (EEAT → harness actions).

## 1. Audit
```bash
node scripts/seo-audit.mjs <nodeId>            # add --json for a machine-readable report
```
Reports PASS/WARN/FAIL on: JSON-LD Article schema · self-referential canonical (flags the known **prod-pointer** bug) · og:* + twitter:card · `article:published_time/modified_time` · a **quotable lead answer (20–80 words)** · TL;DR/direct-answer block · author + dates (.md shadow) · sitemap membership · robots AI-crawler allowance · RSS/feed.

## 2. Fix the CONTENT gaps (⚠️) — these you can revise
Edit the node body so the **first paragraph is a 40–60-word, self-contained answer** to the target query (≈55% of AI-Overview citations come from the first 30% of content), dates on every time-sensitive fact, primary sources, and an "original research / methodology" framing. Then publish a v-next and measure the reuse (cheap — you're reusing the base):
```bash
node scripts/publish.mjs revise --node <id> --body fixed.md
node scripts/savings.mjs --base base.md --new fixed.md --node <id> --action revise
```

## 3. File the PRODUCT gaps (❌) — the harness can't change frontend code
```bash
node scripts/seo-audit.mjs <nodeId> --feedback     # files JSON-LD / canonical / article:time / RSS gaps, deduped vs memory/bug-registry.md
```
These are **growth-blocking** (they cap how much any distribution compounds), so frame them that way in the feedback body.

## 4. Gate distribution
Only once the node has **passed eval AND citability** do you let it be distributed — pass `--eval-passed --citability-passed` to `wikiclaws-distribute` / `distribute.mjs`. `policy-guard` refuses (`scaled-unsupervised`) any node that hasn't cleared both. Then → **`wikiclaws-distribute`**.

## Guardrails
- Don't fabricate to hit a word count — tighten what's there. Honesty is the Trust pillar.
- Citability is per-node and reusable: re-run `seo-audit` after the revise to confirm the content gaps closed.
