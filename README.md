# Pharos Portfolio Assistant

A read-only Agent Arena portfolio assistant for arbitrary public addresses on Pharos Pacific Mainnet. The CLI, Worker API, web UI, and root Skill share one deterministic answer engine. Every live number is attached to the exact contract call and one pinned block.

> Coverage is deliberately bounded. This checks PROS, USDC, JTRSY, HYB/pRNH, and two distinct vault routes within **one protocol, Centrifuge**. It does not claim all-token discovery, two separate protocols, or a complete USD portfolio valuation.

## Verified data sources

Network: Pharos Pacific Mainnet, chain ID `1672`. All application chain reads use official Streamable HTTP at `https://mcp.pharos.xyz/mcp`; there is no direct-RPC fallback.

| Route | Contract | Asset / receipt semantics | Official source |
|---|---|---|---|
| Centrifuge JTRSY / USDC | `0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434` | `asset()` = USDC; `share()`/receipt = JTRSY. Wallet JTRSY is converted using `convertToAssets` at the pinned block. | [Centrifuge deployments](https://docs.centrifuge.io/developer/protocol/deployments/) |
| Centrifuge pNYLIM-HYB wrapper | `0x6ce4bc043398ac40392d1e063328048072b2075d` | pRNH receipt shares convert to USDC. Its HYB backing is checked, and the official HYB/USDC base vault `0x74189e017d3aefee48f3cc5bf592694b2a016da8` is verified to expose USDC asset + HYB share. | [Official HYB vault deployment](https://docs.centrifuge.io/developer/protocol/deployments/) and [on-chain wrapper](https://pharos.socialscan.io/address/0x6ce4bc043398ac40392d1e063328048072b2075d) |

USDC: `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` ([Circle Pharos USDC](https://www.circle.com/multi-chain-usdc/pharos)). JTRSY: `0xc18e6f730896971a79d748e8dea61067a9bc6040`. HYB: `0x4827c7ecce4f07adfe44a97165f06a199e7d2505`.

The pNYLIM wrapper is bytecode- and interface-verified on-chain and linked to the official HYB vault by its HYB backing; it is not separately listed in Centrifuge's deployment table. This limitation is intentional and disclosed.

## Install and run

Node.js 20+ is recommended.

```sh
npm install
npm test
npm run build
node src/cli.js 0x197afc201b8d839288d7a7e9a03fb95669e3b0f3 "Where is my USDC?"
```

The public address is user-controlled. The included example is an unattributed public EOA with non-zero pRNH and USDC; it is not a token/vault contract and is not claimed to belong to the project owner.

Supported question families include English and Persian paraphrases:

1. `What tokens do I hold?` / `موجودی کیف پولم چقدره؟`
2. `Where is my USDC?` / `USDC من کجاست؟`
3. `Which protocols am I using?` / `چه موقعیت‌هایی توی پروتکل‌ها دارم؟`
4. `What is my biggest position?` / `بزرگ‌ترین موقعیتم کدومه؟`
5. `What am I earning?` / `چقدر سود می‌گیرم؟`
6. `How much is in my wallet versus deposited?`

This is a deterministic intent parser, not an LLM. Unknown questions are not silently remapped. Transaction requests are refused.

## Recorded real output

Recorded snapshot—not current balances—captured `2026-10-18T14:32:16.396Z` at block `20575438` (`0xef6889f7b3dbd6aafc6bfba66014006f9acb36020747585dc7ea978cf76370bb`) for public EOA `0x197afc201b8d839288d7a7e9a03fb95669e3b0f3`:

```text
Status: OK
Wallet: 1355.3972602 PROS; 2713.245764 USDC
JTRSY / USDC Vault: 0 JTRSY → 0 USDC (successful zero)
pNYLIM-HYB Wrapped Vault: 99.67043747 pRNH → 98.43916 USDC
HYB held by wrapper: 99580.10510171 HYB

Where is my USDC?
2713.245764 USDC spendable in the wallet; 98.43916 USDC represented by
99.67043747 pRNH in pNYLIM-HYB Wrapped Vault. Receipt exposure is counted once.

What am I earning?
Realized earnings are UNKNOWN: no wallet cost basis, observation interval, or
verified APY/reward feed is available. The share-to-asset ratio is not profit.
```

See [`evidence/live-public-example.json`](./evidence/live-public-example.json) for all 23 observations and source IDs, and [`evidence/manifest.md`](./evidence/manifest.md) for requirement mapping.

## API and persistence

- `POST /api/portfolio` `{ "wallet": "0x…" }` — fresh live pinned-block snapshot; persisted to D1.
- `POST /api/ask` `{ "snapshotId": "…", "question": "…" }` — grounded answer, also persisted.
- `GET /api/snapshots` — recorded history.
- `GET /api/snapshots/:id` — immutable stored payload labeled `RECORDED`.
- `GET /api/config` and `/api/health` — supported scope/status.

Apply `migrations/0001_initial.sql` before deployment. Browser refresh reads the stored snapshot; it does not relabel it LIVE. Fresh reads require **LOAD LIVE PORTFOLIO →**.

## Accounting and failure semantics

- JavaScript `BigInt` and decimal strings are used for balances, conversions, totals, and percentages; token amounts are never converted to `Number` for accounting.
- Wallet receipt balances remain visible, while their converted underlying is counted once in reconciliation.
- Overall rankings are refused when assets lack a common defensible unit. Only USDC-underlying vault exposure is compared here.
- `0` is a successful read. A timeout/revert is `FAILED`; other successful adapters stay visible and answers become `PARTIAL`.
- Current conversion rates do not prove historical earnings. No APY is invented.

## Read-only security

Only `get_chain_info`, `get_block_number`, `get_block`, `get_code`, `get_balance`, and `eth_call` are allowlisted. There is no signer, transaction builder, approval, send, or RPC URL input. The assistant never asks for private keys. This project executed zero blockchain transactions and spent zero PHRS.

## Skill

The installable root [`SKILL.md`](./SKILL.md) follows the AI.PHAROS root-Skill layout:

```sh
npx skills add https://github.com/shoupeorg/pharos-portfolio-assistant
```

Installation copies instructions; it does not connect a wallet or install anything on behalf of the reviewer unless they run the command.

## Tests

`npm test` covers both adapter semantics with documented fixtures, twelve English/Persian intent paraphrases, source-ID mapping, large exact decimals, receipt-token double-count prevention, incomparable ranking refusal, unknown realized yield, successful zero vs injected failure, partial results, ambiguity/unsupported handling, invalid address/network input, and read-only transaction refusal. Injected failures are deterministic tests—not claims of real protocol outages.

## Material limitations

- Both adapters are Centrifuge vault routes, not two different protocols.
- Arbitrary ERC-20 discovery and USD price discovery are intentionally absent; only the documented checked list is reported.
- The recorded EOA has a meaningful HYB wrapper position but a successful zero JTRSY position. JTRSY adapter evidence is real, but not a fabricated non-zero user holding.
- No cost basis, realized P&L, APY, or rewards feed is available, so earnings remain unknown.
