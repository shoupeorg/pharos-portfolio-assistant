# Reviewer evidence manifest

All blockchain observations below were made read-only through the official Pharos Chain MCP. The complete raw-method record is in [`live-public-example.json`](./live-public-example.json).

| Original requirement | Evidence |
|---|---|
| 1. Wallet balances + at least two protocols/vaults | Recorded snapshot checks PROS/USDC/JTRSY/HYB/pRNH balances and two distinct Centrifuge routes: official JTRSY/USDC plus pNYLIM-HYB wrapper backed by the official HYB/USDC vault. Both are one protocol, explicitly disclosed. |
| 2. At least five natural-language question types | The evidence file stores seven grounded answers: balances, USDC location, positions, biggest comparable position, yield limitation, allocation, and a transaction refusal. English/Persian paraphrases are covered by tests. |
| 3. Contract + block for every number | Snapshot block `20575438`, hash `0xef6889f7b3dbd6aafc6bfba66014006f9acb36020747585dc7ea978cf76370bb`; every observation contains source ID, contract, method, arguments, raw value, decimals, and that block. |
| 4. Unknown/unsupported/failed disclosed | Yield answer is `unknown` because cost basis/interval/APY are unavailable. Tests distinguish successful zero, injected adapter failure (`partial`), ambiguous and unsupported questions. Injected failure is not presented as a live outage. |
| 5. Strictly read-only | MCP allowlist contains only chain-info/block/code/balance/call methods. “send my USDC” is refused. No signer, private key, approval, transaction, or send tool exists. |

## Recorded non-zero public example

- Wallet: `0x197afc201b8d839288d7a7e9a03fb95669e3b0f3` (unattributed public EOA; no ownership claim)
- Captured: `2026-10-18T14:32:16.396Z`
- Wallet: `1355.3972602 PROS`, `2713.245764 USDC`
- HYB route: `99.67043747 pRNH` → `98.43916 USDC`
- Wrapper backing: `99580.10510171 HYB`
- JTRSY route: successful zero for this EOA; adapter and vault-wide reads still verified

Recorded values are a snapshot, not current balances. Use **LOAD LIVE PORTFOLIO →** for a fresh pinned-block read.
