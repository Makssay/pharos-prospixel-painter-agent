---
name: pharos-prospixel-painter-agent
description: Plan and optionally execute ProsPixel pixel purchases and drawings on Pharos. Use when a user wants an AI agent to buy cheap ProsPixel pixels, draw text/shapes/pixel art on the ProsPixel canvas, estimate total PROS cost, preview coordinates/colors, or submit guarded batchBuyPixels transactions with a local PRIVATE_KEY. Supports dry-run planning by default and direct Pharos mainnet/testnet contract interaction.
---

# Pharos ProsPixel Painter Agent

AI-agent workflow for interacting with ProsPixel, the pixel art game on Pharos. The skill plans pixel purchases and drawings, estimates cost through the ProsPixel contract, previews the target pixels, and can optionally execute the guarded `batchBuyPixels(uint16[],uint16[],uint24[])` call after explicit confirmation.

## Default Workflow

1. Default to dry-run planning. Do not request a private key for planning.
2. Use Pharos mainnet by default because the public ProsPixel game is live there.
3. Build a pixel plan from one of:
   - `--pixel "x,y,#RRGGBB"`
   - `--pixels "x,y,#RRGGBB;x,y,#RRGGBB"`
   - `--rect x1,y1,x2,y2 --color #RRGGBB`
   - `--text "TEXT" --x <x> --y <y> --color #RRGGBB`
   - `--csv pixels.csv`
   - `--cheapest --limit <n> --area x1,y1,x2,y2 --color #RRGGBB`
4. Validate every coordinate is inside the 1000x1000 canvas and every color is `#RRGGBB`.
5. Estimate exact total payment through `getAllFeeAmounts(x[], y[])` when `ethers` and RPC are available.
6. Show a plan with pixel count, bounding box, total PROS cost, optional gas estimate, and a compact preview.
7. For execution, require `--execute --yes`. For mainnet, also require `--confirm-mainnet`.
8. Read `PRIVATE_KEY` only from the local shell environment or `.env`. Never print it or ask the user to paste it into chat.

## Agent Execution Rules

- Use the bundled Node.js script. Do not require Foundry, `forge`, `cast`, Bash, Git Bash, or WSL.
- Use dry-run unless the user explicitly asks to buy, paint, execute, or send the transaction.
- If the user asks for "the cheapest pixels", require an area unless they explicitly accept a large scan. Whole-canvas exact search is up to 1,000,000 pixels and should not be run casually.
- Before execution, summarize exact coordinates, colors, total PROS value, target contract, network, signer address, and safety limits.
- Stop if total value exceeds `--max-total-pros` or pixel count exceeds `--max-pixels`.
- Use `.env` for private key setup:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RPC_URL=https://rpc.pharos.xyz
```

## Commands

Run from the project where the skill is installed:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --format console
```

Buy/paint after review:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --execute --yes --confirm-mainnet --max-total-pros 1
```

Find cheap pixels inside an area:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --cheapest --limit 100 --area 800,250,900,350 --color "#EF4444" --format console
```

## Inputs

- `--network mainnet|atlantic-testnet`: Defaults to `mainnet`.
- `--rpc-url <url>`: Optional custom RPC endpoint.
- `--round <n>`: Optional ProsPixel round. If omitted, the script tries `currentRound()`.
- `--pixel x,y,#RRGGBB`: Add one pixel.
- `--pixels "x,y,#RRGGBB;x,y,#RRGGBB"`: Add multiple pixels inline.
- `--csv <path>`: Read `x,y,color` rows.
- `--rect x1,y1,x2,y2 --color #RRGGBB`: Fill a rectangle.
- `--text <text> --x <x> --y <y> --color #RRGGBB [--scale n]`: Draw 5x7 pixel-font text.
- `--cheapest --limit <n> --area x1,y1,x2,y2 --color #RRGGBB`: Scan an area through the public ProsPixel BFF and choose the lowest-price pixels.
- `--max-pixels <n>`: Safety cap. Defaults to `500`.
- `--max-total-pros <amount>`: Safety cap for native payment.
- `--execute --yes`: Broadcast the ProsPixel transaction.
- `--confirm-mainnet`: Required for mainnet execution.
- `--format markdown|json|console`: Defaults to `markdown`.
- `--output <path>`: Save the plan/report.
- `--offline`: Skip RPC/BFF checks and produce a structural plan only.

For exact live fee checks and execution, install the Node dependency in the project where the skill is installed:

```powershell
npm install ethers
```

## Known Contracts

Read `assets/networks.json` for current contract and endpoint constants.

- Pharos mainnet ProsPixel: `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a`
- Atlantic testnet ProsPixel: `0x09d1D3cf60A86963c42ca159DA5D1a2D73644cf7`

## Safety

- Planning and preview generation are read-only.
- Execution sends a real payable transaction.
- The skill does not scrape or automate browser UI; it uses public BFF reads and direct contract calls.
- The skill does not guarantee that selected pixels remain the same price until the transaction is mined. Re-check the plan immediately before execution.
- Read `references/examples.md` for demo flows and `references/safety.md` before executing mainnet paint actions.
