import { formatUnits } from "./fixed.js";
import { TOKENS } from "./constants.js";

function norm(question) {
  return question.toLowerCase().replace(/[؟?!.،,]/g, " ").replace(/\s+/g, " ").trim();
}

const has = (q, words) => words.some((word) => q.includes(word));

const LOCATION_WORDS = ["where is", "where are", "location", "located", "across vault", "کجاست", "کجا است", "کجا هستند", "در کدام", "توی کدام"];
const ASSET_ALIASES = [
  ["USDC", ["usdc", "دلار"]], ["PROS", ["pros", "pharos native", "توکن بومی"]],
  ["JTRSY", ["jtrsy"]], ["HYB", ["hyb"]], ["pRNH", ["prnh", "pnylim-hyb"]]
];

export function detectAsset(question) {
  const q = norm(question || "");
  return ASSET_ALIASES.find(([, aliases]) => has(q, aliases))?.[0] || null;
}

export function detectIntent(question) {
  const q = norm(question || "");
  if (!q) return "ambiguous";
  if (has(q, ["wallet versus", "wallet vs", "deposited", "percentage", "allocation", "کیف پول در برابر", "درصد", "تخصیص"])) return "allocation";
  if (has(q, ["send ", "transfer ", "swap ", "withdraw ", "deposit ", "approve ", "بفرست", "انتقال", "برداشت", "واریز کن", "سواپ"])) return "read_only_refusal";
  if (has(q, ["earning", "earnings", "yield", "rewards", "apy", "سود", "درآمد", "پاداش"])) return "yield";
  if (has(q, ["biggest", "largest", "بزرگ ترین", "بزرگ‌ترین", "بیشترین"])) return "biggest";
  if (has(q, LOCATION_WORDS)) return "asset_location";
  if (has(q, ["protocol", "position", "vault", "پروتکل", "موقعیت", "ولت", "خزانه"])) return "positions";
  if (has(q, ["balance", "tokens", "hold", "موجودی", "توکن", "دارم", "دارایی"])) return "balances";
  return "unsupported";
}

function okObservations(snapshot) { return snapshot.observations.filter((o) => o.status === "ok"); }
function sourceSuffix(ids) { return ids.length ? ` Sources: ${ids.map((id) => `[${id}]`).join(" ")}` : ""; }

