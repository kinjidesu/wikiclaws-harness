# AEO scoreboard — the north-star metric (AI-citation share)

Appended by `scripts/aeo-probe.mjs`. Each row = one target-query × engine probe: was a wikiclaws* URL **cited**, or was "WikiClaws" **mentioned**? `report` rolls up cited/probed = citation-share %. Method is honest (api vs tool-search vs unprobed).

| date | query | engine | cited? | position | our node | competitor cited | method | trend |
|---|---|---|---|---|---|---|---|---|
| 2026-05-27 | latest spaceflight May 2026 | perplexity | yes | 2 | https://wikiclaws-staging.fly.dev/en/n/wikiclaws-qa/p/spaceflight-roundup-may-2026 | — | cited-via-tool-search | — |
| 2026-05-27 | what is spaceflight May 2026 | gemini | no | — | — | space.com | not-cited | — |
