import { keccak_256 } from "@noble/hashes/sha3.js";

export const CHAIN_CONFIG = {
  bscTestnet: {
    chainId: 97,
    chainIdHex: "0x61",
    name: "BNB Smart Chain Testnet",
    shortName: "BSC Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: [
      "https://bsc-testnet-dataseed.bnbchain.org/",
      "https://bsc-testnet.publicnode.com/",
      "https://data-seed-prebsc-1-s2.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://bsc-testnet-rpc.publicnode.com/",
    ],
    rpcUrl: "https://data-seed-prebsc-2-s1.bnbchain.org:8545/",
    blockExplorer: "https://testnet.bscscan.com",
    contractAddress: "0xeFe3D5d233Df4764826Cba9edfF8c0032E78e06C", // Updated to latest with Bitxen Governance
    governorAddress: "0x8F94e79c07ff47E16C316B5b184B72C8109AaEAC",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
    isTestnet: true,
  },
  bsc: {
    chainId: 56,
    chainIdHex: "0x38",
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/",
      "https://bsc-dataseed2.defibit.io/",
      "https://bsc-dataseed3.defibit.io/",
      "https://bsc-dataseed4.defibit.io/",
      "https://bsc-dataseed1.binance.org/",
      "https://bsc-dataseed2.binance.org/",
      "https://bsc-dataseed3.binance.org/",
      "https://bsc-dataseed4.binance.org/",
    ],
    rpcUrl: "https://bsc-dataseed.binance.org/",
    blockExplorer: "https://bscscan.com",
    contractAddress: "0xfCE73A806c3B1400a7672049D56e16E5b9bfFA2A",
    governorAddress: "0x6dd2E9B49ECBcC5b556da44D812C857Bf2a068bB",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
    isTestnet: false,
  },
  eth: {
    chainId: 1,
    chainIdHex: "0x1",
    name: "Ethereum Mainnet",
    shortName: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    contractAddress: "0x2885477436f1e80a7690bf22878D31eAC97e0244",
    governorAddress: "0xfce73a806c3b1400a7672049d56e16e5b9bffa2a",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isTestnet: false,
  },
  polygon: {
    chainId: 137,
    chainIdHex: "0x89",
    name: "Polygon Mainnet",
    shortName: "POLY",
    nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    contractAddress: "0x2885477436f1e80a7690bf22878D31eAC97e0244",
    governorAddress: "0xfce73a806c3b1400a7672049d56e16e5b9bffa2a",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    isTestnet: false,
  },
  base: {
    chainId: 8453,
    chainIdHex: "0x2105",
    name: "Base Mainnet",
    shortName: "BASE",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    contractAddress: "0x2885477436f1e80a7690bf22878D31eAC97e0244",
    governorAddress: "0x7FF06Ecc6aEF4516BDc056F686B684D724d38a71",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    isTestnet: false,
  },
  arbitrum: {
    chainId: 42161,
    chainIdHex: "0xa4b1",
    name: "Arbitrum One",
    shortName: "ARB",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    contractAddress: "0x2885477436f1e80a7690bf22878D31eAC97e0244",
    governorAddress: "0x7FF06Ecc6aEF4516BDc056F686B684D724d38a71",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    isTestnet: false,
  },
  optimism: {
    chainId: 10,
    chainIdHex: "0xa",
    name: "Optimism",
    shortName: "OP",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    isTestnet: false,
  },
  linea: {
    chainId: 59144,
    chainIdHex: "0xe708",
    name: "Linea",
    shortName: "LINEA",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.linea.build",
    blockExplorer: "https://lineascan.build",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png",
    isTestnet: false,
  },
  sei: {
    chainId: 1329,
    chainIdHex: "0x531",
    name: "Sei EVM",
    shortName: "SEI",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    rpcUrl: "https://evm-rpc.sei-apis.com",
    blockExplorer: "https://seitrace.com",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sei/info/logo.png",
    isTestnet: false,
  },
  avalanche: {
    chainId: 43114,
    chainIdHex: "0xa86a",
    name: "Avalanche C-Chain",
    shortName: "AVAX",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    blockExplorer: "https://snowtrace.io",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    isTestnet: false,
  },
  monad: {
    chainId: 10143,
    chainIdHex: "0x279f",
    name: "Monad Testnet",
    shortName: "MONAD",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrl: "https://testnet-rpc.monad.xyz",
    blockExplorer: "https://testnet.monadexplorer.com",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "",
    isTestnet: true,
  },
} as const;

