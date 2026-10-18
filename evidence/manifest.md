# Reviewer evidence manifest

All blockchain observations below were made read-only through the official Pharos Chain MCP. Engine-v1 and corrected engine-v2 records remain unchanged. The current yield-capable record is [`live-yield-v3.json`](./live-yield-v3.json).

| Original requirement | Evidence |
|---|---|
| 1. Wallet balances + at least two protocols/vaults | Engine v2 reports every successful checked wallet balance: PROS/USDC/JTRSY/HYB/pRNH. It checks the official JTRSY/USDC vault and a third-party/unattributed pNYLIM-HYB wrapper over the official HYB/USDC vault. These are two routes around one protocol, explicitly disclosed. |
| 2. At least five natural-language question types | The evidence file stores seven grounded answers: balances, USDC location, positions, biggest comparable position, sourced historical share-value performance, allocation, and a transaction refusal. English/Persian recognition is covered by tests while built-in UI text remains English-only. |
| 3. Contract + block for every number | Corrected snapshot block `20579348`, hash `0x66bef1c150a00847fc1bcc95433614a27c11cec3e31ed5d87f3196d957da7c8c`; every observation contains source ID, contract, method, arguments, raw value, decimals, and that block. Every answer source ID is integrity-checked against those observations. |
| 4. Unknown/unsupported/failed disclosed | Vault performance is reported separately from personal earnings, which remain `UNKNOWN`. Historical-read failure, successful zero/negative performance, injected adapter failure, ambiguous and unsupported questions are tested. Injected failures are not presented as live outages. |
| 5. Strictly read-only | MCP allowlist contains only chain-info/block/code/balance/call methods. “send my USDC” is refused. No signer, private key, approval, transaction, or send tool exists. |

## Corrected engine-v2 public example

- Wallet: `0x197afc201b8d839288d7a7e9a03fb95669e3b0f3` (unattributed public EOA; no ownership claim)
- Captured: `2026-10-18T15:33:33.589Z`
- Wallet: `1355.3972602 PROS`, `2713.245764 USDC`
- Standalone HYB wallet balance: successful zero (still disclosed)
- Third-party wrapper route: `99.67043747 pRNH` → `98.439126 USDC`
- Wrapper backing: `99580.10510171 HYB`
- JTRSY route: successful zero for this EOA; adapter and vault-wide reads still verified

The JTRSY adapter additionally verifies `share()` is the configured JTRSY token. Wrapper totals are admitted only after code, decimals, balance, asset, backing, official base-vault asset/share, and conversion checks all succeed. `totalAssets` is informational. Recorded values are a snapshot, not current balances. Use **LOAD LIVE PORTFOLIO →** for a fresh pinned-block read.

## Genuine engine-v3 historical performance evidence

- Vault: official JTRSY/USDC `0x160e0dd4c4f693b05eca83bc2ec6fd51954fc434`
- Fixed quantity: `1 JTRSY` (`1000000` raw, 6 decimals)
- Start: block `20489933`, timestamp `1792249597`, `convertToAssets` = `1119288` raw USDC (`1.119288`)
- End: block `20589933`, timestamp `1792347452`, `convertToAssets` = `1119288` raw USDC (`1.119288`)
- Actual elapsed interval: `97855` seconds (`1d 3h 10m 55s`)
- Exact change: `0%`

The interval was fixed at 100,000 blocks before reading the result; it was not selected for favorable performance. This is a verified zero vault share-value change, not wallet profit, continuous-ownership proof, APR/APY, or a future guarantee. See the performance object's explicit source IDs in the v3 evidence; they cover both blocks, bytecode, decimals, asset/share relationships, and conversions.
