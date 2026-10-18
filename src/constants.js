export const MCP_URL = "https://mcp.pharos.xyz/mcp";
export const CHAIN_ID = 1672;
export const NETWORK = "Pharos Pacific Mainnet";
export const EXPLORER = "https://pharos.socialscan.io";

export const TOKENS = {
  usdc: { symbol: "USDC", address: "0xC879C018dB60520F4355C26eD1a6D572cdAC1815", expectedDecimals: 6, kind: "wallet" },
  jtrsy: { symbol: "JTRSY", address: "0xc18e6f730896971a79d748e8dea61067a9bc6040", expectedDecimals: 6, kind: "receipt" },
  hyb: { symbol: "HYB", address: "0x4827c7ecce4f07adfe44a97165f06a199e7d2505", expectedDecimals: 18, kind: "protocol-share" },
  prnh: { symbol: "pRNH", address: "0x6ce4bc043398ac40392d1e063328048072b2075d", expectedDecimals: 18, kind: "receipt" }
};

export const VAULTS = [
  {
    id: "centrifuge-jtrsy-usdc",
    protocol: "Centrifuge",
    name: "JTRSY / USDC Vault",
    address: "0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434",
    receiptToken: TOKENS.jtrsy,
    asset: TOKENS.usdc,
    sourceUrl: "https://docs.centrifuge.io/developer/protocol/deployments/",
    semantics: "Official Centrifuge Pharos JTRSY vault. Wallet JTRSY shares are converted with convertToAssets at the pinned block."
  },
  {
    id: "centrifuge-hyb-wrapped-usdc",
    protocol: "Centrifuge",
    name: "pNYLIM-HYB Wrapped Vault",
    address: TOKENS.prnh.address,
    receiptToken: TOKENS.prnh,
    asset: TOKENS.usdc,
    backingShare: TOKENS.hyb,
    officialBaseVault: "0x74189e017d3aefee48f3cc5bf592694b2a016da8",
    sourceUrl: "https://docs.centrifuge.io/developer/protocol/deployments/",
    explorerUrl: `${EXPLORER}/address/${TOKENS.prnh.address}`,
    semantics: "Verified pNYLIM-HYB ERC-4626 wrapper. pRNH shares convert to USDC; the wrapper's HYB backing and the official HYB/USDC vault are checked at the same block."
  }
];

export const PUBLIC_EXAMPLES = [
  {
    label: "Public HYB holder (EOA)",
    address: "0x197afc201b8d839288d7a7e9a03fb95669e3b0f3",
    note: "Unattributed public on-chain account with non-zero pRNH and USDC; not claimed to belong to the project owner."
  }
];

export const SELECTORS = {
  balanceOf: "0x70a08231",
  decimals: "0x313ce567",
  asset: "0x38d52e0f",
  share: "0xa8d5fd65",
  totalAssets: "0x01e1d114",
  convertToAssets: "0x07a2d13a"
};