interface ChainConfigBase {
  chainId: number;
  chainIdHex: string;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  contractAddress: string;
  governorAddress?: string;
  logo: string;
  isTestnet: boolean;
}

interface ChainConfigWithFallbacks extends ChainConfigBase {
  rpcUrls: string[];
}

type ChainConfig = ChainConfigBase | ChainConfigWithFallbacks;

export type ChainId = keyof typeof CHAIN_CONFIG;

function bytesToHex(data: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < data.length; i += 1) {
    hex += data[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function abiSelector(signature: string): string {
  const bytes = new TextEncoder().encode(signature);
  return bytesToHex(keccak_256(bytes).slice(0, 4));
}

function encodeBytes32(value: string): string {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length !== 64) {
    throw new Error("Invalid bytes32 length");
  }
  return normalized.toLowerCase();
}

function decodeWord(hexNo0x: string, wordIndex: number): string {
  const start = wordIndex * 64;
  const end = start + 64;
  if (end > hexNo0x.length) {
    throw new Error("ABI decode out of bounds");
  }
  return hexNo0x.slice(start, end);
}

function decodeUint256Word(word: string): bigint {
  return BigInt("0x" + word);
}

function decodeAddressWord(word: string): string {
  return "0x" + word.slice(24);
}

function decodeBoolWord(word: string): boolean {
  return BigInt("0x" + word) !== BigInt(0);
}

function decodeStringAtOffset(hexNo0x: string, offsetBytes: bigint): string {
  const offset = Number(offsetBytes);
  if (!Number.isFinite(offset) || offset < 0 || offset % 32 !== 0) {
    throw new Error("Invalid ABI string offset");
  }
  const wordIndex = offset / 32;
  const length = decodeUint256Word(decodeWord(hexNo0x, wordIndex));
  const lengthNumber = Number(length);
  if (!Number.isFinite(lengthNumber) || lengthNumber < 0) {
    throw new Error("Invalid ABI string length");
  }
  const bytesStart = (wordIndex + 1) * 32;
  const startHex = bytesStart * 2;
  const endHex = startHex + lengthNumber * 2;
  if (endHex > hexNo0x.length) {
    throw new Error("ABI string decode out of bounds");
  }
  const strBytes = hexToBytes(hexNo0x.slice(startHex, endHex));
  return new TextDecoder().decode(strBytes);
}

function decodeAbiTuple(types: string[], dataHex: string): unknown[] {
  const rawHex = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;

  // eth_call responses for struct/tuple return types are wrapped with an outer
  // tuple pointer: the first word is 0x0000...0020 (= 32), pointing to where
  // the actual tuple data starts. Detect and skip this wrapper.
  let hexNo0x = rawHex;
  if (rawHex.length >= 64) {
    const firstWord = BigInt("0x" + rawHex.slice(0, 64));
    if (firstWord === BigInt(32)) {
      hexNo0x = rawHex.slice(64);
    }
  }

  if (hexNo0x.length < types.length * 64) {
    throw new Error("Invalid ABI response length");
  }
  const head: unknown[] = new Array(types.length);
  const dynamicOffsets: Array<{ index: number; offset: bigint }> = [];

  for (let i = 0; i < types.length; i += 1) {
    const t = types[i];
    const word = decodeWord(hexNo0x, i);

    if (t === "address") {
      head[i] = decodeAddressWord(word);
      continue;
    }
    if (t === "bytes32") {
      head[i] = "0x" + word;
      continue;
    }
    if (t === "uint8") {
      head[i] = Number(decodeUint256Word(word));
      continue;
    }
    if (t === "bool") {
      head[i] = decodeBoolWord(word);
      continue;
    }
    if (t === "uint256") {
      head[i] = decodeUint256Word(word);
      continue;
    }
    if (t === "string") {
      dynamicOffsets.push({ index: i, offset: decodeUint256Word(word) });
      continue;
    }
    throw new Error(`Unsupported ABI type: ${t}`);
  }

  for (const dyn of dynamicOffsets) {
    head[dyn.index] = decodeStringAtOffset(hexNo0x, dyn.offset);
  }

  return head;
}


async function jsonRpcRequest(rpcUrl: string, payload: Record<string, unknown>, options?: RequestInit): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...options,
  });
  if (!response.ok) {
    throw new Error(`RPC error (HTTP ${response.status})`);
  }
  return response.json().catch(() => ({}));
}

