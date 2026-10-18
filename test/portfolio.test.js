import assert from "node:assert/strict";
import test from "node:test";
import { answerQuestion } from "../src/answers.js";
import { CHAIN_ID, SELECTORS, TOKENS, VAULTS } from "../src/constants.js";
import { readPortfolio } from "../src/portfolio.js";

const WALLET = "0x197afc201b8d839288d7a7e9a03fb95669e3b0f3";
const BLOCK = 123456;
const word = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;
const addressWord = (address) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
const addr = (value) => value.toLowerCase();

function fakeMcp(options = {}) {
  const calls = [];
  const balances = {
    [addr(TOKENS.usdc.address)]: 2_000_000n,
    [addr(TOKENS.jtrsy.address)]: 0n,
    [addr(TOKENS.hyb.address)]: 7_000_000_000_000_000_000n,
    [addr(TOKENS.prnh.address)]: 10_000_000_000_000_000_000n
  };
  const decimals = Object.fromEntries(Object.values(TOKENS).map((token) => [addr(token.address), token.expectedDecimals]));
  const call = async (name, args = {}) => {
    calls.push({ name, args: structuredClone(args) });
    if (name === "get_chain_info") return { chainId: CHAIN_ID };
    if (name === "get_block_number") return { blockNumber: BLOCK };
    if (name === "get_block") return { hash: `0x${"ab".repeat(32)}`, timestamp: args.block === BLOCK ? "0x30d40" : "0x186a0" };
    if (name === "get_code") {
      if (addr(args.address) === addr(options.failCode || "0x0000000000000000000000000000000000000000")) throw new Error("injected code failure");
      return { code: "0x60006000" };
    }
    if (name === "get_balance") return { balanceWei: "1000000000000000000" };
    if (name !== "eth_call") throw new Error(`unexpected tool ${name}`);
    const to = addr(args.transaction.to);
    const data = args.transaction.data.toLowerCase();
    if (data === SELECTORS.decimals) return { result: word(decimals[to]) };
    if (data.startsWith(SELECTORS.balanceOf)) {
      const holder = `0x${data.slice(-40)}`;
      if (options.failWalletToken && to === addr(options.failWalletToken) && holder === WALLET) throw new Error("injected balance failure");
      if (to === addr(TOKENS.hyb.address) && holder === addr(TOKENS.prnh.address)) return { result: word(100_000_000_000_000_000_000n) };
      return { result: word(balances[to] ?? 0n) };
    }
    if (data === SELECTORS.asset) return { result: addressWord(TOKENS.usdc.address) };
    if (data === SELECTORS.share) {
      if (to === addr(VAULTS[0].address)) return { result: addressWord(options.wrongJtrsyShare || TOKENS.jtrsy.address) };
      if (to === addr(VAULTS[1].officialBaseVault)) return { result: addressWord(options.wrongBaseShare || TOKENS.hyb.address) };
    }
    if (data === SELECTORS.totalAssets) return { result: word(1_000_000_000n) };
    if (data.startsWith(SELECTORS.convertToAssets)) {
      const shares = BigInt(`0x${data.slice(-64)}`);
      if (to === addr(VAULTS[0].address)) {
        if (shares === 0n) return { result: word(0n) };
        if (args.block !== BLOCK && options.failHistoricalConversion) throw new Error("injected historical archive failure");
        return { result: word(args.block === BLOCK ? (options.performanceEnd ?? 1_100_000n) : (options.performanceStart ?? 1_000_000n)) };
      }
      if (to === addr(VAULTS[1].address)) return { result: word(9_500_000n) };
    }
    throw new Error(`unexpected eth_call ${to} ${data.slice(0, 10)}`);
  };
  return { call, tools: ["get_chain_info", "get_block_number", "get_block", "get_code", "get_balance", "eth_call"], calls };
}

