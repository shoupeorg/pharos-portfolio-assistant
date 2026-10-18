import { formatUnits } from "./fixed.js";

function norm(question) {
  return question.toLowerCase().replace(/[؟?!.،,]/g, " ").replace(/\s+/g, " ").trim();
}

const has = (q, words) => words.some((word) => q.includes(word));

export function detectIntent(question) {
  const q = norm(question || "");
  if (!q) return "ambiguous";
  if (has(q, ["wallet versus", "wallet vs", "deposited", "percentage", "allocation", "کیف پول در برابر", "درصد", "تخصیص"])) return "allocation";
  if (has(q, ["send ", "transfer ", "swap ", "withdraw ", "deposit ", "approve ", "بفرست", "انتقال", "برداشت", "واریز کن", "سواپ"])) return "read_only_refusal";
  if (has(q, ["earning", "earnings", "yield", "rewards", "apy", "سود", "درآمد", "پاداش"])) return "yield";
  if (has(q, ["biggest", "largest", "بزرگ ترین", "بزرگ‌ترین", "بیشترین"])) return "biggest";
  if (has(q, ["protocol", "position", "vault", "پروتکل", "موقعیت", "ولت", "خزانه"])) return "positions";
  if (has(q, ["where is", "location", "کجاست", "کجا است"]) && has(q, ["usdc", "دلار", "دارایی"])) return "asset_location";
  if (has(q, ["balance", "tokens", "hold", "موجودی", "توکن", "دارم", "دارایی"])) return "balances";
  return "unsupported";
}

function okObservations(snapshot) { return snapshot.observations.filter((o) => o.status === "ok"); }
function sourceSuffix(ids) { return ids.length ? ` Sources: ${ids.map((id) => `[${id}]`).join(" ")}` : ""; }