export function answerQuestion(snapshot, question) {
  const intent = detectIntent(question);
  const knownIds = new Set(snapshot.observations.map((o) => o.id));
  const done = (result) => {
    const missing = result.sourceIds.filter((id) => !knownIds.has(id));
    if (missing.length) throw new Error(`Answer source integrity failure: ${missing.join(", ")}`);
    return { engineVersion: "2.0.0", ...result };
  };
  if (intent === "read_only_refusal") return done({ intent, status: "refused", answer: "This assistant is strictly read-only. It cannot send, swap, approve, deposit, withdraw, sign, or broadcast transactions. No private key is needed.", sourceIds: [] });
  if (intent === "ambiguous") return done({ intent, status: "clarification", answer: "Ask about checked wallet balances, the location of a named supported asset, vault positions, the biggest comparable position, yield/rewards, or wallet-versus-deposited exposure.", sourceIds: [] });
  if (intent === "unsupported") return done({ intent, status: "unsupported", answer: "No supported portfolio intent matched this question. Discovery is limited to PROS, USDC, JTRSY, HYB, pRNH, and the two listed vault routes; no answer was inferred.", sourceIds: [] });

  const successful = okObservations(snapshot);
  const obs = (kind, id) => successful.find((o) => o.kind === kind && (!id || o.adapterId === id));
  const failures = snapshot.observations.filter((o) => o.status === "error" && o.requirement !== "informational");
  const partial = failures.length > 0;
  const usdc = obs("wallet-token", "usdc");
  const native = obs("wallet-native");
  const positions = snapshot.positions.filter((p) => p.status === "ok" && BigInt(p.shareRaw) > 0n);
  const prefix = partial ? "PARTIAL: " : "";

  if (intent === "balances") {
    const items = [];
    const ids = [];
    if (native) { items.push(`${native.formatted} PROS`); ids.push(native.id); }
    for (const token of successful.filter((o) => o.kind === "wallet-token")) {
      const kind = token.tokenKind || TOKENS[token.adapterId]?.kind;
      const label = kind === "receipt" ? " receipt token" : kind === "protocol-share" ? " protocol share token" : "";
      items.push(`${token.formatted} ${token.symbol}${label}`); ids.push(token.id);
    }
    return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}Checked wallet balances: ${items.join("; ") || "no successful balance reads"}. Coverage is limited to PROS, USDC, JTRSY, HYB, and pRNH; this is not token discovery. Receipt/share tokens are disclosed as wallet balances but their converted underlying is not added here, preventing double counting.${sourceSuffix(ids)}`, sourceIds: ids });
  }

  if (intent === "asset_location") {
    const asset = detectAsset(question);
    if (!asset) return done({ intent, status: "unsupported", answer: "Name one supported asset (PROS, USDC, JTRSY, HYB, or pRNH). No USDC answer was assumed from generic or unsupported asset wording.", sourceIds: [] });
    if (asset !== "USDC") {
      const direct = asset === "PROS" ? native : successful.find((o) => o.kind === "wallet-token" && o.symbol?.toLowerCase() === asset.toLowerCase());
      if (!direct) return done({ intent, status: "partial", answer: `${asset} is within configured coverage, but its wallet read failed; no value was inferred.`, sourceIds: [] });
      const kind = direct.tokenKind || TOKENS[direct.adapterId]?.kind;
      const note = kind === "receipt" ? " It is a receipt token; its validated converted exposure appears only in Positions." : kind === "protocol-share" ? " It is a protocol share token; no unsupported per-wallet underlying conversion is inferred." : "";
      return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}${direct.formatted} ${asset} is directly held in the checked wallet.${note} Coverage is limited to the configured contracts.${sourceSuffix([direct.id])}`, sourceIds: [direct.id] });
    }
    const ids = []; const parts = [];
    if (usdc) { parts.push(`${usdc.formatted} USDC spendable in the wallet`); ids.push(usdc.id); }
    for (const p of positions) { parts.push(`${p.underlyingFormatted} USDC represented by ${p.shareFormatted} ${p.receiptSymbol} in ${p.name}`); ids.push(p.balanceSourceId, p.conversionSourceId); }
    return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}USDC location within checked scope: ${parts.join("; ") || "no successful USDC exposure reads"}. Vault exposure is not added again as a wallet token.${sourceSuffix(ids)}`, sourceIds: ids });
  }

  if (intent === "positions") {
    const ids = [];
    const text = snapshot.positions.map((p) => {
      if (p.status === "error") return `${p.name}: READ FAILED (${p.error})`;
      ids.push(p.balanceSourceId, p.conversionSourceId);
      return `${p.name}: ${p.shareFormatted} ${p.receiptSymbol} → ${p.underlyingFormatted} USDC${BigInt(p.shareRaw) === 0n ? " (successful zero)" : ""}`;
    }).join("; ");
    return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}Two distinct vault routes are checked: one official Centrifuge JTRSY vault and one third-party wrapper over the official Centrifuge HYB vault (not two protocols): ${text}.${sourceSuffix(ids)}`, sourceIds: ids });
  }

  if (intent === "biggest") {
    if (!positions.length) return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}No non-zero supported vault position was found, so there is no position to rank.`, sourceIds: [] });
    const comparable = positions.filter((p) => p.underlyingSymbol === "USDC");
    if (comparable.length !== positions.length) return done({ intent, status: "unknown", answer: "Overall ranking is unknown because not all positions share a defensible price or common underlying. No unrelated token units were compared.", sourceIds: [] });
    comparable.sort((a, b) => BigInt(a.underlyingRaw) > BigInt(b.underlyingRaw) ? -1 : 1);
    const p = comparable[0];
    return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}Within the supported USDC-denominated vault exposures, the biggest position is ${p.name}: ${p.underlyingFormatted} USDC. This is a scoped underlying comparison, not a full-wallet USD valuation.${sourceSuffix([p.balanceSourceId, p.conversionSourceId])}`, sourceIds: [p.balanceSourceId, p.conversionSourceId] });
  }

  if (intent === "yield") {
    const ids = positions.flatMap((p) => [p.balanceSourceId, p.conversionSourceId]);
    const positionText = positions.map((p) => `${p.name} currently represents ${p.underlyingFormatted} USDC`).join("; ") || "No non-zero supported position was found";
    return done({ intent, status: "unknown", answer: `${positionText}. Realized earnings are UNKNOWN: the chain snapshot has no wallet cost basis or observation interval, and no verified APY/reward feed is used. A share-to-asset ratio is not presented as realized profit.${sourceSuffix(ids)}`, sourceIds: ids });
  }

  if (intent === "allocation") {
    if (!usdc) return done({ intent, status: "unknown", answer: "Wallet-versus-deposited allocation is unknown because the wallet USDC read failed.", sourceIds: [] });
    const deposited = positions.reduce((sum, p) => sum + BigInt(p.underlyingRaw), 0n);
    const wallet = BigInt(usdc.raw);
    const total = wallet + deposited;
    if (total === 0n) return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}Supported USDC exposure is zero; percentages are undefined.`, sourceIds: [usdc.id] });
    const pct = (n) => formatUnits(n * 10000n / total, 2, 2);
    const ids = [usdc.id, ...positions.flatMap((p) => [p.balanceSourceId, p.conversionSourceId])];
    return done({ intent, status: partial ? "partial" : "ok", answer: `${prefix}Supported USDC exposure: ${pct(wallet)}% spendable wallet USDC and ${pct(deposited)}% represented by checked vault receipts. Total ${formatUnits(total, 6, 6)} USDC-equivalent within this narrow scope; receipt tokens are not double counted.${sourceSuffix(ids)}`, sourceIds: ids });
  }
}
