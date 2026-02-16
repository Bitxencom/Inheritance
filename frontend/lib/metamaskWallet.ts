// MetaMask Wallet integration library for Bitxen blockchain storage
// Supports multiple chains: BSC, Ethereum, Poly, Base, Arbitrum
//
// USAGE:
// - connectMetaMask() -> connects wallet and returns address
// - switchToChain(chainId) -> switches MetaMask to specified chain
// - dispatchToBitxen(data, vaultId, chainId) -> stores data on blockchain
//
// NOTE: Uses native window.ethereum API (no ethers dependency required)

import { keccak_256 } from "@noble/hashes/sha3.js";

// Chain configurations with Bitxen contract addresses
export const CHAIN_CONFIG = {
  // BSC Testnet - for development testing
  // Get free tBNB from: https://www.bnbchain.org/en/testnet-faucet
  // Contract verified: BITXEN token with custom registration functions

  // BSC Testnet Only for Testing
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
      "https://bsc-testnet.public.blastapi.io/"
    ],
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    blockExplorer: "https://testnet.bscscan.com",
    contractAddress: "0xE9a33420eF860bAE14e41a47f37e2D632D4A7bE7",
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
      "https://bsc-dataseed4.binance.org/"
    ],
    rpcUrl: "https://bsc-dataseed.binance.org/",
    blockExplorer: "https://bscscan.com",
    contractAddress: "0x42936dAEC40CAC532b032eE8119c3f86548c19B4",
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
    contractAddress: "0xa5e79731386f70ac4165cd9beb63a4876097ad8a",
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
    contractAddress: "0x8c7D96de6a5E7734E9E300e0F4D6C02e348ddf31",
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
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
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
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
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
  logo: string;
  isTestnet: boolean;
}

interface ChainConfigWithFallbacks extends ChainConfigBase {
  rpcUrls: string[];
}

type ChainConfig = ChainConfigBase | ChainConfigWithFallbacks;

export type ChainId = keyof typeof CHAIN_CONFIG;

// Default chain for Bitxen
export const DEFAULT_CHAIN: ChainId = "bsc";

// Get list of available chains
export function getAvailableChains(): ChainId[] {
  const chains = Object.keys(CHAIN_CONFIG) as ChainId[];
  // Temporary disable
  // if (process.env.NODE_ENV === "production") {
  //   return chains.filter((chainId) => chainId !== "bscTestnet");
  // }
  return chains;
}

// Get chain config by ID
export function getChainConfig(chainId: ChainId) {
  return CHAIN_CONFIG[chainId];
}

/**
 * Check if MetaMask is installed
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.ethereum !== "undefined" &&
    window.ethereum.isMetaMask === true
  );
}

/**
 * Connect to MetaMask wallet
 * @returns Connected wallet address
 */
