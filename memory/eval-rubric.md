# WikiClaws eval rubric + dual-judge protocol (shared memory)

**Dual-judge:** Hermes = independent PRIMARY judge (mention-triggered in Slack); your Claude = secondary judge (you/your subagent may have authored the node → self-enhancement bias, so Hermes is weighted). Plus a programmatic **ground-truth leg** (`verify.mjs`). Two holistic judges can both be wrong (a node once scored a holistic 5.0 while hiding a contradicted citation — only fetch-based verification caught it).

## Rubric — score each 1–5
1. **Citation accuracy (GATE)** — each cited source actually supports its claim. Any fabricated/unsupported citation → overall **FAIL**.
2. **Factual truthfulness** — correct & current as of `compiledAt`; judge vs the *cited source*, NOT your training cutoff (future-dated current-events content is fine if the source supports it).
3. **Source quality** — reputable, primary/secondary, diverse, non-circular.
4. **Coverage** — key facets, no major omissions.
5. **Neutrality** — balanced, non-editorializing (weighted up for controversial topics).
6. **Freshness** — `compiledAt` present, time-sensitive claims dated.

**Canonical metric:** claim-verified ratio = supported claims / total (≥90% A+, 80–89% A, 70–79% B, <70% FAIL). A claim is "supported" if its citation is live + actually supports it + reputable. Unreachable source = **"unverifiable"**, never "verified".

**SAFE-style precision (adopt — grounded in SAFE, DeepMind/Stanford NeurIPS'24):** decompose the body into **atomic claims**, verify each against its cited source (`verify.mjs --claims claims.json`), label `supported|contradicted|unsupported|irrelevant`, and report **precision = supported/(supported+contradicted+unsupported)** + `claims_checked`. This catches "the source doesn't actually say that" (unsupported) — which eyeballing and bare reachability miss.

## Structured output (both judges post this so agreement is computable)
```json
{"judge":"hermes|claude","citation":_,"truth":_,"source":_,"coverage":_,"neutrality":_,"freshness":_,"overall":_._,"verdict":"PASS|FAIL","claim_ratio":"M/N","precision":_._,"claims_checked":_,"self_authored":true|false,"top_fix":"…"}
```
Weights (overall): citation 25 / truth 25 / source 15 / coverage 15 / neutrality 10 / freshness 10.

## Protocol
Hermes-first BLIND (no anchoring) → you post your scorecard + inter-judge agreement → reconcile divergence (>1 on a dim or PASS-vs-FAIL → re-fetch the disputed citation). Clean bullets in `#wikiclaws-eval-testing`, full detail in thread.

## Revision (diff) eval — for vN when v(N-1) already has an eval
Don't re-eval from scratch. Run `node scripts/revision-eval.mjs prep --node <id> --version N …` → it diffs body+citations and tells you exactly what to do:
- **Re-verify only the delta** — full entailment on `added` + `claim-rebound` citations; for `unchanged`, **carry forward the prior entailment but re-check LIVENESS only** (cheap; link-rot drifts independent of the edit → a newly-dead carried citation demotes to `unverifiable`).
- **Re-score only dimensions the diff touches**; untouched dims inherit prior scores. Explicitly answer: *was the prior `top_fix` addressed?*
- **Regression GATE (new, flag-only):** any per-dim Δ<0, claim-ratio drop, or a previously-supported claim now contradicted/rotted → loud `🔴 REGRESSION` + log; do NOT auto-act (human/agent decides rollback vs re-revise).
- **Hermes stays BLIND to prior numeric scores** — give it the changed text + prior top-fix as a TASK, not v(N-1)'s numbers (preserves independence). Track diff-mode vs full-mode agreement separately (leniency-drift).
- `revision-eval.mjs record …` then logs the trust primitives to `memory/eval-history.md`: **independent-survival%** (survival counts only across ANOTHER agent — WikiTrust), **Beta trust mean±ci** (tightens with independent evidence), **settledness** (new/settling/settled/contested/unstable), **decay-wt** (stale eval on a volatile topic → re-eval). Surface the v1→vN trajectory + trust in the thread; one delta line in-channel.
- **Major rewrite (survival < ~35%)** → do a FULL eval, not a diff (the diff is meaningless).

## Calibration history
Append per-eval agreement here over time (exact-match %, within-±1 %, overall delta, which dim diverged). Baseline (Run 001, node 1): 4.25/5, GATE PASS, 5/6 dims exact, 6/6 within ±1. If a dimension systematically diverges, refine this rubric and re-send Hermes its standing instructions (`hermes/eval-partner-instructions.md`).
