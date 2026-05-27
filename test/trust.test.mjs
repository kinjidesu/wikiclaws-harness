import { test } from "node:test";
import assert from "node:assert/strict";
import { normUrl, classifyCitations, betaTrust, settledness } from "../scripts/lib/trust.mjs";

test("normUrl: strip scheme/www/query/fragment/trailing slash", () => {
  assert.equal(normUrl("https://www.Reuters.com/a/?utm_source=x#sec"), "reuters.com/a");
  assert.equal(normUrl("http://example.com/p/"), "example.com/p");
});

test("classifyCitations: added / removed / unchanged", () => {
  const prev = [{ url: "https://reuters.com/a" }, { url: "https://ap.org/b" }];
  const curr = [{ url: "https://reuters.com/a" }, { url: "https://who.int/d" }];
  const r = classifyCitations(prev, curr, "");   // no changed text → reuters unchanged
  assert.equal(r.unchanged.length, 1);
  assert.equal(r.added.length, 1);
  assert.equal(r.removed.length, 1);
  assert.equal(normUrl(r.added[0].url), "who.int/d");
  assert.equal(normUrl(r.removed[0].url), "ap.org/b");
});

test("classifyCitations: claim-rebound when [[n]] marker is on a changed line", () => {
  const prev = [{ url: "https://reuters.com/a" }];
  const curr = [{ url: "https://reuters.com/a" }];
  const r = classifyCitations(prev, curr, "the new sentence cites [[1]] differently");
  assert.equal(r.rebound.length, 1);             // URL same but claim moved → must re-verify
  assert.equal(r.unchanged.length, 0);
});

test("betaTrust: confidence tightens with independent evidence", () => {
  const one = betaTrust([4.5], 0);
  assert.equal(one.mean, 4.5);
  assert.equal(one.ci, 0.8);                      // n=1, no indep → widest
  const many = betaTrust([4.3, 4.7, 4.5], 1);     // effective = 3 + 1 = 4
  assert.equal(many.mean, 4.5);
  assert.equal(many.ci, 0.4);                     // 0.8/sqrt(4)
  assert.ok(many.ci < one.ci);
});

test("settledness: baseline / regression / settled / unproven / contested", () => {
  assert.equal(settledness({ baseline: true }).label, "new");
  assert.equal(settledness({ regression: true, bestIndep: 90, judgeGap: 0 }).label, "unstable");
  assert.equal(settledness({ churn: 2, bestIndep: 82, judgeGap: 0.1 }).label, "settled");
  assert.equal(settledness({ churn: 2, bestIndep: 30, judgeGap: 0.2 }).label, "unproven");
  assert.equal(settledness({ churn: 2, bestIndep: 90, judgeGap: 1.5 }).label, "contested");
});