export async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask to continue.",
    );
  }

  try {
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error(
        "No accounts found. Please connect your MetaMask wallet.",
      );
    }

    return accounts[0];
  } catch (error) {
    if ((error as { code?: number }).code === 4001) {
      throw new Error("Connection request was rejected. Please try again.");
    }
    throw new Error(
      `Failed to connect MetaMask: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get currently connected address
 */
export async function getConnectedAddress(): Promise<string | null> {
  if (!isMetaMaskInstalled() || !window.ethereum) return null;

  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];
    return accounts[0] || null;
  } catch {
    return null;
  }
}

/**
 * Get current chain ID from MetaMask
 */
export async function getCurrentChainId(): Promise<number | null> {
  if (!isMetaMaskInstalled() || !window.ethereum) return null;

  try {
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    return parseInt(chainIdHex as string, 16);
  } catch {
    return null;
  }
}

/**
 * Switch MetaMask to specified chain
 * Will add the chain if not already in MetaMask
 */
export async function switchToChain(chainId: ChainId): Promise<void> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const config = CHAIN_CONFIG[chainId];

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainIdHex }],
    });
  } catch (error) {
    // Chain not added, try to add it
    if ((error as { code?: number }).code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: config.chainIdHex,
              chainName: config.name,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: [config.rpcUrl],
              blockExplorerUrls: [config.blockExplorer],
            },
          ],
        });
      } catch (addError) {
        throw new Error(
          `Failed to add ${config.name} network: ${addError instanceof Error ? addError.message : "Unknown error"}`,
        );
      }
    } else if ((error as { code?: number }).code === 4001) {
      throw new Error("Network switch was rejected. Please try again.");
    } else {
      throw new Error(
        `Failed to switch to ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Dispatch result from blockchain transaction
 */
export interface DispatchResult {
  txHash: string;
  chainId: ChainId;
  blockExplorerUrl: string;
  dataId?: string; // The data ID returned from registerData
}

/**
 * Hybrid dispatch result (Arweave storage + Bitxen contract registry)
 */
export interface HybridDispatchResult {
  arweaveTxId: string; // Arweave transaction ID where data is stored
  contractTxHash: string; // Bitxen contract transaction hash
  contractDataId: string; // Data ID from contract (dataId)
  chainId: ChainId;
  chainNumericId: number;
  contractAddress: string;
  blockExplorerUrl: string;
  arweaveUrl: string; // Direct link to Arweave data
}

export type HybridDispatchOptions = {
  isPermanent?: boolean;
  releaseDate?: bigint;
  encryptedKey?: string;
  onProgress?: (status: string) => void;
  onUploadProgress?: (progress: number) => void;
  contractDataId?: string;
  contractAddress?: string;
};

/**
 * Bitxen Contract ABI (partial - only functions we need)
 */
const BITXEN_ABI = {
  // Registration fee getter
  registrationFee: {
    name: "registrationFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Register data function
  registerData: {
    name: "registerData",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "dataHash", type: "bytes32" },
          { name: "storageURI", type: "string" },
          { name: "provider", type: "uint8" }, // 0=IPFS, 1=ARWEAVE, 2=CUSTOM
          { name: "fileSize", type: "uint256" },
          { name: "contentType", type: "string" },
          { name: "fileName", type: "string" },
          { name: "isPermanent", type: "bool" },
          { name: "releaseDate", type: "uint256" },
          { name: "encryptedKey", type: "string" },
        ],
      },
    ],
  },
};

/**
 * Encode function call for registerData
 */
export function encodeRegisterData(
  dataHash: string,
  storageURI: string,
  provider: number,
  fileSize: bigint,
  contentType: string,
  fileName: string,
  isPermanent: boolean,
  releaseDate: bigint,
  encryptedKey: string,
): string {
  // Function selector: keccak256("registerData((bytes32,string,uint8,uint256,string,string,bool,uint256,string))")[0:4]
  // Correct Selector for V2 Contract: 0x822d01b4
  const selector = "822d01b4";

  // Helper for string encoding with length prefix
  const encodeStringToBytes = (
    str: string,
  ): { offset: string; data: string } => {
    const bytes = new TextEncoder().encode(str);
    const length = bytes.length;
    const lengthHex = length.toString(16).padStart(64, "0");
    const dataHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Pad to 32-byte boundary
    // 32 bytes = 64 hex chars
    const paddedData = dataHex.padEnd(Math.ceil(length / 32) * 64, "0");
    return { offset: "", data: lengthHex + paddedData };
  };

  // dataHash (bytes32 - 32 bytes)
  const encodedDataHash = dataHash.startsWith("0x")
    ? dataHash.slice(2).padStart(64, "0")
    : dataHash.padStart(64, "0");

  // Tuple offset (starts at 32 bytes = 0x20)
  const tupleOffset =
    "0000000000000000000000000000000000000000000000000000000000000020";

  // Static fields in order: dataHash, provider, fileSize, isPermanent, releaseDate
  // Dynamic fields: storageURI, contentType, fileName, encryptedKey

  // Encode static parts
  const encodedProvider = provider.toString(16).padStart(64, "0");
  const encodedFileSize = fileSize.toString(16).padStart(64, "0");
  const encodedIsPermanent = (isPermanent ? 1 : 0)
    .toString(16)
    .padStart(64, "0");
  const encodedReleaseDate = releaseDate.toString(16).padStart(64, "0");

  // Calculate offsets for dynamic data
  // Position after all static fields (9 * 32 = 288 bytes = 0x120)
  const dynamicStart = 9 * 32;
  let currentOffset = dynamicStart;

  // Encode all strings
  const storageURIData = encodeStringToBytes(storageURI);
  const contentTypeData = encodeStringToBytes(contentType);
  const fileNameData = encodeStringToBytes(fileName);
  const encryptedKeyData = encodeStringToBytes(encryptedKey);

  // Calculate actual offsets
  const storageURIOffset = currentOffset;
  currentOffset +=
    32 + Math.ceil(new TextEncoder().encode(storageURI).length / 32) * 32;
  const contentTypeOffset = currentOffset;
  currentOffset +=
    32 + Math.ceil(new TextEncoder().encode(contentType).length / 32) * 32;
  const fileNameOffset = currentOffset;
  currentOffset +=
    32 + Math.ceil(new TextEncoder().encode(fileName).length / 32) * 32;
  const encryptedKeyOffset = currentOffset;

  // Build the full encoded data
  // Order in tuple: dataHash, storageURI(offset), provider, fileSize, contentType(offset),
  //                 fileName(offset), isPermanent, releaseDate, encryptedKey(offset)
  const encodedParams =
    tupleOffset +
    encodedDataHash +
    storageURIOffset.toString(16).padStart(64, "0") +
    encodedProvider +
    encodedFileSize +
    contentTypeOffset.toString(16).padStart(64, "0") +
    fileNameOffset.toString(16).padStart(64, "0") +
    encodedIsPermanent +
    encodedReleaseDate +
    encryptedKeyOffset.toString(16).padStart(64, "0") +
    storageURIData.data +
    contentTypeData.data +
    fileNameData.data +
    encryptedKeyData.data;

  return "0x" + selector + encodedParams;
}

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

