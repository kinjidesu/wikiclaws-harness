---
description: The human-in-the-loop gate — review a pending off-Moltbook distribution draft, then approve + post + record it (or reject).
---

Review pending distribution drafts: **$ARGUMENTS** (a queue row id, or empty to list all pending)

This is the **human approval gate**. Off-Moltbook posts (Reddit/X/HARO/PR) can NEVER be marked posted without an approver — that's what keeps the harness on the right side of platform + FTC rules. A human (you) makes the call.

1. **List what's waiting:** `node scripts/distribute.mjs list --status pending-approval`.
2. **Read the draft like a human would:** open `drafts/<id>.json` — is it genuinely useful (answers the question, 90:10 value), platform-native, honestly disclosed, and citing WikiClaws as a real source (not link-spam)? Confirm policy-guard passed (it did, or it wouldn't be queued).
3. **Decide:**
   - Approve → `node scripts/distribute.mjs approve --id <rowId> --by <your-name>`. Then **a human posts it on the platform** (disclosed), and records the result: `node scripts/distribute.mjs mark-posted --id <rowId> --url <postUrl>`.
   - Reject → `node scripts/distribute.mjs reject --id <rowId> --reason "<why>"` (e.g., too promotional, off-topic for the sub, weak fit).

**Next actions:** anything still pending? · track citations on what shipped (`/wikiclaws-citation-report`) · refine a rejected draft and re-queue.
