import assert from "node:assert/strict";
import test from "node:test";
import { answerQuestion } from "../src/answers.js";
import { calculateShareValueChange, formatElapsed } from "../src/performance.js";

function performanceSnapshot({ start = "1000000", end = "1100000", elapsed = "100000", status = "ok" } = {}) {
  const observations = ["SRC-A", "SRC-B", "SRC-C", "SRC-D", "SRC-J", "SRC-P"].map((id) => ({ id, status: "ok", kind: "performance-test" }));
  const calculated = status === "ok" ? calculateShareValueChange(start, end, 6, elapsed) : {};
  return {
    observations, engineVersion: "3.0.0",
    positions: [
      { adapterId: "centrifuge-jtrsy-usdc", status: "ok", shareRaw: "0", balanceSourceId: "SRC-J" },
      { adapterId: "centrifuge-hyb-wrapped-usdc", status: "ok", shareRaw: "99670437472344590008", balanceSourceId: "SRC-P" }
    ],
    performance: status === "ok" ? {
      status, metric: "vault-share-value-change", fixedShareLabel: "1 JTRSY", assetSymbol: "USDC",
      start: { blockNumber: 100, timestamp: 1000, assetsRaw: start },
      end: { blockNumber: 200, timestamp: 1000 + Number(elapsed), assetsRaw: end },
      sourceIds: observations.map((o) => o.id), ...calculated
    } : { status: "error", metric: "vault-share-value-change", fixedShareLabel: "1 JTRSY", error: "historical archive unavailable", sourceIds: ["SRC-A"] }
  };
}

test("share-value formula preserves units and supports positive, zero, and negative changes", () => {
  const positive = calculateShareValueChange("1000000", "1100000", 6, 86400);
  assert.equal(positive.percentFormatted, "10");
  assert.equal(positive.deltaAssetsFormatted, "0.1");
  assert.equal(formatElapsed(positive.elapsedSeconds), "1d 0h 0m 0s");
  assert.equal(calculateShareValueChange("1000000", "1000000", 6, 1).percentFormatted, "0");
  const negative = calculateShareValueChange("1000000", "950000", 6, 3600);
  assert.equal(negative.percentFormatted, "-5");
  assert.equal(negative.deltaAssetsFormatted, "-0.05");
});

test("yield answer reports observed vault performance without claiming personal profit or APY", () => {
  const snapshot = performanceSnapshot();
  const answer = answerQuestion(snapshot, "What am I earning?");
  assert.equal(answer.status, "ok");
  assert.match(answer.answer, /vault share-value change over the observed period/i);
  assert.match(answer.answer, /1 JTRSY converted to 1 USDC/);
  assert.match(answer.answer, /10%/);
  assert.match(answer.answer, /not APR\/APY/);
  assert.match(answer.answer, /Personal realized earnings remain UNKNOWN/);
  assert.match(answer.answer, /no JTRSY position at the snapshot/);
  assert.match(answer.answer, /reference vault metric, not earnings from this wallet's holdings/);
  assert.match(answer.answer, /non-zero pRNH position remains unavailable unless independently verified/);
  assert.match(answer.answer, /JTRSY metric does not apply to pRNH/);
  assert.ok(answer.sourceIds.includes("SRC-J"));
  assert.ok(answer.sourceIds.includes("SRC-P"));
  assert.doesNotMatch(answer.answer, /current position.*earnings/i);
  assert.ok(answer.sourceIds.every((id) => snapshot.observations.some((o) => o.id === id)));
});

test("missing historical data preserves honest UNKNOWN with cited failure evidence", () => {
  const snapshot = performanceSnapshot({ status: "error" });
  const answer = answerQuestion(snapshot, "What yield am I earning?");
  assert.equal(answer.status, "unknown");
  assert.match(answer.answer, /historical archive unavailable/);
  assert.match(answer.answer, /No current position value is relabeled as earnings/);
  assert.deepEqual(answer.sourceIds, ["SRC-A"]);
});
