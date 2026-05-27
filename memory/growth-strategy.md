# WikiClaws growth strategy — the canon

This is the **hand-authored source of truth** for the growth/distribution loop (the "Verified Answer Flywheel"). `scripts/policy-guard.mjs` enforces the **BANNED** table below before anything is posted; `scripts/aeo-probe.mjs` tracks the **north star**. Read this before any distribution work. It is version-controlled so every agent (Claude, Hermes, openclaw, Codex) shares one policy.

The thesis in one line: **WikiClaws's mission ("provenance, not votes" — every claim source-verified, every author named, every page dated) IS an EEAT thesis.** We don't manufacture authority; we make WikiClaws's real authority *legible to crawlers + AI answer engines* and *amplify it on-policy*. The spammy growth-hack version of "go viral" is **self-defeating** — it triggers Google penalties and platform bans that destroy the very trust we're building.

---

## North star: AI-citation share
The one metric the loop optimizes: **when a human or agent asks an AI answer engine (ChatGPT / Perplexity / Google AI Overviews / Claude / Gemini) about a topic we cover, is WikiClaws the cited or mentioned source?** Tracked per `target query × engine` in `memory/aeo-scoreboard.md`; rolled up as `cited / probed = citation-share %`. It is the leading indicator of everything downstream (traffic → signups → paid links/affiliations → data licensing → acquisition): you cannot sell a knowledge asset until AI trusts it as a source.

### Why mentions > backlinks (the core insight)
2026 research: **unlinked brand mentions correlate with AI citation at ~0.664; backlinks at only ~0.218** — a ~3× gap. ChatGPT mentions brands ~3.2× more often than it links them; ~85% of mentioned brands have no citation link. → **Optimize for being mentioned as a trustworthy source across many credible surfaces, not for link counts.** A genuine, useful, *disclosed* answer that names WikiClaws beats ten link-drops.

---

## E-E-A-T → what the harness actually does
- **Experience** — nodes are web-verified, primary-source roundups dated at `compiledAt`; the verify step attaches a supporting quote per citation = demonstrated first-hand rigor. `wikiclaws-citability` frames each node as original research with a quotable answer block.
- **Expertise** — named authors + h-index; topical depth via clustered `target-queries.md` (build deep, not broad).
- **Authoritativeness** — the north star (AI-citation share) + unlinked mentions (`mentions-ledger.md`) + digital-PR/HARO + dense internal graph links (`wikiclaws-graph`).
- **Trustworthiness** — provenance model + the citation-accuracy GATE (existing eval) + **mandatory disclosure** on distributed content + `policy-guard` refusing manipulation + filing the technical gaps (JSON-LD, canonical) as product feedback.

---

## White-hat compounding tactics (DO)
1. **Original-research linkable assets.** Treat each verified node as a citable primary source; pitch genuinely newsworthy ones to journalists (digital PR is the highest-ROI link tactic in 2026). Drafts only — a human sends.
2. **AEO-structured answers.** Put a self-contained 40–60-word answer in the first ~150 words of every node (≈55% of AI-Overview citations come from the first 30% of content). Date time-sensitive facts. Cite primary sources.
3. **Genuine Moltbook participation.** Moltbook is agent-native (agents post/vote, humans read-only) — automated agent posting is *on-policy* there. Contribute real value to relevant submolts and cite WikiClaws where it genuinely answers.
4. **Human-approved, disclosed social.** Reddit/X = AI-drafted → human-approved → disclosed, at a 90:10 value-to-promotion ratio. Answer the question first; mention WikiClaws only where it's the best source.
5. **Expert sourcing (HARO/Qwoted/Featured).** Respond to journalist queries fast with genuine expertise → bylines + unlinked brand mentions.
6. **Dense internal linking + freshness.** Keep nodes fresh and graph-linked; both feed AEO + EEAT.

---

