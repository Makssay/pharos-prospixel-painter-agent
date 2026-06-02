# Safety Notes

ProsPixel painting is a real payable onchain action. Treat every execution like a mainnet purchase.

## Required Checks

- Confirm target network and contract address.
- Confirm pixel count, coordinates, colors, and bounding box.
- Confirm transaction batch count. ProsPixel supports 400 pixels per transaction, so large drawings must be split before broadcasting.
- For image mode, confirm the converted PNG path, bounds, fit mode, final pixel count, color count, and that no pixels are outside the requested square.
- Confirm exact `getAllFeeAmounts(x[], y[])` value when RPC is available.
- Confirm signer address and native balance.
- Confirm `--max-total-pros` and `--max-pixels` caps.
- Require `--execute --yes`; on mainnet also require `--confirm-mainnet`.

## Private Key Handling

- Use `PRIVATE_KEY` from the local shell or `.env`.
- Never print the private key.
- Never ask the user to paste the private key into an AI prompt.
- Never write private keys to reports.

## Image Mode

- Only PNG is decoded by the bundled script.
- Keep the target bounds small for cost control. A 20x20 image is 400 pixels; a 30x30 image is 900 pixels.
- Use `--max-image-colors` for simpler pixel art and easier review.
- Always inspect the plan before execution.

## Cheapest Pixel Scans

Whole-canvas exact search can require up to 1,000,000 pixel reads. Prefer bounded areas.

Good prompt:

```text
Find 100 cheapest pixels in area 800,250,900,350.
```

Risky prompt:

```text
Find the 100 cheapest pixels on the whole board.
```

For whole-canvas work, use a sampled scan first, then re-check selected pixels through the contract before execution.
