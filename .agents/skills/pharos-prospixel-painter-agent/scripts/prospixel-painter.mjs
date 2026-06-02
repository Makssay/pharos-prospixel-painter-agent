#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const NETWORKS_PATH = path.join(SKILL_ROOT, "assets", "networks.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_COLOR = "#EF4444";
const CONTRACT_BATCH_PIXEL_LIMIT = 400;
const DEFAULT_BATCH_SIZE = 400;
const DEFAULT_MAX_PIXELS = 1000;
const DEFAULT_MAX_SCAN_PIXELS = 2500;
const DEFAULT_SCAN_CONCURRENCY = 8;

const PROS_PIXEL_ABI = [
  "function batchBuyPixels(uint16[] x,uint16[] y,uint24[] colors) payable",
  "function getAllFeeAmounts(uint16[] x,uint16[] y) view returns (uint256 totalFee)",
  "function getFeeAmount(uint16 x,uint16 y) view returns (uint256)",
  "function getPixel(uint256 round,uint16 x,uint16 y) view returns (address owner,uint256 price)",
  "function currentRound() view returns (uint256)",
  "function isRegistered(address user) view returns (bool)",
  "function register(address inviter)",
  "event BatchPixelsBought(address indexed user,address indexed inviter,uint256 indexed round,uint16[] x,uint16[] y,uint24[] colors,uint256 totalValue,uint256 totalInviterReward)",
  "event PixelPremiumDistributed(address indexed lastOwner,uint256 indexed round,uint16 x,uint16 y,uint256 lastPrice,uint256 premiumToSeller)",
  "event Registered(address indexed user,address indexed inviter)"
];

const FONT_5X7 = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

