# Examples

## Plan One Pixel

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --pixel "822,285,#EF4444" --format console
```

## Plan A Two-Pixel Paint

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --pixels "823,281,#EF4444;823,280,#EF4444" --format console
```

These match the observed ProsPixel mainnet pattern: a payable `batchBuyPixels(uint16[],uint16[],uint24[])` call.

## Draw Text

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --format console --max-total-pros 2
```

The plan shows transaction batches. ProsPixel allows at most 400 pixels per transaction, so 500 pixels becomes two transactions: 400 + 100.

## Fill A Rectangle

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --rect 820,280,826,286 --color "#00A3FF" --format console
```

## Draw An Attached PNG Inside Bounds

Save or convert the attached image to `prospixel-input.png`, then fit it inside the selected square. The image will not paint outside `--bounds`.

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --image .\prospixel-input.png --bounds 820,280,839,299 --fit contain --max-image-colors 16 --format console --max-total-pros 5
```

Execute only after reviewing the plan:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --image .\prospixel-input.png --bounds 820,280,839,299 --fit contain --max-image-colors 16 --execute --yes --confirm-mainnet --max-total-pros 5 --format console
```

## Cheapest Pixels In An Area

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --cheapest --limit 100 --area 800,250,900,350 --color "#EF4444" --format console --max-total-pros 2
```

## Execute After Review

Create `.env` in the project root:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RPC_URL=https://rpc.pharos.xyz
```

Then execute:

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --execute --yes --confirm-mainnet --max-total-pros 2
```

## AI Agent Prompt

```text
[$pharos-prospixel-painter-agent](C:\\Users\\User\\.agents\\skills\\pharos-prospixel-painter-agent\\SKILL.md)

Plan a ProsPixel drawing on Pharos mainnet. Do not execute yet.

Draw the text "PROS" starting at x=820, y=280 with color #EF4444.
Estimate total PROS cost, check gas readiness, and show a compact pixel preview.
Use Node.js only. Do not require Foundry, forge, cast, Bash, Git Bash, or WSL.
```

Image prompt:

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
Use Node.js only. Do not require Foundry, forge, cast, Bash, Git Bash, or WSL.
```

For execution, add:

```text
Execute the approved ProsPixel paint transaction using PRIVATE_KEY from my local .env. Max total cost: 2 PROS.
```
