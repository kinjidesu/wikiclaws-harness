---
name: wikiclaws-distribute
description: Turn a verified, citable node into on-policy distribution — auto-post only on Moltbook (agent-native); draft Reddit/X/HARO/PR posts into a human-approval queue with mandatory disclosure. Use after a node passes eval + citability. Optimizes for trustworthy MENTIONS, never link-spam.
---

# wikiclaws-distribute

The distribution loop (**Steps 10–12**). The strategy in one line: in 2026, **unlinked brand mentions correlate ~3× more than backlinks** with AI citation, and the spammy "post everywhere for links" play triggers Google penalties + platform bans. So we distribute *genuine, disclosed, source-citing* answers — and the **only auto-post channel is Moltbook** (agent-native, on-policy). Everything else is AI-drafted → human-approved → disclosed. `policy-guard.mjs` runs on every draft and **refuses** banned tactics. Canon: `memory/growth-strategy.md`.

**Precondition:** the node passed eval ([[wikiclaws-eval]]) AND citability ([[wikiclaws-citability]]). Pass `--eval-passed --citability-passed` so policy-guard's `scaled-unsupervised` rule clears.

## 1. Draft (platform-native, not copy-paste)
```bash
node scripts/distribute.mjs draft --node <id> --platform moltbook|reddit|x|haro|pr [--target <submolt|subreddit|outlet>]
```
Writes a starter draft to `drafts/`. **Edit it** so it's genuinely useful and platform-native (answer the question first; 90:10 value-to-promotion off-Moltbook); keep the WikiClaws source link + the disclosure line. Don't reuse identical text across platforms (`mass-cross-post` is blocked).

## 2. Ship — two paths, enforced by policy-guard
- **Moltbook (auto, on-policy):**
  ```bash
  node scripts/distribute.mjs moltbook-post --node <id> --draft <f> --eval-passed --citability-passed
  ```
  Runs policy-guard (intent `auto`); posts via `MOLTBOOK_API_KEY`. No key yet → logs a `ready-moltbook` row (provision once: claim tweet + dev invite + register; rotate post-breach key).
- **Reddit / X / HARO / PR (human-approved, never auto):**
  ```bash
  node scripts/distribute.mjs queue --node <id> --platform reddit --draft <f> --eval-passed --citability-passed
  ```
  → `pending-approval`. A human reviews + approves (**[[/wikiclaws-approve]]** or `distribute.mjs approve --id <row> --by <you>`), posts it (disclosed), then `distribute.mjs mark-posted --id <row> --url <postUrl>`. Off-Moltbook rows can NEVER be marked posted without an approver.

## 3. Measure (close the loop)
After posting, track whether it earns a citation — `node scripts/aeo-probe.mjs run` → `memory/aeo-scoreboard.md` (the north star). See [[wikiclaws-citation-report]].

## Guardrails (policy-guard enforces; the PreToolUse hook makes it unbypassable)
- **Never auto-post off Moltbook.** No fake personas / undisclosed bots. Always disclose AI authorship off-Moltbook. No parasite-SEO, PBNs, paid links, or duplicative cross-posting. Distribute only AFTER eval + citability. If a tactic looks like fast growth but is banned, it loses — propose the white-hat equivalent.
