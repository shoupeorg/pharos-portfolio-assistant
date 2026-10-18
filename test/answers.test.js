import assert from "node:assert/strict";
import test from "node:test";
import { answerQuestion, detectAsset, detectIntent } from "../src/answers.js";
import { assertAddress, formatUnits } from "../src/fixed.js";

function fixture({ failSecond = false, zero = false } = {}) {
  const share = zero ? "0" : "99670437472344590008";
  const underlying = zero ? "0" : "98439173";
  return {
    id: "fixture", mode: "RECORDED", observations: [
      { id: "SRC-01", status: "ok", kind: "wallet-native", raw: "1355397260202594331120", formatted: "1355.3972602" },
      { id: "SRC-02", status: "ok", kind: "wallet-token", adapterId: "usdc", tokenKind: "wallet", raw: "2713245764", formatted: "2713.245764", symbol: "USDC" },
      { id: "SRC-03", status: "ok", kind: "wallet-token", adapterId: "jtrsy", tokenKind: "receipt", raw: "0", formatted: "0", symbol: "JTRSY" },
      { id: "SRC-04", status: "ok", kind: "wallet-token", adapterId: "hyb", tokenKind: "protocol-share", raw: "42", formatted: "0.000000000000000042", symbol: "HYB" },
      { id: "SRC-05", status: "ok", kind: "wallet-token", adapterId: "prnh", tokenKind: "receipt", raw: share, formatted: formatUnits(share, 18, 8), symbol: "pRNH" },
      { id: "SRC-06", status: "ok", kind: "position-underlying", adapterId: "centrifuge-jtrsy-usdc", raw: "0", formatted: "0", symbol: "USDC" },
      ...(!failSecond ? [{ id: "SRC-07", status: "ok", kind: "position-underlying", adapterId: "centrifuge-hyb-wrapped-usdc", raw: underlying, formatted: formatUnits(underlying, 6, 6), symbol: "USDC" }] : []),
      ...(failSecond ? [{ id: "SRC-07", status: "error", kind: "position-underlying", adapterId: "centrifuge-hyb-wrapped-usdc", error: "injected timeout" }] : [])
    ],
    positions: [
      { adapterId: "centrifuge-jtrsy-usdc", name: "JTRSY / USDC Vault", status: "ok", shareRaw: "0", shareFormatted: "0", receiptSymbol: "JTRSY", underlyingRaw: "0", underlyingFormatted: "0", underlyingSymbol: "USDC", balanceSourceId: "SRC-03", conversionSourceId: "SRC-06" },
      ...(failSecond ? [{ adapterId: "centrifuge-hyb-wrapped-usdc", name: "pNYLIM-HYB Third-party Wrapper", status: "error", error: "injected timeout" }] : [{ adapterId: "centrifuge-hyb-wrapped-usdc", name: "pNYLIM-HYB Third-party Wrapper", status: "ok", shareRaw: share, shareFormatted: formatUnits(share, 18, 8), receiptSymbol: "pRNH", underlyingRaw: underlying, underlyingFormatted: formatUnits(underlying, 6, 6), underlyingSymbol: "USDC", balanceSourceId: "SRC-05", conversionSourceId: "SRC-07" }])
    ]
  };
}

test("detects five English and Persian intent families with paraphrases", () => {
  const cases = [
    ["What tokens do I hold?", "balances"], ["موجودی کیف پولم چقدره؟", "balances"],
    ["Where is my USDC?", "asset_location"], ["USDC من کجاست؟", "asset_location"],
    ["Where is my USDC across vaults?", "asset_location"], ["USDC من در خزانه‌ها کجاست؟", "asset_location"],
    ["Which protocols am I using?", "positions"], ["چه موقعیت‌هایی توی پروتکل‌ها دارم؟", "positions"],
    ["What is my largest position?", "biggest"], ["بزرگ‌ترین موقعیتم کدومه؟", "biggest"],
    ["What am I earning?", "yield"], ["چقدر سود می‌گیرم؟", "yield"],
    ["wallet versus deposited", "allocation"], ["درصد دارایی واریز شده", "allocation"]
  ];
  for (const [question, intent] of cases) assert.equal(detectIntent(question), intent, question);
  assert.equal(detectAsset("HYB من کجاست؟"), "HYB");
});