async function main() {
  loadDotEnv(path.join(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const network = resolveNetwork(args);
  const warnings = [];
  let ethers = null;
  let provider = null;
  let contract = null;
  let round = args.round != null ? BigInt(args.round) : null;

  if (!args.offline) {
    ethers = await loadEthers(false);
    if (ethers) {
      provider = new ethers.JsonRpcProvider(args.rpcUrl || network.rpcUrl);
      contract = new ethers.Contract(network.prosPixel.contract, PROS_PIXEL_ABI, provider);
      await assertChain(provider, network);
      if (round == null) round = await contract.currentRound();
    } else {
      warnings.push("ethers is not installed; exact contract fee and gas checks are unavailable. Run npm install ethers for live planning/execution.");
    }
  }
  if (round == null) round = 0n;

  const pixels = await buildPixelPlan(args, network, round, warnings);
  const normalizedPixels = normalizePixels(pixels, network.prosPixel.canvasSize);
  if (!normalizedPixels.length) throw new Error("No pixels selected. Use --pixel, --pixels, --rect, --text, --csv, or --cheapest.");
  if (normalizedPixels.length > args.maxPixels) {
    throw new Error(`Pixel count ${normalizedPixels.length} exceeds --max-pixels ${args.maxPixels}.`);
  }

  const batches = chunkPixels(normalizedPixels, args.batchSize);
  const plan = {
    generatedAt: new Date().toISOString(),
    mode: args.execute ? "execute" : "plan",
    network: summarizeNetwork(network),
    contract: network.prosPixel.contract,
    round: round.toString(),
    pixels: normalizedPixels,
    pixelCount: normalizedPixels.length,
    batchSize: args.batchSize,
    batchCount: batches.length,
    batches: summarizeBatches(batches),
    bounds: getBounds(normalizedPixels),
    checks: [],
    warnings,
    estimates: {},
    execution: null
  };

  addCheck(plan, "OK", `Built ${normalizedPixels.length} ProsPixel pixel action(s).`);
  addCheck(plan, "OK", `Split into ${batches.length} transaction batch(es): ${batches.map((batch) => batch.length).join(", ")} pixel(s).`);
  addCheck(plan, "OK", `Coordinates fit inside ${network.prosPixel.canvasSize}x${network.prosPixel.canvasSize} canvas.`);
  addCheck(plan, "OK", `Target contract: ${shortAddress(network.prosPixel.contract)} on ${network.name}.`);

  if (!args.offline && ethers && contract) {
    const batchFees = await quoteBatchFees(contract, batches);
    const totalFee = batchFees.reduce((sum, fee) => sum + fee, 0n);
    plan.estimates.totalValueWei = totalFee.toString();
    plan.estimates.totalValueNative = formatEther(totalFee);
    plan.estimates.batchValues = batchFees.map((fee, index) => ({
      batch: index + 1,
      pixels: batches[index].length,
      valueWei: fee.toString(),
      valueNative: formatEther(fee)
    }));
    addCheck(plan, "OK", `Contract fee quote fetched across ${batches.length} batch(es): ${formatEther(totalFee)} ${network.nativeToken}.`);

    if (args.maxTotalPros != null) {
      const cap = parseEtherDecimal(args.maxTotalPros);
      if (totalFee > cap) {
        addCheck(plan, "FAIL", `Total value ${formatEther(totalFee)} ${network.nativeToken} exceeds cap ${args.maxTotalPros}.`);
      } else {
        addCheck(plan, "OK", `Total value is within cap ${args.maxTotalPros} ${network.nativeToken}.`);
      }
    }

    const fromAddress = await resolveFromAddress(args, ethers);
    if (fromAddress) {
      const registered = await contract.isRegistered(fromAddress);
      plan.estimates.signer = fromAddress;
      plan.estimates.isRegistered = registered;
      addCheck(plan, registered ? "OK" : "FAIL", registered ? "Signer is registered in ProsPixel." : "Signer is not registered in ProsPixel; register in the app before buying pixels.");
      const balance = await provider.getBalance(fromAddress);
      plan.estimates.signerBalanceNative = formatEther(balance);
      addCheck(plan, balance > totalFee ? "OK" : "FAIL", `Signer balance: ${formatEther(balance)} ${network.nativeToken}.`);
      const gasEstimates = await estimatePaintGasBatches(provider, ethers, network, fromAddress, batches, batchFees, warnings);
      if (gasEstimates.length) {
        const gasTotal = gasEstimates.reduce((sum, gas) => sum + gas, 0n);
        plan.estimates.gasEstimate = gasTotal.toString();
        plan.estimates.batchGasEstimates = gasEstimates.map((gas, index) => ({
          batch: index + 1,
          gas: gas.toString()
        }));
        addCheck(plan, "OK", `Gas estimate across ${gasEstimates.length} batch(es): ${gasTotal.toString()}.`);
      }
    } else {
      warnings.push("No PRIVATE_KEY or --from address was provided; signer registration, balance, and gas checks were skipped.");
    }
  } else if (args.offline) {
    warnings.push("Offline mode: skipped RPC, fee, registration, balance, and gas checks.");
  }

  if (args.execute) {
    const execution = await executePaint(args, network, ethers, provider, contract, batches, plan);
    plan.execution = execution;
  }

  const rendered = renderPlan(plan, args);
  if (args.output) {
    fs.writeFileSync(args.output, rendered, "utf8");
  } else {
    process.stdout.write(rendered);
    if (!rendered.endsWith("\n")) process.stdout.write("\n");
  }
}

function parseArgs(argv) {
  const args = {
    network: "mainnet",
    rpcUrl: null,
    round: null,
    pixelSpecs: [],
    pixelsSpecs: [],
    csv: null,
    image: null,
    bounds: null,
    fit: "contain",
    transparentThreshold: 1,
    maxImageColors: 0,
    background: null,
    rect: null,
    text: null,
    x: null,
    y: null,
    scale: 1,
    color: DEFAULT_COLOR,
    cheapest: false,
    limit: null,
    area: null,
    sampleStep: 1,
    allowLargeScan: false,
    scanConcurrency: DEFAULT_SCAN_CONCURRENCY,
    maxPixels: DEFAULT_MAX_PIXELS,
    batchSize: DEFAULT_BATCH_SIZE,
    maxScanPixels: DEFAULT_MAX_SCAN_PIXELS,
    maxTotalPros: null,
    from: null,
    execute: false,
    yes: false,
    confirmMainnet: false,
    offline: false,
    noPreview: false,
    format: null,
    output: null,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--network":
        args.network = readValue(argv, ++i, arg);
        break;
      case "--rpc-url":
        args.rpcUrl = readValue(argv, ++i, arg);
        break;
      case "--round":
        args.round = readValue(argv, ++i, arg);
        break;
      case "--pixel":
        args.pixelSpecs.push(readValue(argv, ++i, arg));
        break;
      case "--pixels":
        args.pixelsSpecs.push(readValue(argv, ++i, arg));
        break;
      case "--csv":
      case "--pixels-file":
        args.csv = readValue(argv, ++i, arg);
        break;
      case "--image":
        args.image = readValue(argv, ++i, arg);
        break;
      case "--bounds":
      case "--box":
        args.bounds = readValue(argv, ++i, arg);
        break;
      case "--fit":
        args.fit = readValue(argv, ++i, arg);
        break;
      case "--transparent-threshold":
        args.transparentThreshold = Number(readValue(argv, ++i, arg));
        break;
      case "--max-image-colors":
      case "--max-colors":
        args.maxImageColors = Number(readValue(argv, ++i, arg));
        break;
      case "--background":
        args.background = readValue(argv, ++i, arg);
        break;
      case "--rect":
        args.rect = readValue(argv, ++i, arg);
        break;
      case "--text":
        args.text = readValue(argv, ++i, arg);
        break;
      case "--x":
        args.x = Number(readValue(argv, ++i, arg));
        break;
      case "--y":
        args.y = Number(readValue(argv, ++i, arg));
        break;
      case "--scale":
        args.scale = Number(readValue(argv, ++i, arg));
        break;
      case "--color":
        args.color = readValue(argv, ++i, arg);
        break;
      case "--cheapest":
        args.cheapest = true;
        break;
      case "--limit":
        args.limit = Number(readValue(argv, ++i, arg));
        break;
      case "--area":
        args.area = readValue(argv, ++i, arg);
        break;
      case "--sample-step":
        args.sampleStep = Number(readValue(argv, ++i, arg));
        break;
      case "--allow-large-scan":
        args.allowLargeScan = true;
        break;
      case "--scan-concurrency":
        args.scanConcurrency = Number(readValue(argv, ++i, arg));
        break;
      case "--max-pixels":
        args.maxPixels = Number(readValue(argv, ++i, arg));
        break;
      case "--batch-size":
      case "--pixels-per-tx":
        args.batchSize = Number(readValue(argv, ++i, arg));
        break;
      case "--max-scan-pixels":
        args.maxScanPixels = Number(readValue(argv, ++i, arg));
        break;
      case "--max-total-pros":
      case "--max-total":
        args.maxTotalPros = readValue(argv, ++i, arg);
        break;
      case "--from":
        args.from = readValue(argv, ++i, arg);
        break;
      case "--execute":
      case "--paint":
        args.execute = true;
        break;
      case "--yes":
        args.yes = true;
        break;
      case "--confirm-mainnet":
        args.confirmMainnet = true;
        break;
      case "--offline":
      case "--skip-rpc":
        args.offline = true;
        break;
      case "--no-preview":
        args.noPreview = true;
        break;
      case "--format":
        args.format = readValue(argv, ++i, arg);
        break;
      case "--output":
        args.output = readValue(argv, ++i, arg);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.format && args.output) args.format = inferFormat(args.output);
  if (!args.format) args.format = "markdown";
  if (!["markdown", "json", "console"].includes(args.format)) throw new Error("--format must be markdown, json, or console");
  if (!Number.isInteger(args.maxPixels) || args.maxPixels <= 0) throw new Error("--max-pixels must be a positive integer");
  if (!Number.isInteger(args.batchSize) || args.batchSize <= 0) throw new Error("--batch-size must be a positive integer");
  if (args.batchSize > CONTRACT_BATCH_PIXEL_LIMIT) {
    throw new Error(`--batch-size cannot exceed ProsPixel contract/UI limit of ${CONTRACT_BATCH_PIXEL_LIMIT} pixels per transaction`);
  }
  if (!Number.isInteger(args.maxScanPixels) || args.maxScanPixels <= 0) throw new Error("--max-scan-pixels must be a positive integer");
  if (!Number.isInteger(args.scale) || args.scale <= 0) throw new Error("--scale must be a positive integer");
  if (!Number.isInteger(args.sampleStep) || args.sampleStep <= 0) throw new Error("--sample-step must be a positive integer");
  if (!Number.isInteger(args.scanConcurrency) || args.scanConcurrency <= 0) throw new Error("--scan-concurrency must be a positive integer");
  if (!["contain", "cover", "stretch"].includes(args.fit)) throw new Error("--fit must be contain, cover, or stretch");
  if (!Number.isInteger(args.transparentThreshold) || args.transparentThreshold < 0 || args.transparentThreshold > 255) throw new Error("--transparent-threshold must be 0..255");
  if (!Number.isInteger(args.maxImageColors) || args.maxImageColors < 0) throw new Error("--max-image-colors must be 0 or a positive integer");
  if (args.background) args.background = normalizeColor(args.background);
  return args;
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (value == null || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function inferFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "json";
  if (ext === ".txt" || ext === ".console") return "console";
  return "markdown";
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function resolveNetwork(args) {
  const config = JSON.parse(fs.readFileSync(NETWORKS_PATH, "utf8"));
  const network = config.networks.find((item) => item.name === args.network);
  if (!network) throw new Error(`Unsupported network: ${args.network}`);
  return { ...network, rpcUrl: args.rpcUrl || network.rpcUrl };
}

function summarizeNetwork(network) {
  return {
    name: network.name,
    chainId: network.chainId,
    rpcUrl: network.rpcUrl,
    explorerUrl: network.explorerUrl,
    nativeToken: network.nativeToken,
    appUrl: network.prosPixel.appUrl
  };
}

async function loadEthers(required) {
  try {
    const mod = await import("ethers");
    return mod.ethers;
  } catch {
    if (required) throw new Error("ethers is required for live contract checks and execution. Run: npm install ethers");
    return null;
  }
}

async function assertChain(provider, network) {
  const connected = await provider.getNetwork();
  if (Number(connected.chainId) !== network.chainId) {
    throw new Error(`Wrong chain: expected ${network.chainId}, got ${connected.chainId.toString()}`);
  }
}

async function buildPixelPlan(args, network, round, warnings) {
  const pixels = [];
  for (const spec of args.pixelSpecs) pixels.push(parsePixelSpec(spec, args.color));
  for (const list of args.pixelsSpecs) {
    for (const spec of list.split(";")) {
      if (spec.trim()) pixels.push(parsePixelSpec(spec.trim(), args.color));
    }
  }
  if (args.csv) pixels.push(...readCsvPixels(args.csv, args.color));
  if (args.image) pixels.push(...buildImagePixels(args, warnings));
  if (args.rect) pixels.push(...buildRectPixels(args.rect, args.color));
  if (args.text != null) pixels.push(...buildTextPixels(args.text, args.x, args.y, args.color, args.scale));
  if (args.cheapest) {
    pixels.push(...await scanCheapestPixels(args, network, round, warnings));
  }
  return pixels;
}

function parsePixelSpec(spec, fallbackColor) {
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) throw new Error(`Invalid pixel spec: ${spec}. Use x,y,#RRGGBB`);
  return {
    x: Number(parts[0]),
    y: Number(parts[1]),
    color: normalizeColor(parts[2] || fallbackColor)
  };
}

function readCsvPixels(filePath, fallbackColor) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^x\s*,\s*y\s*,/i.test(trimmed)) continue;
    rows.push(parsePixelSpec(trimmed, fallbackColor));
  }
  return rows;
}