async function ethCall(params: { rpcUrl: string; to: string; data: string }): Promise<string> {
  async function callWithTimeout(url: string, timeoutMs: number = 2000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log("[RPC] eth_call", { url, to: params.to });
      const result = (await jsonRpcRequest(
        url,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: params.to, data: params.data }, "latest"],
        },
        { signal: controller.signal },
      )) as { result?: unknown };

      clearTimeout(timeoutId);
      const hex = typeof result?.result === "string" ? result.result : "";
      if (hex === "0x") throw new Error("Empty eth_call result");
      if (hex.startsWith("0x")) return hex;
      throw new Error("Invalid RPC response");
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[RPC] timeout", { url, timeoutMs });
        throw new Error(`RPC timeout after ${timeoutMs}ms`);
      }
      console.warn("[RPC] failed", { url });
      throw error;
    }
  }

  const chainKey = Object.keys(CHAIN_CONFIG).find(
    (key) => CHAIN_CONFIG[key as ChainId].rpcUrl === params.rpcUrl,
  ) as ChainId | undefined;

  if (chainKey) {
    const chainConfig = CHAIN_CONFIG[chainKey] as ChainConfig;
    if ("rpcUrls" in chainConfig) {
      const rpcUrls = Array.isArray(chainConfig.rpcUrls)
        ? chainConfig.rpcUrls.filter((u): u is string => typeof u === "string")
        : [];

      for (const rpcUrl of rpcUrls) {
        try {
          return await callWithTimeout(rpcUrl, 2000);
        } catch {
          continue;
        }
      }
    }
  }

  console.log("[RPC] fallback", { url: params.rpcUrl, to: params.to });
  return await callWithTimeout(params.rpcUrl, 2000);
}

export function getChainKeyFromNumericChainId(chainId: number): ChainId | null {
  for (const [key, cfg] of Object.entries(CHAIN_CONFIG)) {
    if (cfg.chainId === chainId) return key as ChainId;
  }
  return null;
}

