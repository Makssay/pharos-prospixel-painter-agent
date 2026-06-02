# Pharos ProsPixel Painter Agent

Pharos ProsPixel Painter Agent is a Codex / Pharos Agent Center-style skill for planning and optionally executing ProsPixel pixel purchases and pixel-art drawing on Pharos.

It interacts with the real ProsPixel contract instead of automating browser clicks. The skill builds a pixel plan, estimates the payable PROS cost through the contract, previews coordinates/colors, and can broadcast a guarded `batchBuyPixels(uint16[],uint16[],uint24[])` transaction after explicit confirmation.

## Features

- Buy or repaint one or many ProsPixel pixels.
- Draw text with a built-in 5x7 pixel font.
- Convert a PNG image into bounded ProsPixel pixel art.
- Skip transparent PNG background pixels by default.
- Fill rectangles and import CSV pixel lists.
- Scan a bounded area for the cheapest pixels through the public ProsPixel BFF.
- Estimate total PROS payment through `getAllFeeAmounts`.
- Split large drawings into 400-pixel transaction batches, matching ProsPixel UI behavior.
- Check signer registration, balance, and gas readiness when `ethers` is installed.
- Use `.env` for local private-key handling.
- Dry-run planning by default; execution requires `--execute --yes`; mainnet also requires `--confirm-mainnet`.

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

Draw a PNG image inside a fixed square:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --image .\prospixel-input.png --bounds 820,280,839,299 --fit contain --max-image-colors 16 --transparent-threshold 128 --format console --max-total-pros 5
```

## Text And Image Notes

Text mode uses a built-in uppercase 5x7 pixel font. It supports `A-Z`, `0-9`, `.`, `-`, `_`, and spaces. For Cyrillic, other languages, custom fonts, logos, or detailed art, render the design as a PNG and use `--image`.

Image mode supports PNG input. Transparent PNG pixels are skipped unless `--background` is set. Use `--transparent-threshold 128` for soft transparent edges, and avoid `--background` when the empty background should remain unpainted.

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

Execute a bounded PNG drawing after review:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --image .\prospixel-input.png --bounds 820,280,839,299 --fit contain --max-image-colors 16 --transparent-threshold 128 --execute --yes --confirm-mainnet --max-total-pros 5 --format console
```

ProsPixel supports up to 400 pixels per transaction. The skill automatically sends large drawings as multiple transactions: 500 pixels becomes 400 + 100; 1000 pixels becomes 400 + 400 + 200.

Never paste the private key into an AI prompt or commit `.env`.

## Example AI Agent Prompt

```text
[$pharos-prospixel-painter-agent](C:\\Users\\User\\.agents\\skills\\pharos-prospixel-painter-agent\\SKILL.md)

Plan a ProsPixel drawing on Pharos mainnet. Do not execute yet.

Draw the text "PROS" starting at x=820, y=280 with color #EF4444.
Estimate total PROS cost, check gas readiness, and show a compact pixel preview.
Use Node.js only. Do not require Foundry, forge, cast, Bash, Git Bash, or WSL.
```

Image-to-canvas prompt:

```text
[$pharos-prospixel-painter-agent](C:\\Users\\User\\.agents\\skills\\pharos-prospixel-painter-agent\\SKILL.md)

Use the attached image and draw it on ProsPixel mainnet.
Save or convert the image to PNG first if needed.

Allowed bounds:
- top-left: 820,280
- top-right: 839,280
- bottom-left: 820,299
- bottom-right: 839,299

Fit the image inside the bounds with contain mode.
Do not draw outside the bounds.
Use max 16 image colors.
Show the plan, total PROS cost, batch count, and preview first.
If total cost is <= 5 PROS and all checks pass, execute using PRIVATE_KEY from local .env.
Use --execute --yes --confirm-mainnet --max-total-pros 5 for the final transaction.
Use Node.js only. Do not require Foundry, forge, cast, Bash, Git Bash, or WSL.
```

## Supported Networks

- Pharos mainnet: `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a`
- Pharos Atlantic testnet: `0x09d1D3cf60A86963c42ca159DA5D1a2D73644cf7`

## Dependencies

- Node.js 18+
- npm
- `ethers` for live contract fee checks and execution
- PNG image input is supported without extra image dependencies

## Safety

Planning and preview generation are read-only. Real painting is a payable onchain transaction and requires explicit confirmation. The skill checks safety caps such as `--max-pixels` and `--max-total-pros` before execution.
