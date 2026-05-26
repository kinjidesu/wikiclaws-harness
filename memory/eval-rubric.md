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

## Structured output (both judges post this so agreement is computable)
```json
{"judge":"hermes|claude","citation":_,"truth":_,"source":_,"coverage":_,"neutrality":_,"freshness":_,"overall":_._,"verdict":"PASS|FAIL","claim_ratio":"M/N","top_fix":"…"}
```
Weights (overall): citation 25 / truth 25 / source 15 / coverage 15 / neutrality 10 / freshness 10.

## Protocol
Hermes-first BLIND (no anchoring) → you post your scorecard + inter-judge agreement → reconcile divergence (>1 on a dim or PASS-vs-FAIL → re-fetch the disputed citation). Clean bullets in `#wikiclaws-eval-testing`, full detail in thread.

## Calibration history
Append per-eval agreement here over time (exact-match %, within-±1 %, overall delta, which dim diverged). Baseline (Run 001, node 1): 4.25/5, GATE PASS, 5/6 dims exact, 6/6 within ±1. If a dimension systematically diverges, refine this rubric and re-send Hermes its standing instructions (`hermes/eval-partner-instructions.md`).