function pad32Hex(hexNo0x: string): string {
  return hexNo0x.replace(/^0x/i, "").padStart(64, "0");
}

function encodeBytes32(value: string): string {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length !== 64) {
    throw new Error("Invalid bytes32 length");
  }
  return normalized.toLowerCase();
}

function encodeUint256(value: bigint): string {
  if (value < BigInt(0)) throw new Error("uint256 must be >= 0");
  return value.toString(16).padStart(64, "0");
}

function encodeUint8(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error("uint8 out of range");
  }
  return value.toString(16).padStart(64, "0");
}

export function encodeUpdateData(
  dataId: string,
  newDataHash: string,
  newStorageURI: string,
  newProvider: number,
  newFileSize: bigint,
): string {
  const selector = abiSelector("updateData(bytes32,bytes32,string,uint8,uint256)");

  const headWords = BigInt(5);
  const stringOffsetBytes = headWords * BigInt(32);

  const uriBytes = new TextEncoder().encode(newStorageURI);
  const uriLen = BigInt(uriBytes.length);
  const uriHex = bytesToHex(uriBytes);
  const uriPadBytes = (32 - (uriBytes.length % 32)) % 32;
  const uriPaddedHex = uriHex + "0".repeat(uriPadBytes * 2);

  const head =
    encodeBytes32(dataId) +
    encodeBytes32(newDataHash) +
    encodeUint256(stringOffsetBytes) +
    encodeUint8(newProvider) +
    encodeUint256(newFileSize);

  const tail = encodeUint256(uriLen) + uriPaddedHex;

  return "0x" + selector + head + tail;
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
  const hexNo0x = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
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

type BitxenDataRecordRead = {
  owner: string;
  currentDataHash: string;
  currentStorageURI: string;
  currentProvider: number;
  createdAt: bigint;
  lastUpdatedAt: bigint;
  fileSize: bigint;
  contentType: string;
  fileName: string;
  isPermanent: boolean;
  currentVersion: bigint;
  totalVersions: bigint;
  totalFeePaid: bigint;
  releaseDate: bigint;
  isReleased: boolean;
  encryptedKey: string;
};

async function jsonRpcRequest(rpcUrl: string, payload: Record<string, unknown>, options?: RequestInit): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...options
  });
  if (!response.ok) {
    throw new Error(`RPC error (HTTP ${response.status})`);
  }
  return response.json().catch(() => ({}));
}

