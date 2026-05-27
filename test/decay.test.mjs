import { test } from "node:test";
import assert from "node:assert/strict";
import { HALF_LIFE, validityWindowDays, decayWt, isStale, inferVolatility, daysBetween } from "../scripts/lib/decay.mjs";

test("decayWt: 1.0 fresh, 0.5 at one half-life", () => {
  assert.equal(decayWt(0, "med"), 1);
  assert.equal(decayWt(HALF_LIFE.med, "med"), 0.5);
  assert.equal(decayWt(HALF_LIFE.high, "high"), 0.5);
  assert.ok(decayWt(400, "high") < 0.01);          // long past → ~0
});

test("validityWindowDays = 2× half-life", () => {
  assert.equal(validityWindowDays("high"), 60);
  assert.equal(validityWindowDays("med"), 180);
  assert.equal(validityWindowDays("low"), 730);
});

test("isStale: past the validity window", () => {
  assert.equal(isStale(61, "high"), true);
  assert.equal(isStale(59, "high"), false);
  assert.equal(isStale(200, "low"), false);        // evergreen still fresh at 200d
});

test("inferVolatility: dated/news=high, evergreen=low, else med", () => {
  assert.equal(inferVolatility(["taiwan", "2026", "geopolitics"]), "high");
  assert.equal(inferVolatility("Breaking news roundup"), "high");
  assert.equal(inferVolatility("History of the Roman Republic"), "low");
  assert.equal(inferVolatility("a definition glossary"), "low");
  assert.equal(inferVolatility("some neutral subject"), "med");
});

test("daysBetween: floor at 0, rounds", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-02-01", "2026-01-01"), 0);   // never negative
});
