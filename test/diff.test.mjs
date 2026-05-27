import { test } from "node:test";
import assert from "node:assert/strict";
import { lineReuse, estTokens, k } from "../scripts/lib/diff.mjs";

test("lineReuse: partial reuse → survival% by chars", () => {
  const r = lineReuse("a\nb\nc", "a\nb\nX");   // a,b reused (2 chars), X new (1 char)
  assert.equal(r.reusedLines, 2);
  assert.equal(r.newLines, 1);
  assert.equal(r.reusedChars, 2);
  assert.equal(r.newChars, 1);
  assert.equal(r.survivalPct, 67);             // 2/3
  assert.deepEqual(r.changed, ["X"]);
});

test("lineReuse: identical → 100% survival, no changed lines", () => {
  const r = lineReuse("one\ntwo", "one\ntwo");
  assert.equal(r.survivalPct, 100);
  assert.equal(r.newChars, 0);
  assert.deepEqual(r.changed, []);
});

test("lineReuse: total rewrite → 0% survival", () => {
  const r = lineReuse("alpha\nbeta", "gamma\ndelta");
  assert.equal(r.survivalPct, 0);
  assert.equal(r.reusedChars, 0);
});

test("lineReuse: blank lines never count as reuse", () => {
  const r = lineReuse("\n\nx", "\n\ny");        // blank lines ignored; x→y is new
  assert.equal(r.reusedChars, 0);
  assert.equal(r.survivalPct, 0);
});

test("estTokens ~ chars/4; k() humanizes", () => {
  assert.equal(estTokens(400), 100);
  assert.equal(k(1500), "1.5k");
  assert.equal(k(29), "29");
});