function buildImagePixels(args, warnings) {
  if (!args.bounds) throw new Error("--image requires --bounds x1,y1,x2,y2");
  const [x1, y1, x2, y2] = parseNumberList(args.bounds, 4, "--bounds");
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const targetWidth = maxX - minX + 1;
  const targetHeight = maxY - minY + 1;
  if (targetWidth <= 0 || targetHeight <= 0) throw new Error("--bounds must define a positive area");

  const image = decodePng(args.image);
  const fit = computeImageFit(image.width, image.height, targetWidth, targetHeight, args.fit);
  const background = args.background ? hexToRgb(args.background) : null;
  const pixels = [];

  for (let ty = 0; ty < targetHeight; ty += 1) {
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const src = mapTargetToSource(tx, ty, image.width, image.height, fit);
      if (!src) continue;
      const rgba = getRgba(image, src.x, src.y);
      if (rgba.a < args.transparentThreshold && !background) continue;
      const blended = background ? blendOverBackground(rgba, background) : rgba;
      pixels.push({
        x: minX + tx,
        y: minY + ty,
        color: rgbToHex(blended.r, blended.g, blended.b)
      });
    }
  }

  const quantized = args.maxImageColors > 0 ? quantizePixelColors(pixels, args.maxImageColors) : pixels;
  warnings.push(`Loaded PNG ${path.basename(args.image)} (${image.width}x${image.height}) into bounds ${minX},${minY}..${maxX},${maxY} using fit=${args.fit}.`);
  if (quantized.length !== pixels.length) warnings.push(`Image transparency skipped ${targetWidth * targetHeight - pixels.length} target pixel(s).`);
  if (args.maxImageColors > 0) warnings.push(`Reduced image colors to at most ${args.maxImageColors}.`);
  return quantized;
}

function decodePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("--image currently supports PNG files only. Convert the image to PNG first.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}. Use an 8-bit PNG.`);
  if (interlace !== 0) throw new Error("Interlaced PNG is not supported. Re-export as non-interlaced PNG.");
  if (![0, 2, 3, 4, 6].includes(colorType)) throw new Error(`Unsupported PNG color type ${colorType}.`);
  if (colorType === 3 && !palette) throw new Error("Indexed PNG is missing PLTE palette.");

  const channels = pngChannels(colorType);
  const bytesPerPixel = channels;
  const scanlineLength = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const raw = Buffer.alloc(width * height * channels);
  let inOffset = 0;
  let prev = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOffset];
    inOffset += 1;
    const line = Buffer.from(inflated.subarray(inOffset, inOffset + scanlineLength));
    inOffset += scanlineLength;
    unfilterLine(line, prev, bytesPerPixel, filter);
    line.copy(raw, y * scanlineLength);
    prev = line;
  }

  return { width, height, bitDepth, colorType, channels, raw, palette, transparency };
}

function pngChannels(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type ${colorType}`);
}

function unfilterLine(line, prev, bpp, filter) {
  for (let i = 0; i < line.length; i += 1) {
    const left = i >= bpp ? line[i - bpp] : 0;
    const up = prev[i] || 0;
    const upLeft = i >= bpp ? prev[i - bpp] || 0 : 0;
    if (filter === 0) {
      continue;
    } else if (filter === 1) {
      line[i] = (line[i] + left) & 0xff;
    } else if (filter === 2) {
      line[i] = (line[i] + up) & 0xff;
    } else if (filter === 3) {
      line[i] = (line[i] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      line[i] = (line[i] + paethPredictor(left, up, upLeft)) & 0xff;
    } else {
      throw new Error(`Unsupported PNG filter ${filter}`);
    }
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function computeImageFit(srcWidth, srcHeight, targetWidth, targetHeight, mode) {
  if (mode === "stretch") {
    return { drawWidth: targetWidth, drawHeight: targetHeight, offsetX: 0, offsetY: 0, scaleX: srcWidth / targetWidth, scaleY: srcHeight / targetHeight };
  }
  const scale = mode === "cover"
    ? Math.max(targetWidth / srcWidth, targetHeight / srcHeight)
    : Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
  const drawWidth = Math.max(1, Math.round(srcWidth * scale));
  const drawHeight = Math.max(1, Math.round(srcHeight * scale));
  return {
    drawWidth,
    drawHeight,
    offsetX: Math.floor((targetWidth - drawWidth) / 2),
    offsetY: Math.floor((targetHeight - drawHeight) / 2),
    scaleX: srcWidth / drawWidth,
    scaleY: srcHeight / drawHeight
  };
}

function mapTargetToSource(tx, ty, srcWidth, srcHeight, fit) {
  const localX = tx - fit.offsetX;
  const localY = ty - fit.offsetY;
  if (localX < 0 || localY < 0 || localX >= fit.drawWidth || localY >= fit.drawHeight) return null;
  const x = clamp(Math.floor(localX * fit.scaleX), 0, srcWidth - 1);
  const y = clamp(Math.floor(localY * fit.scaleY), 0, srcHeight - 1);
  return { x, y };
}

function getRgba(image, x, y) {
  const idx = (y * image.width + x) * image.channels;
  if (image.colorType === 0) {
    const v = image.raw[idx];
    return { r: v, g: v, b: v, a: 255 };
  }
  if (image.colorType === 2) {
    return { r: image.raw[idx], g: image.raw[idx + 1], b: image.raw[idx + 2], a: 255 };
  }
  if (image.colorType === 3) {
    const p = image.raw[idx];
    const pi = p * 3;
    return {
      r: image.palette[pi],
      g: image.palette[pi + 1],
      b: image.palette[pi + 2],
      a: image.transparency && p < image.transparency.length ? image.transparency[p] : 255
    };
  }
  if (image.colorType === 4) {
    const v = image.raw[idx];
    return { r: v, g: v, b: v, a: image.raw[idx + 1] };
  }
  return { r: image.raw[idx], g: image.raw[idx + 1], b: image.raw[idx + 2], a: image.raw[idx + 3] };
}

function blendOverBackground(rgba, bg) {
  const a = rgba.a / 255;
  return {
    r: Math.round(rgba.r * a + bg.r * (1 - a)),
    g: Math.round(rgba.g * a + bg.g * (1 - a)),
    b: Math.round(rgba.b * a + bg.b * (1 - a))
  };
}

function quantizePixelColors(pixels, maxColors) {
  if (!maxColors || maxColors <= 0) return pixels;
  const counts = new Map();
  for (const pixel of pixels) counts.set(pixel.color, (counts.get(pixel.color) || 0) + 1);
  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([color]) => color);
  if (!palette.length) return pixels;
  return pixels.map((pixel) => ({
    ...pixel,
    color: nearestPaletteColor(pixel.color, palette)
  }));
}

function nearestPaletteColor(color, palette) {
  const rgb = hexToRgb(color);
  let best = palette[0];
  let bestDistance = Infinity;
  for (const candidate of palette) {
    const c = hexToRgb(candidate);
    const d = (rgb.r - c.r) ** 2 + (rgb.g - c.g) ** 2 + (rgb.b - c.b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  return best;
}

function hexToRgb(color) {
  const normalized = normalizeColor(color);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

function toHexByte(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildRectPixels(rectSpec, color) {
  const [x1, y1, x2, y2] = parseNumberList(rectSpec, 4, "--rect");
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const out = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      out.push({ x, y, color: normalizeColor(color) });
    }
  }
  return out;
}

function buildTextPixels(text, startX, startY, color, scale) {
  if (!Number.isInteger(startX) || !Number.isInteger(startY)) throw new Error("--text requires --x and --y");
  const normalizedColor = normalizeColor(color);
  const out = [];
  let cursorX = startX;
  for (const rawChar of String(text).toUpperCase()) {
    const glyph = FONT_5X7[rawChar] || FONT_5X7[" "];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== "1") continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            out.push({
              x: cursorX + gx * scale + sx,
              y: startY + gy * scale + sy,
              color: normalizedColor
            });
          }
        }
      }
    }
    cursorX += 6 * scale;
  }
  return out;
}

async function scanCheapestPixels(args, network, round, warnings) {
  if (!args.area) throw new Error("--cheapest requires --area x1,y1,x2,y2");
  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--cheapest requires --limit <positive integer>");
  const [x1, y1, x2, y2] = parseNumberList(args.area, 4, "--area");
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const coords = [];
  for (let y = minY; y <= maxY; y += args.sampleStep) {
    for (let x = minX; x <= maxX; x += args.sampleStep) coords.push({ x, y });
  }
  if (coords.length > args.maxScanPixels && !args.allowLargeScan) {
    throw new Error(`Cheapest scan would read ${coords.length} pixels. Narrow --area, increase --sample-step, set --max-scan-pixels, or pass --allow-large-scan.`);
  }
  warnings.push(`Scanning ${coords.length} ProsPixel BFF pixels for cheapest candidates in round ${round.toString()}.`);
  const candidates = await mapConcurrent(coords, args.scanConcurrency, async (coord) => {
    const item = await fetchBffPixel(network, round, coord.x, coord.y);
    if (!item) return null;
    return {
      x: Number(item.x),
      y: Number(item.y),
      color: normalizeColor(args.color),
      sourcePriceWei: item.price?.toString(),
      sourceOwner: item.owner || null,
      sourceBuyCount: Number(item.buyCount ?? 0)
    };
  });
  const selected = candidates
    .filter(Boolean)
    .sort((a, b) => compareBigInt(BigInt(a.sourcePriceWei || "0"), BigInt(b.sourcePriceWei || "0")))
    .slice(0, args.limit);
  if (selected.length < args.limit) warnings.push(`Only ${selected.length} cheapest candidates were found.`);
  return selected;
}

async function fetchBffPixel(network, round, x, y) {
  const url = new URL("/v1/pixel", network.prosPixel.bffBaseUrl);
  url.searchParams.set("round", round.toString());
  url.searchParams.set("x", String(x));
  url.searchParams.set("y", String(y));
  const response = await fetch(url, { headers: { "User-Agent": "pharos-prospixel-painter-agent/1.0" } });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error(`ProsPixel BFF error ${response.status} for ${x},${y}`);
  const json = await response.json();
  return json.item || null;
}

async function mapConcurrent(items, concurrency, mapper) {
  const out = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await mapper(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function normalizePixels(pixels, canvasSize) {
  const map = new Map();
  for (const pixel of pixels) {
    const x = Number(pixel.x);
    const y = Number(pixel.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Invalid coordinate: ${pixel.x},${pixel.y}`);
    if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) throw new Error(`Coordinate out of bounds: ${x},${y}`);
    const color = normalizeColor(pixel.color);
    map.set(`${x},${y}`, {
      x,
      y,
      color,
      colorInt: colorToUint24(color),
      sourcePriceWei: pixel.sourcePriceWei || null,
      sourceOwner: pixel.sourceOwner || null,
      sourceBuyCount: pixel.sourceBuyCount ?? null
    });
  }
  return [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function chunkPixels(pixels, batchSize) {
  const chunks = [];
  for (let i = 0; i < pixels.length; i += batchSize) {
    chunks.push(pixels.slice(i, i + batchSize));
  }
  return chunks;
}

function summarizeBatches(batches) {
  return batches.map((batch, index) => ({
    index: index + 1,
    pixels: batch.length,
    bounds: getBounds(batch)
  }));
}

function batchArrays(batch) {
  return {
    xs: batch.map((pixel) => pixel.x),
    ys: batch.map((pixel) => pixel.y),
    colors: batch.map((pixel) => pixel.colorInt)
  };
}

async function quoteBatchFees(contract, batches) {
  const fees = [];
  for (const batch of batches) {
    const { xs, ys } = batchArrays(batch);
    fees.push(await contract.getAllFeeAmounts(xs, ys));
  }
  return fees;
}

function normalizeColor(value) {
  let color = String(value || DEFAULT_COLOR).trim();
  if (color.startsWith("0x")) color = `#${color.slice(2)}`;
  if (!color.startsWith("#")) color = `#${color}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`Invalid color: ${value}. Use #RRGGBB.`);
  return color.toUpperCase();
}

function colorToUint24(color) {
  return Number.parseInt(normalizeColor(color).slice(1), 16);
}

function parseNumberList(value, expected, label) {
  const nums = String(value).split(",").map((part) => Number(part.trim()));
  if (nums.length !== expected || nums.some((num) => !Number.isInteger(num))) {
    throw new Error(`${label} must contain ${expected} comma-separated integers`);
  }
  return nums;
}

function compareBigInt(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

async function resolveFromAddress(args, ethers) {
  if (args.from) return ethers.getAddress(args.from);
  const key = process.env.PRIVATE_KEY;
  if (!key) return null;
  return new ethers.Wallet(key).address;
}

async function estimatePaintGasBatches(provider, ethers, network, from, batches, batchFees, warnings) {
  const iface = new ethers.Interface(PROS_PIXEL_ABI);
  const estimates = [];
  for (let i = 0; i < batches.length; i += 1) {
    const { xs, ys, colors } = batchArrays(batches[i]);
    try {
      estimates.push(await provider.estimateGas({
        from,
        to: network.prosPixel.contract,
        value: batchFees[i],
        data: iface.encodeFunctionData("batchBuyPixels", [xs, ys, colors])
      }));
    } catch (error) {
      warnings.push(`Gas estimate failed for batch ${i + 1}: ${error.shortMessage || error.message}`);
    }
  }
  return estimates;
}

async function executePaint(args, network, loadedEthers, loadedProvider, loadedContract, batches, plan) {
  if (!args.yes) throw new Error("--execute requires --yes after explicit user confirmation");
  if (network.name === "mainnet" && !args.confirmMainnet) throw new Error("mainnet execution requires --confirm-mainnet");
  const ethers = loadedEthers || await loadEthers(true);
  const provider = loadedProvider || new ethers.JsonRpcProvider(args.rpcUrl || network.rpcUrl);
  await assertChain(provider, network);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("--execute requires PRIVATE_KEY in the local environment or .env");
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = (loadedContract || new ethers.Contract(network.prosPixel.contract, PROS_PIXEL_ABI, provider)).connect(wallet);
  const plannedTotalFee = plan.estimates.totalValueWei != null
    ? BigInt(plan.estimates.totalValueWei)
    : (await quoteBatchFees(contract, batches)).reduce((sum, fee) => sum + fee, 0n);

  if (args.maxTotalPros != null && plannedTotalFee > parseEtherDecimal(args.maxTotalPros)) {
    throw new Error(`Refusing execution: planned total value ${formatEther(plannedTotalFee)} exceeds --max-total-pros ${args.maxTotalPros}`);
  }

  const registered = await contract.isRegistered(wallet.address);
  if (!registered) throw new Error(`Signer ${wallet.address} is not registered in ProsPixel. Register in the app first, then retry.`);
  const balance = await provider.getBalance(wallet.address);
  if (balance <= plannedTotalFee) throw new Error(`Signer balance ${formatEther(balance)} ${network.nativeToken} is not enough for pixel value plus gas.`);

  const explorerBase = network.explorerUrl.replace(/\/$/, "");
  const batchResults = [];
  let spent = 0n;
  const cap = args.maxTotalPros != null ? parseEtherDecimal(args.maxTotalPros) : null;

  for (let i = 0; i < batches.length; i += 1) {
    const { xs, ys, colors } = batchArrays(batches[i]);
    const batchFee = await contract.getAllFeeAmounts(xs, ys);
    if (cap != null && spent + batchFee > cap) {
      throw new Error(`Refusing batch ${i + 1}: cumulative value ${formatEther(spent + batchFee)} exceeds --max-total-pros ${args.maxTotalPros}`);
    }
    const gas = await contract.batchBuyPixels.estimateGas(xs, ys, colors, { value: batchFee });
    const tx = await contract.batchBuyPixels(xs, ys, colors, {
      value: batchFee,
      gasLimit: gas * 120n / 100n
    });
    const receipt = await tx.wait();
    spent += batchFee;
    batchResults.push({
      batch: i + 1,
      pixels: batches[i].length,
      status: receipt?.status === 1 ? "success" : "failed",
      transactionHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      gasUsed: receipt?.gasUsed?.toString() ?? null,
      valueWei: batchFee.toString(),
      valueNative: formatEther(batchFee),
      explorerTxUrl: `${explorerBase}/tx/${tx.hash}`
    });
    if (receipt?.status !== 1) throw new Error(`Batch ${i + 1} transaction failed: ${tx.hash}`);
  }

  return {
    status: batchResults.every((batch) => batch.status === "success") ? "success" : "failed",
    signer: wallet.address,
    batchCount: batchResults.length,
    totalValueWei: spent.toString(),
    totalValueNative: formatEther(spent),
    batches: batchResults,
    transactionHash: batchResults[0]?.transactionHash || null,
    explorerTxUrl: batchResults[0]?.explorerTxUrl || null
  };
}

function addCheck(plan, status, message) {
  plan.checks.push({ status, message });
}

function getBounds(pixels) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pixel of pixels) {
    minX = Math.min(minX, pixel.x);
    minY = Math.min(minY, pixel.y);
    maxX = Math.max(maxX, pixel.x);
    maxY = Math.max(maxY, pixel.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function renderPlan(plan, args) {
  if (args.format === "json") return `${JSON.stringify(plan, bigintJsonReplacer, 2)}\n`;
  if (args.format === "console") return renderConsole(plan, args);
  return renderMarkdown(plan, args);
}

function renderMarkdown(plan, args) {
  const lines = [];
  lines.push("# Pharos ProsPixel Paint Plan", "");
  lines.push(`Generated: \`${plan.generatedAt}\``);
  lines.push(`Mode: \`${plan.mode}\``);
  lines.push(`Network: \`${plan.network.name}\` (${plan.network.chainId}, ${plan.network.nativeToken})`);
  lines.push(`Contract: \`${plan.contract}\``);
  lines.push(`Round: \`${plan.round}\``);
  lines.push("");
  lines.push("## Summary", "");
  lines.push(`- Pixels: ${plan.pixelCount}`);
  lines.push(`- Transaction batches: ${plan.batchCount} (${plan.batches.map((batch) => batch.pixels).join(" + ")} pixels)`);
  lines.push(`- Bounds: x ${plan.bounds.minX}..${plan.bounds.maxX}, y ${plan.bounds.minY}..${plan.bounds.maxY}`);
  if (plan.estimates.totalValueNative) lines.push(`- Total value: ${plan.estimates.totalValueNative} ${plan.network.nativeToken}`);
  if (plan.estimates.gasEstimate) lines.push(`- Gas estimate: ${plan.estimates.gasEstimate}`);
  if (plan.estimates.signer) lines.push(`- Signer: \`${plan.estimates.signer}\``);
  lines.push("");
  lines.push("## Pixels", "");
  lines.push("| # | X | Y | Color | Source price |");
  lines.push("| ---: | ---: | ---: | --- | ---: |");
  for (const [idx, pixel] of plan.pixels.slice(0, 80).entries()) {
    lines.push(`| ${idx + 1} | ${pixel.x} | ${pixel.y} | \`${pixel.color}\` | ${pixel.sourcePriceWei ? `${formatEther(BigInt(pixel.sourcePriceWei))} ${plan.network.nativeToken}` : "-"} |`);
  }
  if (plan.pixels.length > 80) lines.push(`| ... | ... | ... | ... | ${plan.pixels.length - 80} more |`);
  if (!args.noPreview) {
    lines.push("", "## Preview", "", "```text", renderPreview(plan.pixels), "```");
  }
  lines.push("", "## Checks", "");
  for (const check of plan.checks) lines.push(`- \`${check.status}\` ${check.message}`);
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "");
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
  }
  if (plan.execution) {
    lines.push("", "## Execution", "");
    lines.push(`- Status: ${plan.execution.status}`);
    lines.push(`- Batches: ${plan.execution.batchCount}`);
    lines.push(`- Total value: ${plan.execution.totalValueNative} ${plan.network.nativeToken}`);
    for (const batch of plan.execution.batches || []) {
      lines.push(`- Batch ${batch.batch}: ${batch.pixels} pixels, \`${batch.transactionHash}\`, ${batch.explorerTxUrl}`);
    }
  }
  lines.push("", "_Dry-run by default. Real painting requires --execute --yes and a local PRIVATE_KEY._");
  return `${lines.join("\n")}\n`;
}

function renderConsole(plan, args) {
  const lines = [];
  lines.push("PHAROS PROSPIXEL PAINT PLAN");
  lines.push(`Generated: ${plan.generatedAt}`);
  lines.push(`Mode: ${plan.mode}`);
  lines.push(`Network: ${plan.network.name} | chain ${plan.network.chainId} | ${plan.network.nativeToken}`);
  lines.push(`Contract: ${shortAddress(plan.contract)}`);
  lines.push(`Round: ${plan.round}`);
  lines.push("");
  lines.push(`Pixels: ${plan.pixelCount}`);
  lines.push(`Batches: ${plan.batchCount} (${plan.batches.map((batch) => batch.pixels).join(" + ")} pixels)`);
  lines.push(`Bounds: x ${plan.bounds.minX}..${plan.bounds.maxX}, y ${plan.bounds.minY}..${plan.bounds.maxY}`);
  if (plan.estimates.totalValueNative) lines.push(`Total: ${plan.estimates.totalValueNative} ${plan.network.nativeToken}`);
  if (plan.estimates.gasEstimate) lines.push(`Gas estimate: ${plan.estimates.gasEstimate}`);
  if (plan.estimates.signer) lines.push(`Signer: ${shortAddress(plan.estimates.signer)}`);
  lines.push("");
  lines.push("Checks:");
  for (const check of plan.checks) lines.push(`[${check.status}] ${check.message}`);
  if (plan.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
  }
  if (!args.noPreview) {
    lines.push("");
    lines.push("Preview:");
    lines.push(renderPreview(plan.pixels));
  }
  lines.push("");
  lines.push("First pixels:");
  for (const [idx, pixel] of plan.pixels.slice(0, 20).entries()) {
    lines.push(`${String(idx + 1).padStart(2, " ")}. x=${pixel.x} y=${pixel.y} color=${pixel.color}`);
  }
  if (plan.pixels.length > 20) lines.push(`... ${plan.pixels.length - 20} more`);
  if (plan.execution) {
    lines.push("");
    lines.push(`Execution: ${plan.execution.status}`);
    lines.push(`Batches sent: ${plan.execution.batchCount}`);
    lines.push(`Total spent: ${plan.execution.totalValueNative} ${plan.network.nativeToken}`);
    for (const batch of plan.execution.batches || []) {
      lines.push(`Batch ${batch.batch}: ${batch.pixels} pixels | tx ${batch.transactionHash}`);
      lines.push(`Explorer: ${batch.explorerTxUrl}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderPreview(pixels) {
  const bounds = getBounds(pixels);
  if (bounds.width > 80 || bounds.height > 40) {
    return `Preview skipped: bounds ${bounds.width}x${bounds.height} exceed 80x40.`;
  }
  const set = new Set(pixels.map((pixel) => `${pixel.x},${pixel.y}`));
  const lines = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    let row = "";
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) row += set.has(`${x},${y}`) ? "#" : ".";
    lines.push(row);
  }
  return lines.join("\n");
}

function formatEther(value) {
  const wei = BigInt(value);
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : whole.toString();
}

function parseEtherDecimal(value) {
  const str = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) throw new Error(`Invalid PROS amount: ${value}`);
  const [whole, frac = ""] = str.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18));
}

function shortAddress(address) {
  if (!address || address.length < 12) return String(address);
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function bigintJsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

function printHelp() {
  process.stdout.write(`Pharos ProsPixel Painter Agent

Plan and optionally execute ProsPixel pixel purchases and drawings.

Examples:
  node scripts/prospixel-painter.mjs --pixel "822,285,#EF4444" --format console
  node scripts/prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --format console
  node scripts/prospixel-painter.mjs --cheapest --limit 100 --area 800,250,900,350 --color "#EF4444"
  node scripts/prospixel-painter.mjs --text "PROS" --x 820 --y 280 --color "#EF4444" --execute --yes --confirm-mainnet --max-total-pros 2

Inputs:
  --network mainnet|atlantic-testnet
  --pixel x,y,#RRGGBB
  --pixels "x,y,#RRGGBB;x,y,#RRGGBB"
  --csv pixels.csv
  --image image.png --bounds x1,y1,x2,y2 [--fit contain|cover|stretch]
  --rect x1,y1,x2,y2 --color #RRGGBB
  --text "TEXT" --x N --y N --color #RRGGBB [--scale N]
  --cheapest --limit N --area x1,y1,x2,y2 --color #RRGGBB
  --batch-size N (default 400, maximum 400)
  --execute --yes [--confirm-mainnet]
  --max-total-pros N
  --format markdown|json|console
`);
}
