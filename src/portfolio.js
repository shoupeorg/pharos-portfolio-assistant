import { CHAIN_ID, EXPLORER, MCP_URL, NETWORK, SELECTORS, TOKENS, VAULTS } from "./constants.js";
import { assertAddress, decodeAddress, decodeUint, encodeAddressCall, encodeUintCall, formatUnits } from "./fixed.js";
import { withPharosMcp } from "./pharos-mcp.js";

function id(prefix, index) { return `${prefix}-${String(index).padStart(2, "0")}`; }
function codeBytes(code) { return code === "0x" ? 0 : (code.length - 2) / 2; }

export async function readPortfolio(walletInput, options = {}) {
  const wallet = assertAddress(walletInput);
  const execute = async ({ call, tools }) => {
    const chain = await call("get_chain_info");
    if (Number(chain.chainId) !== CHAIN_ID) throw new Error(`Wrong MCP network: expected chain ${CHAIN_ID}, received ${chain.chainId}.`);
    const latest = await call("get_block_number");
    const blockNumber = Number(latest.blockNumber);
    const block = await call("get_block", { block: blockNumber, includeTransactions: false });
    const observations = [];
    let counter = 0;
    const add = (value) => { observations.push({ id: id("SRC", ++counter), blockNumber, ...value }); return observations.at(-1); };
    const safe = async (value, operation) => {
      try { return add({ ...value, status: "ok", ...(await operation()) }); }
      catch (error) { return add({ ...value, status: "error", error: error.message }); }
    };

    const contracts = [TOKENS.usdc.address, TOKENS.jtrsy.address, TOKENS.hyb.address, TOKENS.prnh.address, ...VAULTS.map((v) => v.address), VAULTS[1].officialBaseVault];
    const uniqueContracts = [...new Set(contracts.map((x) => x.toLowerCase()))];
    const codeObservations = new Map();
    for (const address of uniqueContracts) {
      const code = await safe({ kind: "bytecode", contract: address, method: "eth_getCode", arguments: [], requirement: "required" }, async () => {
        const result = await call("get_code", { address, block: blockNumber });
        const bytes = codeBytes(result.code);
        if (!bytes) throw new Error("No contract bytecode at pinned block.");
        return { raw: result.code, interpreted: `${bytes} byte runtime code`, bytes };
      });
      codeObservations.set(address, code);
    }

    await safe({ kind: "wallet-native", adapterId: "pros", contract: null, method: "get_balance", arguments: [wallet], decimals: 18 }, async () => {
      const result = await call("get_balance", { address: wallet, block: blockNumber });
      return { raw: result.balanceWei, formatted: formatUnits(result.balanceWei, 18, 8), symbol: "PROS" };
    });

    const tokenBalances = {};
    const tokenDecimals = {};
    for (const [key, token] of Object.entries(TOKENS)) {
      const tokenCode = codeObservations.get(token.address.toLowerCase());
      const decimalsObs = await safe({ kind: "token-decimals", adapterId: key, contract: token.address, method: "decimals", arguments: [], requirement: "required" }, async () => {
        if (tokenCode?.status !== "ok") throw new Error("Token bytecode verification failed.");
        const result = await call("eth_call", { transaction: { to: token.address, data: SELECTORS.decimals }, block: blockNumber });
        const decimals = Number(decodeUint(result.result, `${token.symbol}.decimals`));
        if (decimals !== token.expectedDecimals) throw new Error(`Expected ${token.expectedDecimals} decimals; observed ${decimals}.`);
        return { raw: result.result, decimals, interpreted: `${decimals}` };
      });
      tokenDecimals[key] = decimalsObs;
      const balanceObs = await safe({ kind: "wallet-token", adapterId: key, tokenKind: token.kind, contract: token.address, method: "balanceOf", arguments: [wallet], decimals: token.expectedDecimals, requirement: "required" }, async () => {
        if (decimalsObs.status !== "ok") throw new Error("Token decimals unavailable.");
        const result = await call("eth_call", { transaction: { to: token.address, data: encodeAddressCall(SELECTORS.balanceOf, wallet) }, block: blockNumber });
        const raw = decodeUint(result.result, `${token.symbol}.balanceOf`).toString();
        return { raw, formatted: formatUnits(raw, token.expectedDecimals, 8), symbol: token.symbol };
      });
      tokenBalances[key] = balanceObs;
    }

    const positions = [];
    for (const vault of VAULTS) {
      const receiptKey = Object.entries(TOKENS).find(([, t]) => t.address.toLowerCase() === vault.receiptToken.address.toLowerCase())[0];
      const assetKey = Object.entries(TOKENS).find(([, t]) => t.address.toLowerCase() === vault.asset.address.toLowerCase())[0];
      const balance = tokenBalances[receiptKey];
      const requiredCode = [vault.address, vault.receiptToken.address, vault.asset.address, ...(vault.backingShare ? [vault.backingShare.address] : []), ...(vault.officialBaseVault ? [vault.officialBaseVault] : [])]
        .map((address) => codeObservations.get(address.toLowerCase()));
      const relationship = await safe({ kind: "vault-relationship", adapterId: vault.id, contract: vault.address, method: vault.verifyShareMethod ? "asset/share" : "asset", arguments: [], requirement: "required" }, async () => {
        if (requiredCode.some((source) => source?.status !== "ok")) throw new Error("Required contract bytecode verification failed.");
        const assetResult = await call("eth_call", { transaction: { to: vault.address, data: SELECTORS.asset }, block: blockNumber });
        const asset = decodeAddress(assetResult.result, `${vault.name}.asset`);
        if (asset !== vault.asset.address.toLowerCase()) throw new Error(`Unexpected asset ${asset}.`);
        if (!vault.verifyShareMethod) return { raw: assetResult.result, interpreted: `asset=${asset}`, asset };
        const shareResult = await call("eth_call", { transaction: { to: vault.address, data: SELECTORS.share }, block: blockNumber });
        const share = decodeAddress(shareResult.result, `${vault.name}.share`);
        if (share !== vault.receiptToken.address.toLowerCase()) throw new Error(`Unexpected receipt/share token ${share}.`);
        return { raw: `${assetResult.result}:${shareResult.result}`, interpreted: `asset=${asset}; share=${share}`, asset, share };
      });
      const totalAssets = await safe({ kind: "vault-total-assets", adapterId: vault.id, contract: vault.address, method: "totalAssets", arguments: [], decimals: vault.asset.expectedDecimals, requirement: "informational" }, async () => {
        const result = await call("eth_call", { transaction: { to: vault.address, data: SELECTORS.totalAssets }, block: blockNumber });
        const raw = decodeUint(result.result, `${vault.name}.totalAssets`).toString();
        return { raw, formatted: formatUnits(raw, vault.asset.expectedDecimals, 6), symbol: vault.asset.symbol };
      });
      const backingSources = [];
      if (vault.backingShare && vault.officialBaseVault) {
        backingSources.push(await safe({ kind: "vault-backing", adapterId: vault.id, contract: vault.backingShare.address, method: "balanceOf", arguments: [vault.address], decimals: vault.backingShare.expectedDecimals, requirement: "required" }, async () => {
          if (tokenDecimals["hyb"]?.status !== "ok") throw new Error("HYB decimals unavailable.");
          const result = await call("eth_call", { transaction: { to: vault.backingShare.address, data: encodeAddressCall(SELECTORS.balanceOf, vault.address) }, block: blockNumber });
          const raw = decodeUint(result.result, `${vault.backingShare.symbol}.balanceOf(wrapper)`).toString();
          return { raw, formatted: formatUnits(raw, vault.backingShare.expectedDecimals, 8), symbol: vault.backingShare.symbol, interpreted: `${vault.name} holds ${formatUnits(raw, vault.backingShare.expectedDecimals, 8)} ${vault.backingShare.symbol}` };
        }));
        backingSources.push(await safe({ kind: "base-vault-relationship", adapterId: vault.id, contract: vault.officialBaseVault, method: "asset/share", arguments: [], requirement: "required" }, async () => {
          const [assetResult, shareResult] = await Promise.all([
            call("eth_call", { transaction: { to: vault.officialBaseVault, data: SELECTORS.asset }, block: blockNumber }),
            call("eth_call", { transaction: { to: vault.officialBaseVault, data: SELECTORS.share }, block: blockNumber })
          ]);
          const asset = decodeAddress(assetResult.result, "HYB base vault asset");
          const share = decodeAddress(shareResult.result, "HYB base vault share");
          if (asset !== vault.asset.address.toLowerCase() || share !== vault.backingShare.address.toLowerCase()) throw new Error(`Unexpected HYB base-vault relationship ${asset}/${share}.`);
          return { raw: `${assetResult.result}:${shareResult.result}`, interpreted: `asset=${asset}; share=${share}`, asset, share };
        }));
      }
      const conversion = await safe({ kind: "position-underlying", adapterId: vault.id, contract: vault.address, method: "convertToAssets", arguments: [balance.status === "ok" ? balance.raw : null], decimals: vault.asset.expectedDecimals, requirement: "required" }, async () => {
        if (requiredCode.some((source) => source?.status !== "ok")) throw new Error("Required contract bytecode verification failed.");
        if (tokenDecimals[receiptKey]?.status !== "ok" || tokenDecimals[assetKey]?.status !== "ok") throw new Error("Required token decimals unavailable.");
        if (balance.status !== "ok") throw new Error("Receipt-token balance unavailable.");
        if (relationship.status !== "ok") throw new Error("Vault asset relationship unavailable.");
        if (backingSources.some((source) => source.status !== "ok")) throw new Error("Wrapper backing/base-vault verification failed.");
        const result = await call("eth_call", { transaction: { to: vault.address, data: encodeUintCall(SELECTORS.convertToAssets, balance.raw) }, block: blockNumber });
        const raw = decodeUint(result.result, `${vault.name}.convertToAssets`).toString();
        return { raw, formatted: formatUnits(raw, vault.asset.expectedDecimals, 6), symbol: vault.asset.symbol };
      });
      if (balance.status === "ok" && conversion.status === "ok") {
        positions.push({
          adapterId: vault.id, protocol: vault.protocol, name: vault.name, status: "ok",
          vault: vault.address, receiptToken: vault.receiptToken.address, receiptSymbol: vault.receiptToken.symbol,
          shareRaw: balance.raw, shareFormatted: balance.formatted, underlyingRaw: conversion.raw,
          underlyingFormatted: conversion.formatted, underlyingSymbol: vault.asset.symbol,
          balanceSourceId: balance.id, conversionSourceId: conversion.id, totalAssetsSourceId: totalAssets.id,
          relationshipSourceIds: [relationship.id, ...backingSources.map((source) => source.id)],
          semantics: vault.semantics, provenance: vault.provenance || "Official deployment listed by Centrifuge."
        });
      } else {
        positions.push({ adapterId: vault.id, protocol: vault.protocol, name: vault.name, status: "error", error: conversion.error || balance.error, vault: vault.address });
      }
    }

    const snapshot = {
      schemaVersion: 2,
      engineVersion: "2.0.0",
      id: options.id || `live-${wallet.slice(2, 10)}-${blockNumber}`,
      mode: options.mode || "LIVE",
      capturedAt: options.capturedAt || new Date().toISOString(),
      network: NETWORK,
      chainId: CHAIN_ID,
      mcpEndpoint: MCP_URL,
      mcpTools: tools,
      wallet,
      block: { number: blockNumber, hash: block.hash, timestamp: Number(BigInt(block.timestamp)) },
      coverage: {
        walletTokens: ["PROS", "USDC", "JTRSY", "HYB", "pRNH"],
        vaults: VAULTS.map(({ id, name, address, sourceUrl }) => ({ id, name, address, sourceUrl })),
        protocolCount: 1,
        vaultCount: 2,
        disclosure: "Two distinct vault routes in one protocol (Centrifuge). This is not full token discovery and not a complete portfolio valuation."
      },
      observations,
      positions,
      accounting: {
        rule: "Wallet receipt-token balances are displayed, but USDC underlying exposure is counted once through each vault conversion.",
        walletUsdcRaw: tokenBalances.usdc.status === "ok" ? tokenBalances.usdc.raw : null,
        vaultUnderlyingUsdcRaw: positions.filter((p) => p.status === "ok").reduce((sum, p) => sum + BigInt(p.underlyingRaw), 0n).toString()
      },
      status: observations.some((o) => o.status === "error" && o.requirement !== "informational") ? "PARTIAL" : "OK",
      explorer: `${EXPLORER}/address/${wallet}`,
      readOnly: true
    };
    return snapshot;
  };
  return options.mcp ? execute(options.mcp) : withPharosMcp(execute, options);
}
