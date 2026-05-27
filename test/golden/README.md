# Eval-of-the-eval — the golden set (proves the quality gate isn't theater)

A trust product's eval is only worth something if it **catches a bad node**. This is a repeatable
integration check (needs `WIKICLAWS_API_KEY` + network) that the SAFE-style verifier + the
citation GATE behave correctly across three cases. Canonical golden node:
`wikiclaws-qa/model-collapse-ai-web-content-evidence-2026` (id `95cd0f86-452c-4a0e-8719-c996b00e5089`).

## 1. GOOD — supported claims → PASS
```
node --env-file=.env scripts/verify.mjs <goldenNodeId> --claims test/golden/good-claims.json
```
Expected: all reachable, every claim **supported** by its cited source → precision **5/5**, GATE PASS.
(Validated 2026-05-27: PASS 4.8/5, precision 5/5.)

## 2. BAD — claims real sources DON'T support → GATE FAIL
```
node --env-file=.env scripts/verify.mjs <goldenNodeId> --claims test/golden/bad-claims.json
```
The citations are **real, reachable, reputable** — but the *claims* misuse them:
- "model collapse is impossible to prevent / irreversibly poisoned" cited to Shumailov → **unsupported** (the paper never says this).
- "accumulating data MAKES collapse worse" cited to Gerstgrasser → **contradicted** (the source title says it *avoids* collapse).
Expected: precision **0/2**, a **contradicted** claim → **GATE FAIL**. This proves the gate judges *entailment*, not mere reachability.

## 3. FABRICATED — non-existent URLs → "unverifiable", never "verified"
A fabricated `nature.com/articles/s41586-099-99999-z` or `arxiv.org/abs/9999.99999` returns ERR/404 →
the verifier marks it **unverifiable** (the reachability mode flags any non-200). A fabricated citation can never score "verified".

**Pass criteria:** good→PASS/high-precision, bad→GATE FAIL/low-precision, fabricated→unverifiable. If all three hold, the gate works.