## BANNED — hard refuse (the policy-guard ruleset)
`policy-guard.mjs` blocks a draft (exit 1) on any of these. Rule ids are stable and match the script's ruleset.

| rule-id | what it is | why we refuse (penalty) |
|---|---|---|
| `auto-post-off-moltbook` | auto-posting to any platform other than Moltbook without a human approval | Reddit/X ban automated/undisclosed posting (CQS, platform-manipulation). Off-Moltbook MUST go through the human-approval queue. |
| `undisclosed-ai` | an off-Moltbook post missing the AI-disclosure string | FTC requires disclosing AI personas/sponsorship (Dec-2025 Rytr action); platforms ban undisclosed bots. Brand is liable. |
| `fake-persona` | posing as an unaffiliated human / sock-puppet / astroturf identity | Deceptive; platform + FTC violation; erodes the Trust pillar we're building. |
| `undisclosed-astroturf` | coordinated "organic"-looking promotion that hides the WikiClaws affiliation | Astroturfing = platform manipulation; if exposed, torches EEAT. |
| `mass-cross-post` | the same/near-duplicate text posted across many places/accounts | X/Reddit ban duplicative posting; Google "scaled content abuse". (Detected via near-duplicate diff vs recent queue.) |
| `parasite-seo` | placing our content on third-party sites to exploit their ranking signals | Google "site reputation abuse" (Nov-2024+) penalizes host AND us even with host approval (−50–89% traffic). |
| `pbn` / `pay-for-link` | private blog networks, link farms, buying links/placements | Explicit Google link-scheme violation; SpamBrain detects PBNs; manual actions. |
| `scaled-unsupervised` | auto-distributing a node that has NOT passed eval + citability | "Scaled content abuse" hits unsupervised AI content (−50–80%); distribution must follow quality gates, never precede them. |

If a tactic looks like fast growth but appears here, it **loses** — it trades durable authority for a penalty. Refuse and explain; propose the white-hat equivalent.

---

## Disclosure policy
- **Required string** (env `WIKICLAWS_DISCLOSURE`, default): `"🤖 Posted by an AI agent on behalf of WikiClaws."`
- **Where:** off-Moltbook posts (Reddit/X/HARO/PR) MUST include it (a tagline, bio line, or explicit sentence). Moltbook is agent-native so identity-as-agent is inherent, but still cite WikiClaws transparently.
- **Affiliation:** never hide that the author/operator is affiliated with WikiClaws. Mentions must be honest ("I help build WikiClaws; it has a verified roundup on this: <url>").

## Channel rules (summary)
| channel | auto-post? | rule |
|---|---|---|
| **Moltbook** | ✅ yes (agent-native, on-policy) | policy-guard must pass; node must have passed eval+citability; cite WikiClaws honestly |
| **Reddit / X** | ❌ never auto | AI-draft → human-approve (queue) → disclosed; 90:10 value:promotion |
| **Digital-PR / HARO** | ❌ never auto | agent drafts the pitch; a human sends it |

---

## Sources (2026 research)
EEAT + scaled-content/parasite-SEO: developers.google.com/search spam-policies + site-reputation-abuse (Nov 2024); koanthic.com AI-content guidelines 2026; digitalapplied.com scaled-content March update. Mentions>backlinks: soar.sh backlinks-vs-brand-mentions; cassieclarkmarketing.com brand-mentions-and-citations. AEO/citation drivers: frase.io AEO guide; resources.averi.ai AI-search-citation-benchmarks. Link building: novo-marketing.com white-hat; outpaceseo.com link-building. Platform policy: teract.ai/aibrify Reddit 2026; opentweet.io / help.x.com X automation; humanadsai.com / promise.legal FTC AI disclosure 2026. Moltbook: en.wikipedia.org/wiki/Moltbook; moltbook.com/developers. Monetization: bnnbloomberg Wikipedia/Wikimedia-Enterprise licensing; communipass.com knowledge-monetization-2026.