export async function readBitxenDataRecord(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<{
  owner: string;
  currentDataHash: string;
  currentStorageURI: string;
  currentProvider: string; // Changed from number to string (bytes32)
  createdAt: bigint;
  lastUpdatedAt: bigint;
  commitment: string;
  fileSize: bigint;
  contentType: string;
  fileName: string;
  isPermanent: boolean;
  currentVersion: bigint;
  totalVersions: bigint;
  totalFeePaid: bigint;
  releaseDate: bigint;
  isReleased: boolean;
  releaseEntropy: string;
  encryptedKey?: string;
}> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("getDataRecord(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);
  const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });

  // Try multiple ABI variants (new → v2 → legacy) to handle different contract versions
  const typesNew = [
    "address",  // owner (0)
    "bytes32",  // currentDataHash (1)
    "string",   // currentStorageURI (2)
    "bytes32",  // currentProvider (3) - changed from uint8 to bytes32
    "uint256",  // createdAt (4)
    "uint256",  // lastUpdatedAt (5)
    "bytes32",  // commitment (6) ← key difference vs v2
    "uint256",  // fileSize (7)
    "string",   // contentType (8)
    "string",   // fileName (9)
    "bool",     // isPermanent (10)
    "uint256",  // currentVersion (11)
    "uint256",  // totalVersions (12)
    "uint256",  // totalFeePaid (13)
    "uint256",  // releaseDate (14)
    "bool",     // isReleased (15)
    "bytes32",  // releaseEntropy (16)
  ];

  const typesV2 = [
    "address",  // owner (0)
    "bytes32",  // currentDataHash (1)
    "string",   // currentStorageURI (2)
    "uint8",    // currentProvider (3) - old contracts used uint8
    "uint256",  // createdAt (4)
    "uint256",  // lastUpdatedAt (5)
    "uint256",  // fileSize (6) ← no commitment here
    "string",   // contentType (7)
    "string",   // fileName (8)
    "bool",     // isPermanent (9)
    "uint256",  // currentVersion (10)
    "uint256",  // totalVersions (11)
    "uint256",  // totalFeePaid (12)
    "uint256",  // releaseDate (13)
    "bool",     // isReleased (14)
    "bytes32",  // releaseEntropy (15)
    "string",   // encryptedKey (16)
  ];

  const typesLegacy = [
    "address",  // owner (0)
    "uint8",    // currentProvider (1) - old contracts used uint8
    "uint256",  // createdAt (2)
    "uint256",  // lastUpdatedAt (3)
    "bytes32",  // currentDataHash (4)
    "bytes32",  // commitment (5)
    "string",   // currentStorageURI (6)
    "uint256",  // fileSize (7)
    "string",   // contentType (8)
    "string",   // fileName (9)
    "bool",     // isPermanent (10)
    "uint256",  // currentVersion (11)
    "uint256",  // totalVersions (12)
    "uint256",  // totalFeePaid (13)
    "uint256",  // releaseDate (14)
    "bool",     // isReleased (15)
  ];

  let decoded: unknown[] | null = null;
  let variant: "new" | "v2" | "legacy" = "new";

  for (const candidate of [
    { variant: "new" as const, types: typesNew },
    { variant: "v2" as const, types: typesV2 },
    { variant: "legacy" as const, types: typesLegacy },
  ]) {
    try {
      decoded = decodeAbiTuple(candidate.types, result);
      variant = candidate.variant;
      console.log(`[readBitxenDataRecord] Decoded using variant: ${variant}`);
      break;
    } catch {
      // try next variant
    }
  }

  if (!decoded) {
    throw new Error("Failed to decode getDataRecord response — no ABI variant matched");
  }

  let mapped: {
    owner: string;
    currentDataHash: string;
    currentStorageURI: string;
    currentProvider: string; // Changed from number to string (bytes32)
    createdAt: bigint;
    lastUpdatedAt: bigint;
    commitment: string;
    fileSize: bigint;
    contentType: string;
    fileName: string;
    isPermanent: boolean;
    currentVersion: bigint;
    totalVersions: bigint;
    totalFeePaid: bigint;
    releaseDate: bigint;
    isReleased: boolean;
    releaseEntropy: string;
    encryptedKey?: string;
  };

  if (variant === "new") {
    mapped = {
      owner: decoded[0] as string,
      currentDataHash: decoded[1] as string,
      currentStorageURI: decoded[2] as string,
      currentProvider: decoded[3] as string, // Now bytes32
      createdAt: decoded[4] as bigint,
      lastUpdatedAt: decoded[5] as bigint,
      commitment: decoded[6] as string,
      fileSize: decoded[7] as bigint,
      contentType: decoded[8] as string,
      fileName: decoded[9] as string,
      isPermanent: decoded[10] as boolean,
      currentVersion: decoded[11] as bigint,
      totalVersions: decoded[12] as bigint,
      totalFeePaid: decoded[13] as bigint,
      releaseDate: decoded[14] as bigint,
      isReleased: decoded[15] as boolean,
      releaseEntropy: decoded[16] as string,
    };
  } else if (variant === "v2") {
    mapped = {
      owner: decoded[0] as string,
      currentDataHash: decoded[1] as string,
      currentStorageURI: decoded[2] as string,
      currentProvider: String(decoded[3] as number), // uint8 → string for type consistency
      createdAt: decoded[4] as bigint,
      lastUpdatedAt: decoded[5] as bigint,
      commitment: "0x" + "0".repeat(64),
      fileSize: decoded[6] as bigint,
      contentType: decoded[7] as string,
      fileName: decoded[8] as string,
      isPermanent: decoded[9] as boolean,
      currentVersion: decoded[10] as bigint,
      totalVersions: decoded[11] as bigint,
      totalFeePaid: decoded[12] as bigint,
      releaseDate: decoded[13] as bigint,
      isReleased: decoded[14] as boolean,
      releaseEntropy: decoded[15] as string,
      encryptedKey: decoded[16] as string,
    };
  } else {
    // legacy
    mapped = {
      owner: decoded[0] as string,
      currentProvider: String(decoded[1] as number), // uint8 → string for type consistency
      createdAt: decoded[2] as bigint,
      lastUpdatedAt: decoded[3] as bigint,
      currentDataHash: decoded[4] as string,
      commitment: decoded[5] as string,
      currentStorageURI: decoded[6] as string,
      fileSize: decoded[7] as bigint,
      contentType: decoded[8] as string,
      fileName: decoded[9] as string,
      isPermanent: decoded[10] as boolean,
      currentVersion: decoded[11] as bigint,
      totalVersions: decoded[12] as bigint,
      totalFeePaid: decoded[13] as bigint,
      releaseDate: decoded[14] as bigint,
      isReleased: decoded[15] as boolean,
      releaseEntropy: "0x" + "0".repeat(64),
    };
  }

  // If vault is released, try to get the actual secret via getVaultSecret
  // (this overrides the releaseEntropy from the struct with the real secret)
  if (mapped.isReleased) {
    try {
      const secretSelector = abiSelector("getVaultSecret(bytes32)");
      const secretData = "0x" + secretSelector + encodeBytes32(params.contractDataId);
      const secretHex = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data: secretData });
      if (secretHex && secretHex.startsWith("0x") && secretHex !== "0x" + "0".repeat(64) && secretHex.length >= 66) {
        // Extract bytes32 from response
        const secretRaw = secretHex.startsWith("0x") ? secretHex.slice(2) : secretHex;
        mapped.releaseEntropy = "0x" + secretRaw.slice(0, 64);
        console.log("[readBitxenDataRecord] Got vault secret from getVaultSecret");
      }
    } catch (e) {
      console.warn("[readBitxenDataRecord] getVaultSecret failed (may not be released yet):", e);
    }
  }

  console.log("[readBitxenDataRecord] Result:", {
    isReleased: mapped.isReleased,
    releaseEntropy: mapped.releaseEntropy,
    variant,
  });

  return mapped;
}