async function ethCall(params: { rpcUrl: string; to: string; data: string }): Promise<string> {
  // Helper function untuk RPC call dengan timeout
  async function callWithTimeout(url: string, timeoutMs: number = 2000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = (await jsonRpcRequest(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: params.to, data: params.data }, "latest"],
      }, { signal: controller.signal })) as { result?: unknown };

      clearTimeout(timeoutId);
      const hex = typeof result?.result === "string" ? result.result : "";
      if (hex === "0x") throw new Error("Empty eth_call result");
      if (hex.startsWith("0x")) return hex;
      throw new Error("Invalid RPC response");
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`RPC timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  // Fallback ke multiple RPC URLs
  const chainKey = Object.keys(CHAIN_CONFIG).find(key => 
    CHAIN_CONFIG[key as ChainId].rpcUrl === params.rpcUrl
  ) as ChainId;
  
  const chainConfig = CHAIN_CONFIG[chainKey];
  if (chainConfig && 'rpcUrls' in chainConfig) {
    const rpcUrlsRaw = (chainConfig as { rpcUrls?: unknown }).rpcUrls;
    const rpcUrls = Array.isArray(rpcUrlsRaw) ? rpcUrlsRaw.filter((u): u is string => typeof u === "string") : [];
    
    // Coba semua RPC URLs secara berurutan
    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`🔄 Trying RPC: ${rpcUrl}`);
        return await callWithTimeout(rpcUrl, 2000);
      } catch (error) {
        console.warn(`❌ RPC Failed: ${rpcUrl}`, error);
        continue; // Coba RPC berikutnya
      }
    }
    
    // Jika semua RPC gagal, coba MetaMask
    console.log("🔄 All RPCs failed, trying MetaMask...");
  }

  // Fallback ke MetaMask atau RPC asli
  if (window.ethereum) {
    try {
      const hex = (await window.ethereum.request({
        method: "eth_call",
        params: [{ to: params.to, data: params.data }, "latest"],
      })) as string;
      if (hex === "0x") throw new Error("Empty eth_call result");
      if (typeof hex === "string" && hex.startsWith("0x")) return hex;
    } catch (error) {
      console.warn("❌ MetaMask failed:", error);
    }
  }

  throw new Error(`Unable to read from chain. All RPC endpoints failed.`);
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
}): Promise<BitxenDataRecordRead> {
  const config = CHAIN_CONFIG[params.chainId];
  const contractAddress =
    typeof params.contractAddress === "string" && params.contractAddress.trim().length > 0
      ? params.contractAddress.trim()
      : config.contractAddress;

  const selector = abiSelector("getDataRecord(bytes32)");
  const data = "0x" + selector + encodeBytes32(params.contractDataId);
  const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });

  const types = [
    "address",
    "bytes32",
    "string",
    "uint8",
    "uint256",
    "uint256",
    "uint256",
    "string",
    "string",
    "bool",
    "uint256",
    "uint256",
    "uint256",
    "uint256",
    "bool",
    "string",
  ];
  const decoded = decodeAbiTuple(types, result);

  return {
    owner: decoded[0] as string,
    currentDataHash: decoded[1] as string,
    currentStorageURI: decoded[2] as string,
    currentProvider: decoded[3] as number,
    createdAt: decoded[4] as bigint,
    lastUpdatedAt: decoded[5] as bigint,
    fileSize: decoded[6] as bigint,
    contentType: decoded[7] as string,
    fileName: decoded[8] as string,
    isPermanent: decoded[9] as boolean,
    currentVersion: decoded[10] as bigint,
    totalVersions: decoded[11] as bigint,
    totalFeePaid: decoded[12] as bigint,
    releaseDate: decoded[13] as bigint,
    isReleased: decoded[14] as boolean,
    encryptedKey: decoded[15] as string,
  };
}

export async function readBitxenDataIdByHash(params: {
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
  const data = "0x" + selector + encodeBytes32(params.dataHash) + encodeUint256(params.version);
  const result = await ethCall({ rpcUrl: config.rpcUrl, to: contractAddress, data });

  const hexNo0x = result.startsWith("0x") ? result.slice(2) : result;
  if (hexNo0x.length < 64) {
    throw new Error("Invalid getDataIdByHash response");
  }
  return ("0x" + hexNo0x.slice(0, 64)).toLowerCase();
}

/**
 * Hash data using SHA-256 (returns bytes32 format)
 */
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get registration fee from contract
 * Returns fee in wei (as bigint)
 */
export async function getRegistrationFee(
  chainId: ChainId = DEFAULT_CHAIN,
  isPermanent: boolean = false,
): Promise<bigint> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const config = CHAIN_CONFIG[chainId];

  // Call registrationFee() on the contract
  const data = "0x14c44e09"; // keccak256("registrationFee()")[0:4]

  try {
    const result = (await window.ethereum.request({
      method: "eth_call",
      params: [
        {
          to: config.contractAddress,
          data: data,
        },
        "latest",
      ],
    })) as string;

    // Handle empty or invalid result
    if (!result || result === "0x" || result.length < 3) {
      console.warn("Empty result from registrationFee, using fallback");
      const fallbackFee = BigInt("1000000000000000000"); // 1 token
      return isPermanent ? fallbackFee * BigInt(10) : fallbackFee;
    }

    const baseFee = BigInt(result);
    // Permanent storage costs 10x
    return isPermanent ? baseFee * BigInt(10) : baseFee;
  } catch (error) {
    console.error("Error fetching registration fee:", error);
    // Fallback to 1 BITXEN (10^18 wei)
    const oneToken = BigInt(10) ** BigInt(18);
    return isPermanent ? BigInt(10) * oneToken : oneToken;
  }
}

/**
 * Format BITXEN token amount for display
 * @param amount Amount in wei (smallest unit)
 * @returns Formatted string with BITXEN suffix
 */
export function formatBitxenAmount(amount: bigint): string {
  const decimals = 18;
  const value = Number(amount) / Math.pow(10, decimals);
  return `${value.toFixed(2)} BITXEN`;
}

/**
 * Dispatch data to Bitxen blockchain using the proper smart contract interface
 *
 * Flow:
 * 1. Switch to correct chain
 * 2. Approve BITXEN token spending
 * 3. Call registerData() on the contract
 *
 * @param data - The data to store (will be JSON stringified)
 * @param vaultId - Unique vault identifier
 * @param chainId - Which chain to use (default: bsc)
 * @param isPermanent - Whether storage is permanent (costs 10x more)
 */

/**
 * Dispatch data using hybrid storage: Arweave for content + Bitxen contract for registry
 *
 * Flow:
 * 1. Upload encrypted vault to Arweave (via Wander wallet)
 * 2. Register metadata in Bitxen contract (via MetaMask) with ar:// URI
 *
 * @param arweavePayload - The payload to store on Arweave
 * @param vaultId - Unique vault identifier
 * @param chainId - Which EVM chain to use for contract (default: bsc)
 * @param isPermanent - Whether storage is permanent (costs more in contract)
 */
export async function dispatchHybrid(
  arweavePayload: unknown,
  vaultId: string,
  chainId: ChainId = DEFAULT_CHAIN,
  options: HybridDispatchOptions = {},
): Promise<HybridDispatchResult> {
  const isPermanent = options.isPermanent === true;
  const releaseDate = typeof options.releaseDate === "bigint" ? options.releaseDate : BigInt(0);
  const encryptedKey = typeof options.encryptedKey === "string" ? options.encryptedKey : "";
  const onProgress = options.onProgress;
  const onUploadProgress = options.onUploadProgress;
  const existingContractDataId =
    typeof options.contractDataId === "string" && options.contractDataId.startsWith("0x")
      ? options.contractDataId
      : null;

  // Step 1: Upload to Arweave via Wander Wallet
  console.log("📤 Step 1/2: Uploading to Arweave...");

  const {
    dispatchToArweave,
    isWalletReady: isWanderReady,
    connectWanderWallet,
  } = await import("@/lib/wanderWallet");

  if (!(await isWanderReady())) {
    console.log("Wander Wallet not connected, initiating connection...");
    await connectWanderWallet();
  }

  if (onProgress) onProgress("Step 1/2: Confirm in Wander (Arweave)...");
  const arweaveResult = await dispatchToArweave(
    arweavePayload,
    vaultId,
    undefined,
    (progress) => {
      onUploadProgress?.(progress);
    },
    (status) => {
      if (onProgress) onProgress(`Step 1/2: ${status}`);
    },
  );
  const arweaveTxId = arweaveResult.txId;

  console.log(`✅ Arweave upload complete: ${arweaveTxId}`);

  // Step 2: Register in Bitxen Contract via MetaMask
  console.log("📝 Step 2/2: Registering in Bitxen contract...");
  if (onProgress) onProgress("Step 2/2: Confirm in MetaMask (Registering)...");

  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install MetaMask to continue.",
    );
  }

  const config = CHAIN_CONFIG[chainId];
  const contractAddress =
    typeof options.contractAddress === "string" && options.contractAddress.trim().length > 0
      ? options.contractAddress.trim()
      : config.contractAddress;

  // Ensure we're on the correct chain
  const currentChainId = await getCurrentChainId();
  if (currentChainId !== config.chainId) {
    await switchToChain(chainId);
  }

  // Get connected account
  const accounts = (await window.ethereum.request({
    method: "eth_accounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error(
      "No MetaMask wallet connected. Please connect MetaMask first.",
    );
  }
  const fromAddress = accounts[0];

  try {
    // Prepare data hash
    const payloadString = JSON.stringify(arweavePayload);
    const dataHash = await hashData(payloadString);
    const fileSize = BigInt(new TextEncoder().encode(payloadString).length);

    // Get the required fee
    const fee = await getRegistrationFee(chainId, isPermanent);
    console.log(`📝 Registration fee: ${formatBitxenAmount(fee)}`);

    // Register with ar:// URI pointing to Arweave
    const storageURI = `ar://${arweaveTxId}`;

    const txData = existingContractDataId
      ? encodeUpdateData(
          existingContractDataId,
          dataHash,
          storageURI,
          1,
          fileSize,
        )
      : encodeRegisterData(
          dataHash,
          storageURI,
          1,
          fileSize,
          "application/json",
          `vault-${vaultId}.json`,
          isPermanent,
          releaseDate,
          encryptedKey,
        );

    const registerTxHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: contractAddress,
          data: txData,
          gas: "0x1E8480", // 2,000,000 Gas Limit (Manual override for estimation issues)
        },
      ],
    })) as string;

    console.log(`✅ Contract registration tx sent: ${registerTxHash}`);
    const receipt = await waitForTransaction(registerTxHash);
    const contractDataId =
      existingContractDataId ||
      extractRegisteredDataIdFromReceipt(receipt, contractAddress) ||
      dataHash;
    console.log(`✅ Hybrid storage complete!`);

    return {
      arweaveTxId,
      contractTxHash: registerTxHash,
      contractDataId,
      chainId,
      chainNumericId: config.chainId,
      contractAddress,
      blockExplorerUrl: `${config.blockExplorer}/tx/${registerTxHash}`,
      arweaveUrl: `https://arweave.net/${arweaveTxId}`,
    };
  } catch (error) {
    console.error("Hybrid dispatch error:", error);

    if ((error as { code?: number }).code === 4001) {
      throw new Error("Transaction was rejected. Please try again.");
    }

    throw new Error(
      `Failed hybrid storage: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Wait for transaction to be mined
 */
async function waitForTransaction(
  txHash: string,
  maxAttempts = 30,
): Promise<unknown | null> {
  if (!window.ethereum) return null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });

      if (receipt) {
        return receipt; // Transaction confirmed
      }
    } catch {
      // Ignore errors, keep polling
    }

    // Wait 2 seconds before next attempt
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Transaction not confirmed after max attempts, but still submitted
  console.warn(
    "Transaction submitted but not yet confirmed. It may take a few minutes.",
  );

  return null;
}

function extractRegisteredDataIdFromReceipt(
  receipt: unknown,
  contractAddress: string,
): string | null {
  if (!receipt || typeof receipt !== "object") return null;
  const receiptAny = receipt as { logs?: unknown };
  const logs = receiptAny.logs;
  if (!Array.isArray(logs)) return null;

  const target = contractAddress.toLowerCase();
  for (const log of logs) {
    if (!log || typeof log !== "object") continue;
    const entry = log as { address?: unknown; topics?: unknown; data?: unknown };
    if (typeof entry.address !== "string") continue;
    if (entry.address.toLowerCase() !== target) continue;
    if (typeof entry.data !== "string" || entry.data.length <= 66) continue;
    if (!Array.isArray(entry.topics) || entry.topics.length < 2) continue;
    const dataId = entry.topics[1];
    if (typeof dataId === "string" && dataId.startsWith("0x") && dataId.length === 66) {
      return dataId;
    }
  }

  return null;
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if wallet is connected and ready
 */
export async function isWalletReady(): Promise<boolean> {
  const address = await getConnectedAddress();
  return !!address;
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}
