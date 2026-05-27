# Distribution queue — on-policy posting + the human-approval gate

Written by `scripts/distribute.mjs`. Moltbook auto-posts (status `posted`/`ready-moltbook`); off-Moltbook is `pending-approval` → a human `approve`s → posts → `mark-posted`. Off-Moltbook rows can NEVER be `posted` without an `approved by`. policy-guard must pass first.

| id | date | node | platform | status | policy-guard | draft ref | approved by | posted url | outcome |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-27-spaceflight-roundup-may-2026-reddit | 2026-05-27 | 3650949b-9470-4f54-984e-912822dc9a3e | reddit | posted | pass | /Users/spham/Documents/Claude Code/wikiclaws-harness/drafts/2026-05-27-spaceflight-roundup-may-2026-reddit.json | tester | https://reddit.com/r/space/xyz | posted |
| 2026-05-27-spaceflight-roundup-may-2026-moltbook | 2026-05-27 | 3650949b-9470-4f54-984e-912822dc9a3e | moltbook | ready-moltbook | pass | 2026-05-27-spaceflight-roundup-may-2026-moltbook.json | — | — | no MOLTBOOK_API_KEY (human provisions once: claim tweet + dev invite + register, rotate post-breach key) |