test("answers are materially distinct and cite exact source IDs", () => {
  const snap = fixture();
  const questions = ["tokens I hold", "where is my USDC", "protocol positions", "biggest position", "what yield am I earning", "wallet versus deposited"];
  const answers = questions.map((q) => answerQuestion(snap, q));
  assert.equal(new Set(answers.map((x) => x.intent)).size, 6);
  assert.match(answers[1].answer, /2713\.245764 USDC/);
  assert.match(answers[3].answer, /98\.439173 USDC/);
  assert.equal(answers[4].status, "unknown");
  assert.match(answers[4].answer, /cost basis/);
  assert.ok(answers[5].sourceIds.includes("SRC-02"));
});

test("receipt token is disclosed but economic exposure is counted once", () => {
  const answer = answerQuestion(fixture(), "wallet versus deposited");
  assert.match(answer.answer, /not double counted/);
  assert.match(answer.answer, /96\.49%/);
});

test("balances include all successful checked tokens and location never assumes USDC", () => {
  const balances = answerQuestion(fixture(), "What tokens do I hold?");
  assert.match(balances.answer, /HYB protocol share token/);
  assert.match(balances.answer, /pRNH receipt token/);
  assert.equal(balances.answer.match(/99\.67043747 pRNH/g)?.length, 1);
  const mixed = answerQuestion(fixture(), "Where is my USDC across vaults?");
  assert.equal(mixed.intent, "asset_location");
  assert.match(mixed.answer, /USDC location/);
  const unsupported = answerQuestion(fixture(), "Where is my DAI across vaults?");
  assert.equal(unsupported.status, "unsupported");
  assert.doesNotMatch(unsupported.answer, /2713\.245764/);
});

test("zero position and failed read are distinct", () => {
  const zero = answerQuestion(fixture({ zero: true }), "protocol positions");
  assert.match(zero.answer, /successful zero/);
  const partial = answerQuestion(fixture({ failSecond: true }), "protocol positions");
  assert.equal(partial.status, "partial");
  assert.match(partial.answer, /READ FAILED/);
});

test("does not rank incomparable positions", () => {
  const snap = fixture();
  snap.positions.push({ ...snap.positions[1], adapterId: "other", name: "Other", underlyingSymbol: "ETH" });
  assert.equal(answerQuestion(snap, "biggest position").status, "unknown");
});

test("unsupported, ambiguous, and transaction requests are safe", () => {
  assert.equal(answerQuestion(fixture(), "weather tomorrow").status, "unsupported");
  assert.equal(answerQuestion(fixture(), "").status, "clarification");
  const refusal = answerQuestion(fixture(), "send my USDC");
  assert.equal(refusal.status, "refused");
  assert.match(refusal.answer, /strictly read-only/);
});

test("exact integer formatting handles large values and validates addresses", () => {
  assert.equal(formatUnits(123456789012345678901234567890n, 18, 6), "123456789012.345678");
  assert.equal(assertAddress("0x197afc201b8d839288d7a7e9a03fb95669e3b0f3"), "0x197afc201b8d839288d7a7e9a03fb95669e3b0f3");
  assert.throws(() => assertAddress("https://rpc.example"), /valid/);
});

test("every answer source ID resolves to an observation", () => {
  const snap = fixture();
  const known = new Set(snap.observations.map((o) => o.id));
  for (const question of ["tokens I hold", "where is my USDC", "protocol positions", "biggest position", "what yield am I earning", "wallet versus deposited", "HYB من کجاست؟"]) {
    const answer = answerQuestion(snap, question);
    assert.ok(answer.sourceIds.every((id) => known.has(id)), question);
    assert.equal(answer.engineVersion, "3.0.0");
  }
});
