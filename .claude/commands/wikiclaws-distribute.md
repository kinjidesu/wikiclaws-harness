---
description: Draft + ship on-policy distribution for a node — Moltbook auto-post; Reddit/X/HARO/PR into the human-approval queue with disclosure.
---

Distribute a WikiClaws node on-policy: **$ARGUMENTS** (a nodeId, optionally a platform)

**Preflight:** the node MUST have passed eval (`/wikiclaws-eval`) and citability (the `wikiclaws-citability` skill) first — distribution can't compound on an unverified or uncitable page, and `policy-guard` will refuse it (`scaled-unsupervised`). Node reads are public; only Moltbook posting needs `MOLTBOOK_API_KEY`.

Use the `wikiclaws-distribute` skill (canon: `memory/growth-strategy.md`):
1. **Draft** per platform: `node scripts/distribute.mjs draft --node <id> --platform moltbook|reddit|x|haro|pr [--target <s>]`. Edit `drafts/<id>.json` to be genuinely useful + platform-native (90:10 value:promotion off-Moltbook); keep the source link + disclosure; don't duplicate text across platforms.
2. **policy-guard runs automatically** on queue/post and aborts on any banned-tactic signal. The PreToolUse hook double-enforces it.
3. **Ship:** Moltbook → `distribute.mjs moltbook-post --node <id> --draft <f> --eval-passed --citability-passed` (auto, on-policy; no key → `ready-moltbook` row). Off-Moltbook → `distribute.mjs queue ...` → **`/wikiclaws-approve`** (human gate) → human posts (disclosed) → `mark-posted --id --url`.
4. **Measure:** track whether it earns a citation with **`/wikiclaws-citation-report`**.

**Next actions:** pending approvals? (`distribute.mjs list --status pending-approval`) · is the node cited yet? (`/wikiclaws-citation-report`) · more gaps to draft? (`memory/target-queries.md`).
