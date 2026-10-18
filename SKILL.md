---
name: pharos-portfolio-assistant
description: Read an arbitrary public wallet's scoped Pharos balances and two verified Centrifuge vault routes, then answer sourced English or Persian portfolio questions. Use for read-only balances, USDC location, vault positions, scoped ranking, yield limitations, or wallet-versus-deposited exposure. Never signs or broadcasts transactions.
version: 1.0.0
requires:
  anyBins:
    - node
---

# Pharos Portfolio Assistant

Use the shared deterministic engine to read a public address at one pinned Pharos block through official Chain MCP and answer portfolio questions without a wallet connection.

## Install

```sh
npx skills add https://github.com/shoupeorg/pharos-portfolio-assistant
```

## Invoke

From the installed repository:

```sh
npm install
node src/cli.js 0x197afc201b8d839288d7a7e9a03fb95669e3b0f3 "Where is my USDC?"
```

Persian questions are supported, for example:

```sh
node src/cli.js 0x197afc201b8d839288d7a7e9a03fb95669e3b0f3 "بزرگ‌ترین موقعیتم کدومه؟"
```

## Procedure and safety

1. Accept only a public 20-byte EVM address. Never request a private key or seed phrase.
2. Use only `https://mcp.pharos.xyz/mcp` and the allowlisted read tools `get_chain_info`, `get_block_number`, `get_block`, `get_code`, `get_balance`, and `eth_call`.
3. Pin every wallet and vault read to one block. If an adapter fails, preserve successful data and label the answer `PARTIAL`; never treat failure as zero.
4. Cite source IDs for every number. Derived allocation identifies all inputs.
5. Explain that coverage is limited to PROS, USDC, JTRSY, HYB/pRNH, and two distinct Centrifuge vault routes. Do not claim all-token discovery.
6. Refuse sends, swaps, approvals, deposits, withdrawals, signatures, or broadcasts. This Skill has no transaction tool.

The two routes are separate vaults in one protocol, not two protocols. Receipt shares are shown but their USDC exposure is counted once. Current share conversion is not realized earnings; cost basis and an observation interval are required.
