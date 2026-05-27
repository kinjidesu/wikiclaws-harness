#!/usr/bin/env node
/**
 * guard-post.mjs — PreToolUse hook that makes the white-hat distribution policy STRUCTURAL.
 * Reads the Claude Code tool-call payload from stdin ({tool_name, tool_input, ...}); if the call
 * is an EXTERNAL social-post action it runs the policy-guard ruleset and BLOCKS (exit 2) on any
 * violation or any off-Moltbook auto-post. Everything else (normal Bash, Slack eval posts,
 * Playwright QA, reads) passes through instantly (exit 0). The only sanctioned auto path is
 * scripts/distribute.mjs (which self-guards) — raw posting is funneled back through it.
 *
 * Contract: exit 0 = allow; exit 2 = block (stderr is shown to the model). Fails OPEN on an
 * unparseable payload so it never wedges a normal session (the matcher already scopes it).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const POLICY_GUARD = fileURLToPath(new URL("../policy-guard.mjs", import.meta.url));

let payload = {};
try { payload = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
const tool = payload.tool_name || "";
const ti = payload.tool_input || {};

function block(reason) {
  process.stderr.write(
    `⛔ policy-guard (growth guardrail) blocked this action.\n${reason}\n` +
    `Route posts through scripts/distribute.mjs — Moltbook auto-posts (it self-guards), ` +
    `off-Moltbook goes to the human-approval queue with disclosure. See memory/growth-strategy.md.\n`
  );
  process.exit(2);
}

// Raw external-social posting signatures (API / browser endpoints) we refuse from raw Bash.
const SOCIAL = [
  { p: "reddit",   re: /oauth\.reddit\.com|reddit\.com\/api|\/api\/submit\b/i },
  { p: "x",        re: /api\.(twitter|x)\.com|\/2\/tweets\b|\/1\.1\/statuses\/update/i },
  { p: "moltbook", re: /moltbook\.com\/api/i },
];

if (tool === "Bash") {
  const cmd = String(ti.command || "");
  if (/distribute\.mjs/.test(cmd)) process.exit(0);          // sanctioned, self-guarded path
  const hit = SOCIAL.find(s => s.re.test(cmd));
  if (hit) block(`Raw ${hit.p} posting detected in a Bash command — this bypasses policy-guard + the human-approval gate.`);
  process.exit(0);                                            // ordinary Bash
}

// External-social MCP send tools → lint the message text via policy-guard (auto intent).
if (/^mcp__.*(moltbook|reddit|twitter|tweet|mastodon)/i.test(tool)) {
  const platform = /moltbook/i.test(tool) ? "moltbook" : /reddit/i.test(tool) ? "reddit" : /twitter|tweet/i.test(tool) ? "x" : "other";
  const body = ti.message || ti.text || ti.body || ti.content || ti.status || "";
  const draft = { platform, body, evalPassed: false, citabilityPassed: false };
  const r = spawnSync("node", [POLICY_GUARD, "lint", "-", "--json", "--platform", platform, "--intent", "auto"], { input: JSON.stringify(draft), encoding: "utf8" });
  let res = {}; try { res = JSON.parse(r.stdout || "{}"); } catch {}
  if (res.ok === false) block((res.violations || []).map(v => `✗ ${v.rule} — ${v.detail}`).join("\n"));
  process.exit(0);
}

process.exit(0); // not a distribution post (Slack eval, Playwright QA, reads, …)
