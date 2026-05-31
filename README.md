# Pharos ProsPixel Painter Agent

Pharos ProsPixel Painter Agent is a Codex / Pharos Agent Center-style skill for planning and optionally executing ProsPixel pixel purchases and pixel-art drawing on Pharos.

It interacts with the real ProsPixel contract instead of automating browser clicks. The skill builds a pixel plan, estimates the payable PROS cost through the contract, previews coordinates/colors, and can broadcast a guarded `batchBuyPixels(uint16[],uint16[],uint24[])` transaction after explicit confirmation.

## Features

- Buy or repaint one or many ProsPixel pixels.
- Draw text with a built-in 5x7 pixel font.
- Fill rectangles and import CSV pixel lists.
- Scan a bounded area for the cheapest pixels through the public ProsPixel BFF.
- Estimate total PROS payment through `getAllFeeAmounts`.
- Check signer registration, balance, and gas readiness when `ethers` is installed.
- Use `.env` for local private-key handling.
- Dry-run planning by default; execution requires `--execute --yes`.

## Install

From a project where you want the skill installed:

```powershell
npx skills add https://github.com/Makssay/pharos-prospixel-painter-agent
npm install ethers
```

Manual clone:

```powershell
git clone https://github.com/Makssay/pharos-prospixel-painter-agent
cd pharos-prospixel-painter-agent
npm install
```

## Quick Start

Plan one pixel:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --pixel "822,285,#EF4444" --format console
```

Draw text:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --format console --max-total-pros 2
```

Find cheap pixels inside an area:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --cheapest --limit 100 --area 800,250,900,350 --color "#EF4444" --format console --max-total-pros 2
```

## Execute

Create `.env` in the project root:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RPC_URL=https://rpc.pharos.xyz
```

Then run only after reviewing the dry-run plan:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --execute --yes --confirm-mainnet --max-total-pros 2
```

Never paste the private key into an AI prompt or commit `.env`.

## Example AI Agent Prompt

```text
[$pharos-prospixel-painter-agent](C:\\Users\\User\\.agents\\skills\\pharos-prospixel-painter-agent\\SKILL.md)

Plan a ProsPixel drawing on Pharos mainnet. Do not execute yet.

Draw the text "PROS" starting at x=820, y=280 with color #EF4444.
Estimate total PROS cost, check gas readiness, and show a compact pixel preview.
Use Node.js only. Do not require Foundry, forge, cast, Bash, Git Bash, or WSL.
```

## Supported Networks

- Pharos mainnet: `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a`
- Pharos Atlantic testnet: `0x09d1D3cf60A86963c42ca159DA5D1a2D73644cf7`

## Dependencies

- Node.js 18+
- npm
- `ethers` for live contract fee checks and execution

## Safety

Planning and preview generation are read-only. Real painting is a payable onchain transaction and requires explicit confirmation. The skill checks safety caps such as `--max-pixels` and `--max-total-pros` before execution.
