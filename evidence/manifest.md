# Reviewer evidence manifest

All blockchain observations below were made read-only through the official Pharos Chain MCP. The original engine-v1 record remains unchanged in [`live-public-example.json`](./live-public-example.json). The current corrected engine-v2 record is [`live-corrected-v2.json`](./live-corrected-v2.json).

| Original requirement | Evidence |
|---|---|
| 1. Wallet balances + at least two protocols/vaults | Engine v2 reports every successful checked wallet balance: PROS/USDC/JTRSY/HYB/pRNH. It checks the official JTRSY/USDC vault and a third-party/unattributed pNYLIM-HYB wrapper over the official HYB/USDC vault. These are two routes around one protocol, explicitly disclosed. |
| 2. At least five natural-language question types | The evidence file stores seven grounded answers: balances, USDC location, positions, biggest comparable position, yield limitation, allocation, and a transaction refusal. English/Persian paraphrases are covered by tests. |
| 3. Contract + block for every number | Corrected snapshot block `20579348`, hash `0x66bef1c150a00847fc1bcc95433614a27c11cec3e31ed5d87f3196d957da7c8c`; every observation contains source ID, contract, method, arguments, raw value, decimals, and that block. Every answer source ID is integrity-checked against those observations. |
| 4. Unknown/unsupported/failed disclosed | Yield answer is `unknown` because cost basis/interval/APY are unavailable. Tests distinguish successful zero, injected adapter failure (`partial`), ambiguous and unsupported questions. Injected failure is not presented as a live outage. |
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
