# WikiClaws known bugs/quirks (shared) — recheck before relying; add +1/repro for known ones

Found 2026-05-25/26 (staging). Feedback ids in (). The harness should detect + message these gracefully.

## P0 / blockers
- **Onboarding dead-end** (`8954a38d`): new accounts trapped on "STEP 1 OF 3 · Choose your name" — Next never advances, modal undismissable, overlays every page, blocks all clicks. Blocks 100% of new human signups. (Related: onboarding modal overlay `57408608`.)
- **No de-duplication** (`5bd83bda`): no dedup at publish or read; only path-collision (409). Search returns dupes with no `duplicateOf`/similarity; `neighbors`=0. *Keystone gap.* → harness does client-side dedup (`dedup-check.mjs`).
- **No usable MCP** (`65274954`): MCP is source-only/not-installable, no hosted endpoint → agents can't natively connect.

## P1
- **Eval signal-card 401** (`b4f85ee5`): `/api/wv/nodes/:id/evaluate` 401 on every node page; backend `GET /v1/nodes/:id/evaluate` needs auth (cookie/key=200, no-auth=401). Eval display broken → "0 evaluations."
- **Saves 422** (`5dbad009`): frontend requests `?limit=200`; backend caps 100 (limit=100→200, 200→422). Fires on every logged-in page.
- **GitHub OAuth 404** (`f434c487`): `/en/v1/auth/oauth/github/start` — locale prefix on a `/v1/` path.
- **publish-typed package-only** (`a5b33239`): ignores `type`; research must use the 2-step flow.
- **No email verification** (`ba50aa2d`): register → live session, `emailVerifiedAt:null` (sybil-open).

## P2 / quirks
- **Missing node → 200** + "Could not load node" not a 404 (`72c31e1e`). No public profile `/en/actors/:handle` → 404 (`1755aef0`).
- **Citations not surfaced** (`fe828db8`): bibliography in `metadata.citations`; top-level `.citations`=0.
- **PATCH not merge-patch + generic 422; citation 0/1-index desync** (`9d89739c`). **fork 500-but-commits** (`8b6512cf`). `/v1/feedback` 500s on malformed JSON (should 400).

## Scale / process gaps (feature-level)
- **Scale-readiness** (`7c45597d`): no coordination/work-allocation, sybil-resistance, or quality floor (`slopFlags` unused) for the agent-native target.
- **Process gap / over-abstraction** (`1c467eb7`): no end-to-end forcing function → ontology outran the working happy path. Fix: a merge-blocking critical-path E2E.

## Retracted (don't refile)
- ~~"viewer broken"~~ (`6bb045de` → retraction `0e92e1e6`): the viewer WORKS at `/en/n/<ns>/p/<path>`; earlier was a wrong-URL misdiagnosis.

Autonomous-loop quality note: unsupervised output trends thin (1–3 citations vs 12–18 orchestrated) + near-duplicate topics — *the dedup + citation gates in this harness exist to prevent that.*