export function answerQuestion(snapshot, question) {
  const intent = detectIntent(question);
  if (intent === "read_only_refusal") return { intent, status: "refused", answer: "This assistant is strictly read-only. It cannot send, swap, approve, deposit, withdraw, sign, or broadcast transactions. No private key is needed.", sourceIds: [] };
  if (intent === "ambiguous") return { intent, status: "clarification", answer: "Ask about wallet balances, where USDC is, vault positions, the biggest comparable position, yield/rewards, or wallet-versus-deposited exposure.", sourceIds: [] };
  if (intent === "unsupported") return { intent, status: "unsupported", answer: "No supported portfolio intent matched this question. Discovery is limited to PROS, USDC, and the two listed Centrifuge vault routes; no answer was inferred.", sourceIds: [] };

  const successful = okObservations(snapshot);
  const obs = (kind, id) => successful.find((o) => o.kind === kind && (!id || o.adapterId === id));
  const failures = snapshot.observations.filter((o) => o.status === "error");
  const partial = failures.length > 0;
  const usdc = obs("wallet-token", "usdc");
  const native = obs("wallet-native");
  const positions = snapshot.positions.filter((p) => p.status === "ok" && BigInt(p.shareRaw) > 0n);
  const prefix = partial ? "PARTIAL: " : "";

  if (intent === "balances") {
    const items = [];
    const ids = [];
    if (native) { items.push(`${native.formatted} PROS`); ids.push(native.id); }
    if (usdc) { items.push(`${usdc.formatted} USDC`); ids.push(usdc.id); }
    for (const p of positions) { items.push(`${p.shareFormatted} ${p.receiptSymbol} receipt shares`); ids.push(p.balanceSourceId); }
    return { intent, status: partial ? "partial" : "ok", answer: `${prefix}Checked wallet balances: ${items.join("; ") || "no successful balance reads"}. Receipt shares are shown here but their underlying exposure is counted only in Positions.${sourceSuffix(ids)}`, sourceIds: ids };
  }

  if (intent === "asset_location") {
    const ids = []; const parts = [];
    if (usdc) { parts.push(`${usdc.formatted} USDC spendable in the wallet`); ids.push(usdc.id); }
    for (const p of positions) { parts.push(`${p.underlyingFormatted} USDC represented by ${p.shareFormatted} ${p.receiptSymbol} in ${p.name}`); ids.push(p.balanceSourceId, p.conversionSourceId); }
    return { intent, status: partial ? "partial" : "ok", answer: `${prefix}USDC location within checked scope: ${parts.join("; ") || "no successful USDC exposure reads"}. Vault exposure is not added again as a wallet token.${sourceSuffix(ids)}`, sourceIds: ids };
  }

  if (intent === "positions") {
    const ids = [];
    const text = snapshot.positions.map((p) => {
      if (p.status === "error") return `${p.name}: READ FAILED (${p.error})`;
      ids.push(p.balanceSourceId, p.conversionSourceId);
      return `${p.name}: ${p.shareFormatted} ${p.receiptSymbol} → ${p.underlyingFormatted} USDC${BigInt(p.shareRaw) === 0n ? " (successful zero)" : ""}`;
    }).join("; ");
    return { intent, status: partial ? "partial" : "ok", answer: `${prefix}Two distinct vault routes are checked, both within Centrifuge (not two protocols): ${text}.${sourceSuffix(ids)}`, sourceIds: ids };
  }

  if (intent === "biggest") {
    if (!positions.length) return { intent, status: partial ? "partial" : "ok", answer: `${prefix}No non-zero supported vault position was found, so there is no position to rank.`, sourceIds: [] };
    const comparable = positions.filter((p) => p.underlyingSymbol === "USDC");
    if (comparable.length !== positions.length) return { intent, status: "unknown", answer: "Overall ranking is unknown because not all positions share a defensible price or common underlying. No unrelated token units were compared.", sourceIds: [] };
    comparable.sort((a, b) => BigInt(a.underlyingRaw) > BigInt(b.underlyingRaw) ? -1 : 1);
    const p = comparable[0];
    return { intent, status: partial ? "partial" : "ok", answer: `${prefix}Within the supported USDC-denominated vault exposures, the biggest position is ${p.name}: ${p.underlyingFormatted} USDC. This is a scoped underlying comparison, not a full-wallet USD valuation.${sourceSuffix([p.balanceSourceId, p.conversionSourceId])}`, sourceIds: [p.balanceSourceId, p.conversionSourceId] };
  }

  if (intent === "yield") {
    const ids = positions.flatMap((p) => [p.balanceSourceId, p.conversionSourceId]);
    const positionText = positions.map((p) => `${p.name} currently represents ${p.underlyingFormatted} USDC`).join("; ") || "No non-zero supported position was found";
    return { intent, status: "unknown", answer: `${positionText}. Realized earnings are UNKNOWN: the chain snapshot has no wallet cost basis or observation interval, and no verified APY/reward feed is used. A share-to-asset ratio is not presented as realized profit.${sourceSuffix(ids)}`, sourceIds: ids };
  }

  if (intent === "allocation") {
    if (!usdc) return { intent, status: "unknown", answer: "Wallet-versus-deposited allocation is unknown because the wallet USDC read failed.", sourceIds: [] };
    const deposited = positions.reduce((sum, p) => sum + BigInt(p.underlyingRaw), 0n);
    const wallet = BigInt(usdc.raw);
    const total = wallet + deposited;
    if (total === 0n) return { intent, status: partial ? "partial" : "ok", answer: `${prefix}Supported USDC exposure is zero; percentages are undefined.`, sourceIds: [usdc.id] };
    const pct = (n) => formatUnits(n * 10000n / total, 2, 2);
    const ids = [usdc.id, ...positions.flatMap((p) => [p.balanceSourceId, p.conversionSourceId])];
    return { intent, status: partial ? "partial" : "ok", answer: `${prefix}Supported USDC exposure: ${pct(wallet)}% spendable wallet USDC and ${pct(deposited)}% represented by checked vault receipts. Total ${formatUnits(total, 6, 6)} USDC-equivalent within this narrow scope; receipt tokens are not double counted.${sourceSuffix(ids)}`, sourceIds: ids };
  }
}