export async function getVaultSecret(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<string | null> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("getVaultSecret(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);

  try {
    const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });
    // Returns bytes32
    return result;
  } catch (err) {
    // Likely reverted because not released yet
    console.warn("getVaultSecret failed (likely not released):", err);
    return null;
  }
}

export async function getCommitment(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<string | null> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  // Get commitment from getDataRecord (already includes commitment field)
  try {
    const record = await readBitxenDataRecord({
      chainId: params.chainId,
      contractDataId: params.contractDataId,
      contractAddress: contractAddress
    });
    return record.commitment && record.commitment !== "0x" + "0".repeat(64)
      ? record.commitment
      : null;
  } catch (err) {
    console.warn("getCommitment failed:", err);
    return null;
  }
}

export async function checkDataReleased(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<{ released: boolean; releaseDate: bigint }> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("isDataReleased(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);

  try {
    const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });
    // Returns (bool released, uint256 releaseDate)
    const hexNo0x = result.startsWith("0x") ? result.slice(2) : result;
    if (hexNo0x.length < 128) throw new Error("Invalid isDataReleased response");

    const released = decodeBoolWord(decodeWord(hexNo0x, 0));
    const releaseDate = decodeUint256Word(decodeWord(hexNo0x, 1));

    return { released, releaseDate };
  } catch (err) {
    console.warn("isDataReleased failed:", err);
    return { released: false, releaseDate: BigInt(0) };
  }
}

export async function getReleaseEntropy(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<string | null> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("getReleaseEntropy(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);

  try {
    const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });
    // Returns bytes32
    return result && result !== "0x" + "0".repeat(64) ? result : null;
  } catch (err) {
    console.warn("getReleaseEntropy failed:", err);
    return null;
  }
}

export function extractArweaveTxIdFromStorageUri(storageUri: string): string | null {
  const safe = typeof storageUri === "string" ? storageUri.trim() : "";
  if (!safe) return null;
  if (/^[A-Za-z0-9_-]{43}$/.test(safe)) return safe;
  if (safe.toLowerCase().startsWith("ar://")) {
    const id = safe.slice(5).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
  }
  try {
    const url = new URL(safe);
    const match = url.pathname.match(/[A-Za-z0-9_-]{43}/);
    if (match?.[0]) return match[0];
  } catch {
  }
  const match = safe.match(/[A-Za-z0-9_-]{43}/);
  return match?.[0] || null;
}


// type is defined once, reuse getChainKeyFromNumericChainId from line 374

type BitxenChainDiscovery = {
  chainKey: ChainId;
  contractDataId: string;
  contractAddress?: string;
};

/**
 * Lookup contractDataId by Arweave content hash on-chain.
 */
async function readBitxenDataIdByHash(params: {
  chainId: ChainId;
  dataHash: string;
  version: bigint;
  contractAddress?: string;
}): Promise<string> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("getDataIdByHash(bytes32,uint256)");
  const dataHashHex = params.dataHash.startsWith("0x") ? params.dataHash.slice(2) : params.dataHash;
  const versionHex = params.version.toString(16).padStart(64, "0");
  const data = "0x" + selector + dataHashHex.padStart(64, "0") + versionHex;
  const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });
  const hexNo0x = result.startsWith("0x") ? result.slice(2) : result;
  if (hexNo0x.length < 64) throw new Error("Invalid getDataIdByHash response");
  return ("0x" + hexNo0x.slice(0, 64)).toLowerCase();
}



