#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const NETWORKS_PATH = path.join(SKILL_ROOT, "assets", "networks.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_COLOR = "#EF4444";
const DEFAULT_MAX_PIXELS = 500;
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

  const xs = normalizedPixels.map((pixel) => pixel.x);
  const ys = normalizedPixels.map((pixel) => pixel.y);
  const colors = normalizedPixels.map((pixel) => pixel.colorInt);
  const plan = {
    generatedAt: new Date().toISOString(),
    mode: args.execute ? "execute" : "plan",
    network: summarizeNetwork(network),
    contract: network.prosPixel.contract,
    round: round.toString(),
    pixels: normalizedPixels,
    pixelCount: normalizedPixels.length,
    bounds: getBounds(normalizedPixels),
    checks: [],
    warnings,
    estimates: {},
    execution: null
  };

  addCheck(plan, "OK", `Built ${normalizedPixels.length} ProsPixel pixel action(s).`);
  addCheck(plan, "OK", `Coordinates fit inside ${network.prosPixel.canvasSize}x${network.prosPixel.canvasSize} canvas.`);
  addCheck(plan, "OK", `Target contract: ${shortAddress(network.prosPixel.contract)} on ${network.name}.`);

  if (!args.offline && ethers && contract) {
    const totalFee = await contract.getAllFeeAmounts(xs, ys);
    plan.estimates.totalValueWei = totalFee.toString();
    plan.estimates.totalValueNative = formatEther(totalFee);
    addCheck(plan, "OK", `Contract fee quote fetched: ${formatEther(totalFee)} ${network.nativeToken}.`);

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
      const gasEstimate = await estimatePaintGas(provider, ethers, network, fromAddress, xs, ys, colors, totalFee, warnings);
      if (gasEstimate != null) {
        plan.estimates.gasEstimate = gasEstimate.toString();
        addCheck(plan, "OK", `Gas estimate: ${gasEstimate.toString()}.`);
      }
    } else {
      warnings.push("No PRIVATE_KEY or --from address was provided; signer registration, balance, and gas checks were skipped.");
    }
  } else if (args.offline) {
    warnings.push("Offline mode: skipped RPC, fee, registration, balance, and gas checks.");
  }

  if (args.execute) {
    const execution = await executePaint(args, network, ethers, provider, contract, xs, ys, colors, plan);
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
  if (!Number.isInteger(args.maxScanPixels) || args.maxScanPixels <= 0) throw new Error("--max-scan-pixels must be a positive integer");
  if (!Number.isInteger(args.scale) || args.scale <= 0) throw new Error("--scale must be a positive integer");
  if (!Number.isInteger(args.sampleStep) || args.sampleStep <= 0) throw new Error("--sample-step must be a positive integer");
  if (!Number.isInteger(args.scanConcurrency) || args.scanConcurrency <= 0) throw new Error("--scan-concurrency must be a positive integer");
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

async function estimatePaintGas(provider, ethers, network, from, xs, ys, colors, value, warnings) {
  try {
    const iface = new ethers.Interface(PROS_PIXEL_ABI);
    return await provider.estimateGas({
      from,
      to: network.prosPixel.contract,
      value,
      data: iface.encodeFunctionData("batchBuyPixels", [xs, ys, colors])
    });
  } catch (error) {
    warnings.push(`Gas estimate failed: ${error.shortMessage || error.message}`);
    return null;
  }
}

async function executePaint(args, network, loadedEthers, loadedProvider, loadedContract, xs, ys, colors, plan) {
  if (!args.yes) throw new Error("--execute requires --yes after explicit user confirmation");
  if (network.name === "mainnet" && !args.confirmMainnet) throw new Error("mainnet execution requires --confirm-mainnet");
  const ethers = loadedEthers || await loadEthers(true);
  const provider = loadedProvider || new ethers.JsonRpcProvider(args.rpcUrl || network.rpcUrl);
  await assertChain(provider, network);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("--execute requires PRIVATE_KEY in the local environment or .env");
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = (loadedContract || new ethers.Contract(network.prosPixel.contract, PROS_PIXEL_ABI, provider)).connect(wallet);
  const totalFee = plan.estimates.totalValueWei != null
    ? BigInt(plan.estimates.totalValueWei)
    : await contract.getAllFeeAmounts(xs, ys);

  if (args.maxTotalPros != null && totalFee > parseEtherDecimal(args.maxTotalPros)) {
    throw new Error(`Refusing execution: total value ${formatEther(totalFee)} exceeds --max-total-pros ${args.maxTotalPros}`);
  }

  const registered = await contract.isRegistered(wallet.address);
  if (!registered) throw new Error(`Signer ${wallet.address} is not registered in ProsPixel. Register in the app first, then retry.`);
  const balance = await provider.getBalance(wallet.address);
  if (balance <= totalFee) throw new Error(`Signer balance ${formatEther(balance)} ${network.nativeToken} is not enough for pixel value plus gas.`);

  const gas = await contract.batchBuyPixels.estimateGas(xs, ys, colors, { value: totalFee });
  const tx = await contract.batchBuyPixels(xs, ys, colors, {
    value: totalFee,
    gasLimit: gas * 120n / 100n
  });
  const receipt = await tx.wait();
  const explorerBase = network.explorerUrl.replace(/\/$/, "");
  return {
    status: receipt?.status === 1 ? "success" : "failed",
    signer: wallet.address,
    transactionHash: tx.hash,
    blockNumber: receipt?.blockNumber ?? null,
    gasUsed: receipt?.gasUsed?.toString() ?? null,
    totalValueWei: totalFee.toString(),
    totalValueNative: formatEther(totalFee),
    explorerTxUrl: `${explorerBase}/tx/${tx.hash}`
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
    lines.push(`- Transaction: \`${plan.execution.transactionHash}\``);
    lines.push(`- Explorer: ${plan.execution.explorerTxUrl}`);
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
    lines.push(`Tx: ${plan.execution.transactionHash}`);
    lines.push(`Explorer: ${plan.execution.explorerTxUrl}`);
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
  --rect x1,y1,x2,y2 --color #RRGGBB
  --text "TEXT" --x N --y N --color #RRGGBB [--scale N]
  --cheapest --limit N --area x1,y1,x2,y2 --color #RRGGBB
  --execute --yes [--confirm-mainnet]
  --max-total-pros N
  --format markdown|json|console
`);
}
