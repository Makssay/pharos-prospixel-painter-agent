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

## Fill A Rectangle

```powershell
node .\.agents\skills\pharos-prospixel-painter-agent\scripts\prospixel-painter.mjs --rect 820,280,826,286 --color "#00A3FF" --format console
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

For execution, add:

```text
Execute the approved ProsPixel paint transaction using PRIVATE_KEY from my local .env. Max total cost: 2 PROS.
```