/**
 * Discover contractDataId + chainKey for a vault from Arweave.
 * Used when user loads vault via UUID (backup file) instead of bytes32 contractDataId.
 *
 * Strategy 1: Query Arweave GraphQL for a "bitxen-index" tagged document.
 * Strategy 2: Fetch vault payload from Arweave and decrypt metadata (contractDataId stored inside).
 * Strategy 3: Hash-based lookup on-chain.
 */
export async function discoverBitxenChainInfo(params: {
  vaultId: string;
  arweaveTxId?: string | null;
  chainKeyHint?: ChainId | null;
  decryptMetadataFn: (encryptedStr: string, vaultId: string) => Promise<Record<string, unknown>>;
}): Promise<BitxenChainDiscovery | null> {
  const safeVaultId = typeof params.vaultId === "string" ? params.vaultId.trim() : "";
  if (!safeVaultId) return null;

  // --- Strategy 1: Arweave GraphQL bitxen-index document ---
  try {
    const gqlResponse = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($vaultId: String!) {
            transactions(
              first: 1
              sort: HEIGHT_DESC
              tags: [
                { name: "Doc-Id", values: [$vaultId] }
                { name: "App-Name", values: ["doc-storage"] }
                { name: "Type", values: ["bitxen-index"] }
              ]
            ) {
              edges { node { id } }
            }
          }
        `,
        variables: { vaultId: safeVaultId },
      }),
    });
    if (gqlResponse.ok) {
      const gql = await gqlResponse.json().catch(() => ({})) as Record<string, unknown>;
      const edges = (gql as { data?: { transactions?: { edges?: Array<{ node?: { id?: string } }> } } })
        ?.data?.transactions?.edges;
      const indexTxId = edges?.[0]?.node?.id;
      if (typeof indexTxId === "string" && indexTxId.trim().length > 0) {
        const indexText = await fetch(`https://arweave.net/${indexTxId.trim()}`)
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
        if (indexText) {
          const indexJson = JSON.parse(indexText) as Record<string, unknown>;
          const bitxenInfo = (indexJson as { bitxen?: Record<string, unknown> })?.bitxen;
          const contractDataIdRaw = bitxenInfo?.contractDataId;
          const contractDataId =
            typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
              ? contractDataIdRaw
              : null;
          const chainKeyRaw = bitxenInfo?.chainKey;
          const numericChainId =
            typeof bitxenInfo?.chainId === "number" ? bitxenInfo.chainId as number : null;
          const inferredChainKey = numericChainId ? getChainKeyFromNumericChainId(numericChainId) : null;
          const chainKey =
            typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
              ? (chainKeyRaw.trim() as ChainId)
              : inferredChainKey;
          const contractAddressRaw = bitxenInfo?.contractAddress;
          const contractAddress =
            typeof contractAddressRaw === "string" &&
              /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
              ? contractAddressRaw.trim()
              : undefined;
          if (contractDataId && chainKey) {
            console.log("[discoverBitxenChainInfo] Found via Arweave index:", { contractDataId, chainKey });
            return { chainKey, contractDataId, contractAddress };
          }
        }
      }
    }
  } catch {
    // ignore, try next strategy
  }

  // --- Strategy 2: Decrypt vault metadata from Arweave payload ---
  const txId = typeof params.arweaveTxId === "string" ? params.arweaveTxId.trim() : "";
  if (txId.length > 0) {
    try {
      const payloadText = await fetch(`https://arweave.net/${txId}`)
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null);
      if (payloadText) {
        const payloadJson = JSON.parse(payloadText) as Record<string, unknown>;
        const encryptedMetadata = payloadJson?.m;
        if (typeof encryptedMetadata === "string" && encryptedMetadata.length > 0) {
          const metadata = await params.decryptMetadataFn(encryptedMetadata, safeVaultId).catch(() => null);
          if (metadata) {
            const contractDataIdRaw = metadata.contractDataId;
            let contractDataId =
              typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
                ? contractDataIdRaw
                : null;
            const chainKeyRaw = metadata.blockchainChain;
            const chainKey =
              typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
                ? (chainKeyRaw.trim() as ChainId)
                : null;
            const contractAddressRaw = metadata.contractAddress;
            const contractAddress =
              typeof contractAddressRaw === "string" &&
                /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
                ? contractAddressRaw.trim()
                : undefined;

            // Strategy 2b: if contractDataId missing, derive from dataHash by scanning all chains + versions
            let resolvedId = contractDataId;
            let resolvedChain = chainKey;
            let resolvedAddr = contractAddress;
            if (!resolvedId) {
              try {
                const encoder = new TextEncoder();
                const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(payloadText));
                const hashHex = Array.from(new Uint8Array(hashBuffer))
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");
                const dataHash = "0x" + hashHex;
                const chainsToTry = resolvedChain
                  ? [resolvedChain]
                  : params.chainKeyHint
                    ? [params.chainKeyHint]
                    : (Object.keys(CHAIN_CONFIG) as ChainId[]);
                outer: for (const tryChain of chainsToTry) {
                  const tryAddress = resolvedAddr ?? CHAIN_CONFIG[tryChain].contractAddress;
                  for (let v = 1; v <= 5; v++) {
                    try {
                      const foundId = await readBitxenDataIdByHash({ chainId: tryChain, dataHash, version: BigInt(v), contractAddress: tryAddress });
                      if (foundId && foundId !== "0x" + "0".repeat(64)) {
                        resolvedId = foundId;
                        resolvedChain = tryChain;
                        resolvedAddr = tryAddress;
                        break outer;
                      }
                    } catch {
                      // version not found, try next
                    }
                  }
                }
              } catch (e) {
                console.warn("[discoverBitxenChainInfo] Hash lookup failed:", e);
              }
            }

            if (resolvedId && resolvedChain) {
              console.log("[discoverBitxenChainInfo] Found via metadata:", { contractDataId: resolvedId, chainKey: resolvedChain });
              return { chainKey: resolvedChain, contractDataId: resolvedId, contractAddress: resolvedAddr };
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // --- Strategy 3: No arweaveTxId provided — query GraphQL for main doc transaction ---
  if (txId.length === 0) {
    try {
      const gqlResp = await fetch("https://arweave.net/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query ($vaultId: String!) {
              transactions(
                first: 1
                sort: HEIGHT_DESC
                tags: [
                  { name: "Doc-Id", values: [$vaultId] }
                  { name: "App-Name", values: ["doc-storage"] }
                  { name: "Type", values: ["doc"] }
                ]
              ) {
                edges { node { id } }
              }
            }
          `,
          variables: { vaultId: safeVaultId },
        }),
      });
      if (gqlResp.ok) {
        const gql = await gqlResp.json().catch(() => ({})) as Record<string, unknown>;
        const edges = (gql as { data?: { transactions?: { edges?: Array<{ node?: { id?: string } }> } } })
          ?.data?.transactions?.edges;
        const docTxId = edges?.[0]?.node?.id;
        if (typeof docTxId === "string" && docTxId.trim().length > 0) {
          const payloadText = await fetch(`https://arweave.net/${docTxId.trim()}`)
            .then((r) => (r.ok ? r.text() : null))
            .catch(() => null);
          if (payloadText) {
            const payloadJson = JSON.parse(payloadText) as Record<string, unknown>;
            const encryptedMetadata = payloadJson?.m;
            if (typeof encryptedMetadata === "string" && encryptedMetadata.length > 0) {
              const metadata = await params.decryptMetadataFn(encryptedMetadata, safeVaultId).catch(() => null);
              if (metadata) {
                const contractDataIdRaw = metadata.contractDataId;
                let resolvedId3 =
                  typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
                    ? contractDataIdRaw
                    : null;
                const chainKeyRaw = metadata.blockchainChain;
                let resolvedChain3 =
                  typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
                    ? (chainKeyRaw.trim() as ChainId)
                    : params.chainKeyHint ?? null;
                const contractAddressRaw = metadata.contractAddress;
                let resolvedAddr3 =
                  typeof contractAddressRaw === "string" &&
                    /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
                    ? contractAddressRaw.trim()
                    : undefined;

                if (!resolvedId3) {
                  try {
                    const encoder = new TextEncoder();
                    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(payloadText));
                    const hashHex = Array.from(new Uint8Array(hashBuffer))
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join("");
                    const dataHash = "0x" + hashHex;
                    const chainsToTry = resolvedChain3
                      ? [resolvedChain3]
                      : (Object.keys(CHAIN_CONFIG) as ChainId[]);
                    outer3: for (const tryChain of chainsToTry) {
                      const tryAddress = resolvedAddr3 ?? CHAIN_CONFIG[tryChain].contractAddress;
                      for (let v = 1; v <= 5; v++) {
                        try {
                          const foundId = await readBitxenDataIdByHash({ chainId: tryChain, dataHash, version: BigInt(v), contractAddress: tryAddress });
                          if (foundId && foundId !== "0x" + "0".repeat(64)) {
                            resolvedId3 = foundId;
                            resolvedChain3 = tryChain;
                            resolvedAddr3 = tryAddress;
                            break outer3;
                          }
                        } catch {
                          // try next
                        }
                      }
                    }
                  } catch (e) {
                    console.warn("[discoverBitxenChainInfo] Strategy 3 hash lookup failed:", e);
                  }
                }

                if (resolvedId3 && resolvedChain3) {
                  console.log("[discoverBitxenChainInfo] Found via Strategy 3:", { contractDataId: resolvedId3, chainKey: resolvedChain3 });
                  return { chainKey: resolvedChain3, contractDataId: resolvedId3, contractAddress: resolvedAddr3 };
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  console.warn("[discoverBitxenChainInfo] Could not discover chain info for vault:", safeVaultId);
  return null;
}


/**
 * Connect to MetaMask wallet
 * @returns Connected wallet address
 */
export async function connectMetaMask(): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (typeof window === "undefined" || !ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  try {
    const accounts = (await ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please connect your MetaMask wallet.");
    }

    return accounts[0];
  } catch (error) {
    if ((error as { code?: number }).code === 4001) {
      throw new Error("Connection request was rejected. Please try again.");
    }
    throw new Error(
      `Failed to connect MetaMask: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get current chain ID from MetaMask
 */
export async function getCurrentChainId(): Promise<number | null> {
  const ethereum = (window as any).ethereum;
  if (typeof window === "undefined" || !ethereum) return null;

  try {
    const chainIdHex = await ethereum.request({ method: "eth_chainId" });
    return parseInt(chainIdHex as string, 16);
  } catch {
    return null;
  }
}

/**
 * Switch MetaMask to specified chain
 */
export async function switchToChain(chainId: ChainId): Promise<void> {
  const ethereum = (window as any).ethereum;
  if (typeof window === "undefined" || !ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const config = CHAIN_CONFIG[chainId];

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainIdHex }],
    });
  } catch (error) {
    // Chain not added, try to add it
    if ((error as { code?: number }).code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: config.chainIdHex,
              chainName: config.name,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: (config as any).rpcUrls || [config.rpcUrl],
              blockExplorerUrls: [config.blockExplorer],
            },
          ],
        });
      } catch (addError) {
        throw new Error(
          `Failed to add ${config.name} network: ${addError instanceof Error ? addError.message : "Unknown error"}`
        );
      }
    } else if ((error as { code?: number }).code === 4001) {
      throw new Error("Network switch was rejected. Please try again.");
    } else {
      throw new Error(
        `Failed to switch to ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

/**
 * Finalize release on blockchain
 */
export async function finalizeRelease(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (typeof window === "undefined" || !ethereum) {
    throw new Error("MetaMask not installed");
  }

  const config = CHAIN_CONFIG[params.chainId];
  const targetAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const userAddress = await connectMetaMask();
  const currentChainId = await getCurrentChainId();

  if (currentChainId !== config.chainId) {
    await switchToChain(params.chainId);
  }

  const selector = abiSelector("finalizeRelease(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);

  const txHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        to: targetAddress,
        from: userAddress,
        data,
      },
    ],
  })) as string;

  return txHash;
}

/**
 * Wait for a transaction to be mined by polling eth_getTransactionReceipt.
 * Returns the receipt once confirmed.
 */
export async function waitForTransaction(
  txHash: string,
  chainId: ChainId,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<{ status: boolean; blockNumber: string }> {
  const config = CHAIN_CONFIG[chainId];
  const rpcUrl = config.rpcUrl;
  const timeout = options?.timeoutMs ?? 120_000;
  const interval = options?.intervalMs ?? 3_000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const result = (await jsonRpcRequest(rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      })) as { result?: { status?: string; blockNumber?: string } | null };

      if (result?.result) {
        return {
          status: result.result.status === "0x1",
          blockNumber: result.result.blockNumber ?? "0x0",
        };
      }
    } catch {
      // ignore, retry
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("Transaction confirmation timed out. Please check your wallet for the transaction status.");
}

/**
 * Check if MetaMask (window.ethereum) is available in the current context.
 * In Chrome extension popups, MetaMask may not inject window.ethereum.
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}

/**
 * Open the extension page in a full browser tab where MetaMask can inject.
 * Passes finalization parameters via URL hash so the full-tab page can auto-resume.
 */
export function openExtensionInTab(): void {
  const popupUrl = chrome.runtime.getURL("popup.html");
  chrome.tabs.create({ url: popupUrl });
}
