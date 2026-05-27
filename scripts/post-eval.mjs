#!/usr/bin/env node
/**
 * post-eval.mjs — post a CONCISE eval card to Slack.
 *   node scripts/post-eval.mjs <eval.json> [--thread <ts>]
 * If SLACK_BOT_TOKEN is set (a Slack app bot token invited to the channel), posts a polished
 * Block Kit card via chat.postMessage. Otherwise prints a clean MARKDOWN fallback you can paste
 * via your normal Slack tool (the claude.ai connector is markdown-only — no Block Kit support).
 *
 * eval.json shape:
 * { "title": "...", "viewerUrl": "...", "verdict": "PASS|FAIL", "overall": 4.2, "claim_ratio": "11/13",
 *   "scores": {"citation":5,"truth":4,"source":4,"coverage":4,"neutrality":5,"freshness":5},
 *   "hermes_overall": 4.0, "claude_overall": 4.2, "agreement": "±0.2 (5/6 exact)",
 *   "top_fix": "...", "kind": "NEW|CONTRIBUTED", "by": "claude/<namespace>",
 *   // OPTIONAL revision fields (from revision-eval.mjs) — turns the card into a REVISION card:
 *   "delta": 0.2, "prev_version": 2, "trust": "4.6 ± 0.3 (n=5, 3 indep)",
 *   "survival_pct": 88, "indep_survival_pct": 71, "reverified_ratio": "2/15",
 *   "settledness": "settled", "regression": "" }
 */
import { readFileSync } from "node:fs";
const file = process.argv[2];
if (!file) { console.error("usage: post-eval.mjs <eval.json> [--thread <ts>]"); process.exit(2); }
const thread = (i => i >= 0 ? process.argv[i + 1] : undefined)(process.argv.indexOf("--thread"));
const e = JSON.parse(readFileSync(file, "utf8"));
const s = e.scores || {};
const isRev = e.delta != null || e.survival_pct != null;
const emoji = e.regression ? "🔴" : (e.verdict === "PASS" ? "🟢" : "🔴");
const scoreLine = `cite ${s.citation} · truth ${s.truth} · src ${s.source} · cov ${s.coverage} · neut ${s.neutrality} · fresh ${s.freshness}`;
const chan = process.env.WIKICLAWS_EVAL_CHANNEL || process.env.SLACK_CHANNEL;
const kindTag = isRev ? `REVISION v${e.prev_version != null ? e.prev_version + 1 : "?"}` : (e.kind || "NEW");
const deltaTag = e.delta != null ? ` (${e.delta >= 0 ? "▲ +" : "▼ "}${e.delta} vs v${e.prev_version})` : "";
const trustTag = e.trust ? ` · trust ${e.trust}` : "";
const revLine = isRev ? `\n♻️ ${e.survival_pct}% survival (${e.indep_survival_pct ?? "?"}% independent) · re-verified ${e.reverified_ratio ?? "?"} · settledness: ${e.settledness ?? "?"}` : "";
const regLine = e.regression ? `\n🔴 REGRESSION ⚠️ ${e.regression}` : "";

// NOTE: link with a BOUNDED markdown [label](url) — a bare URL gets auto-linked greedily across
// the newline and swallows the next line's text into the hyperlink (verified live). Bounded = safe.
const markdown = `${emoji} *${e.title}* — *${e.verdict} ${e.overall}/5*${deltaTag} · claims ${e.claim_ratio} · ${kindTag} · by ${e.by || "?"}\n` +
  `\`${scoreLine}\`  ·  Hermes ${e.hermes_overall} / Claude ${e.claude_overall} (agree ${e.agreement})${trustTag}\n` +
  `📄 [view node](${e.viewerUrl}) · top-fix: ${e.top_fix}${revLine}${regLine} · 🧵 ${isRev ? "trajectory + citation-diff" : "full scorecards"} in thread`;

const blocks = [
  { type: "header", text: { type: "plain_text", text: `${emoji} ${e.verdict} ${e.overall}/5${deltaTag} — ${e.title}`.slice(0, 150), emoji: true } },
  { type: "section", fields: [
    { type: "mrkdwn", text: `*Claim-verified:*\n${e.claim_ratio}` },
    { type: "mrkdwn", text: `*${isRev ? "Revision" : "Kind"}:*\n${kindTag}` },
    { type: "mrkdwn", text: `*Scores:*\n${scoreLine}` },
    { type: "mrkdwn", text: `*Judges:*\nHermes ${e.hermes_overall} / Claude ${e.claude_overall} (agree ${e.agreement})` },
    ...(isRev ? [{ type: "mrkdwn", text: `*Survival:*\n${e.survival_pct}% (${e.indep_survival_pct ?? "?"}% indep)` }, { type: "mrkdwn", text: `*Trust / settled:*\n${e.trust ?? "?"} · ${e.settledness ?? "?"}` }] : []),
  ] },
  ...(e.regression ? [{ type: "context", elements: [{ type: "mrkdwn", text: `🔴 *REGRESSION:* ${e.regression}` }] }] : []),
  { type: "context", elements: [{ type: "mrkdwn", text: `*Top fix:* ${e.top_fix}  ·  by ${e.by || "?"}  ·  full detail in 🧵` }] },
  { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "View node" }, url: e.viewerUrl }] },
  { type: "divider" },
];

if (process.env.SLACK_BOT_TOKEN && chan) {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: chan, text: `${e.verdict} ${e.overall}/5 — ${e.title}`, blocks, ...(thread ? { thread_ts: thread } : {}) }),
  });
  const j = await r.json();
  console.log(j.ok ? `✅ posted Block Kit card (ts ${j.ts})` : `⚠️ Slack error: ${j.error}\nFalling back — paste this markdown:\n\n${markdown}`);
} else {
  console.log("No SLACK_BOT_TOKEN/channel set — Block Kit needs a Slack-app bot token. Paste this MARKDOWN via your Slack tool:\n");
  console.log(markdown);
  console.log("\n(Block Kit JSON for reference:)\n" + JSON.stringify(blocks));
}