test("adapters pin every read, verify receipt relationships, and convert exact balances", async () => {
  const mcp = fakeMcp();
  const snapshot = await readPortfolio(WALLET, { mcp, capturedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(snapshot.engineVersion, "3.0.0");
  assert.equal(snapshot.block.number, BLOCK);
  assert.deepEqual(snapshot.positions.map((p) => p.status), ["ok", "ok"]);
  assert.equal(snapshot.positions[0].underlyingRaw, "0");
  assert.equal(snapshot.positions[1].underlyingRaw, "9500000");
  assert.equal(snapshot.performance.status, "ok");
  assert.equal(snapshot.performance.percentFormatted, "10");
  const jtrsyRelationship = snapshot.observations.find((o) => o.kind === "vault-relationship" && o.adapterId === VAULTS[0].id);
  assert.equal(jtrsyRelationship.share, addr(TOKENS.jtrsy.address));
  const chainReads = mcp.calls.filter(({ name }) => ["get_block", "get_code", "get_balance", "eth_call"].includes(name));
  assert.ok(chainReads.every(({ args }) => [BLOCK, BLOCK - 100000].includes(args.block)), "all chain reads use the current or fixed historical pinned block");
  assert.ok(chainReads.some(({ args }) => args.block === BLOCK - 100000), "historical adapter uses the exact fixed lookback block");
});

test("required code or relationship failures exclude only affected positions", async () => {
  const codeFailure = await readPortfolio(WALLET, { mcp: fakeMcp({ failCode: VAULTS[0].address }) });
  assert.equal(codeFailure.positions[0].status, "error");
  assert.equal(codeFailure.positions[1].status, "ok");
  assert.equal(codeFailure.accounting.vaultUnderlyingUsdcRaw, "9500000");
  assert.equal(codeFailure.observations.find((o) => o.kind === "wallet-token" && o.adapterId === "usdc").status, "ok");

  const wrongShare = await readPortfolio(WALLET, { mcp: fakeMcp({ wrongJtrsyShare: TOKENS.hyb.address }) });
  assert.equal(wrongShare.positions[0].status, "error");
  assert.match(wrongShare.positions[0].error, /relationship unavailable/i);

  const badBacking = await readPortfolio(WALLET, { mcp: fakeMcp({ wrongBaseShare: TOKENS.jtrsy.address }) });
  assert.equal(badBacking.positions[1].status, "error");
  assert.match(badBacking.positions[1].error, /backing\/base-vault/i);
});

test("successful zero and failed balance remain distinct", async () => {
  const zero = await readPortfolio(WALLET, { mcp: fakeMcp() });
  assert.equal(zero.positions[0].status, "ok");
  assert.equal(zero.positions[0].shareRaw, "0");
  const failed = await readPortfolio(WALLET, { mcp: fakeMcp({ failWalletToken: TOKENS.jtrsy.address }) });
  assert.equal(failed.positions[0].status, "error");
  assert.equal(failed.observations.find((o) => o.kind === "wallet-token" && o.adapterId === "jtrsy").status, "error");
});

test("all checked wallet balances include standalone HYB without receipt double counting", async () => {
  const snapshot = await readPortfolio(WALLET, { mcp: fakeMcp() });
  const answer = answerQuestion(snapshot, "What tokens do I hold?");
  for (const symbol of ["PROS", "USDC", "JTRSY", "HYB", "pRNH"]) assert.match(answer.answer, new RegExp(symbol));
  assert.equal(answer.answer.match(/10 pRNH/g)?.length, 1);
  assert.equal(snapshot.accounting.vaultUnderlyingUsdcRaw, "9500000");
  assert.ok(answer.sourceIds.every((id) => snapshot.observations.some((o) => o.id === id)));
});

test("historical source failure keeps portfolio reads and honest yield fallback", async () => {
  const snapshot = await readPortfolio(WALLET, { mcp: fakeMcp({ failHistoricalConversion: true }) });
  assert.equal(snapshot.positions[0].status, "ok");
  assert.equal(snapshot.performance.status, "error");
  assert.match(snapshot.performance.error, /archive failure/);
  const answer = answerQuestion(snapshot, "What am I earning?");
  assert.equal(answer.status, "unknown");
  assert.match(answer.answer, /archive failure/);
  assert.ok(answer.sourceIds.every((id) => snapshot.observations.some((o) => o.id === id)));
});
