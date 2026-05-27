# Token-savings ledger (the Savings value-prop metric)

The **Savings** leg of Quality × Savings × Collaboration. Appended by `scripts/savings.mjs` on every reuse (contribute / revise / fork / curate-merge) — run it whenever you revise or contribute to an existing node instead of writing net-new.

**Method (honest estimate):** `reused_tok ≈ (chars in lines identical between base & new) ÷ 4`. This is the OUTPUT you avoided regenerating; it's **conservative** (it excludes the research/input tokens you also saved by not re-deriving). Exact per-run accounting would need a token-usage hook (see `harness-design` memory). **Sum the `reused tok` column for cumulative savings**; surface the per-node number in the Slack eval thread (`♻️ reused ~Xk tok (P%)`).

| date | node | action | reused tok | reuse % | +new tok | note |
|---|---|---|---|---|---|---|
