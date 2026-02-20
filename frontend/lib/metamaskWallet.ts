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
      "https://bsc-testnet-rpc.publicnode.com/"
    ],
    rpcUrl: "https://data-seed-prebsc-2-s1.bnbchain.org:8545/",
    blockExplorer: "https://testnet.bscscan.com",
    contractAddress: "0xE157bf1FFe263BF8115d94ebCFe6e27e69a4011E",
    governorAddress: "0x0a8c69742dD248820A019E3606c3F6740a7b5311",
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
  governorAddress?: string;
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
  commitment?: string;
  secret?: string;
  onProgress?: (status: string) => void;
  onUploadProgress?: (progress: number) => void;
  contractDataId?: string;
  contractAddress?: string;
};

/**
 * Custom error thrown when user's BITXEN balance is insufficient to pay the fee.
 * Frontend can catch this specific error to show an informative UI.
 */
export class InsufficientBitxenError extends Error {
  public readonly required: bigint;
  public readonly balance: bigint;
  public readonly shortfall: bigint;
  public readonly chainId: ChainId;

  constructor(params: { required: bigint; balance: bigint; chainId: ChainId }) {
    const fmt = (n: bigint) => (Number(n) / 1e18).toFixed(2);
    super(
      `Insufficient BITXEN balance. Required: ${fmt(params.required)} BITXEN, ` +
      `Current: ${fmt(params.balance)} BITXEN, ` +
      `Shortfall: ${fmt(params.required - params.balance)} BITXEN.`
    );
    this.name = "InsufficientBitxenError";
    this.required = params.required;
    this.balance = params.balance;
    this.shortfall = params.required - params.balance;
    this.chainId = params.chainId;
  }
}

/**
 * Bitxen Contract ABI (partial - only functions we need)
 */
const BITXEN_ABI = {
  // Calculate Fee getter
  calculateFee: {
    name: "calculateFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  registerData: {
    name: "registerData",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "dataHash", type: "bytes32" },
          { name: "storageURI", type: "string" },
          { name: "provider", type: "bytes32" }, // Changed to bytes32 (was uint8)
          { name: "fileSize", type: "uint256" },
          { name: "contentType", type: "string" },
          { name: "fileName", type: "string" },
          { name: "isPermanent", type: "bool" },
          { name: "releaseDate", type: "uint256" },
          { name: "commitment", type: "bytes32" },
          { name: "secret", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "dataId", type: "bytes32" }],
  },
  updateData: {
    name: "updateData",
    inputs: [
      { name: "dataId", type: "bytes32" },
      { name: "newDataHash", type: "bytes32" },
      { name: "newStorageURI", type: "string" },
      { name: "newProvider", type: "bytes32" }, // Changed to bytes32
      { name: "newFileSize", type: "uint256" },
    ],
    outputs: [{ name: "newVersion", type: "uint256" }],
  },
  finalizeRelease: {
    name: "finalizeRelease",
    inputs: [{ name: "dataId", type: "bytes32" }],
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
  commitment: string,
  secret: string,
): string {
  // Function selector: keccak256("registerData((bytes32,string,bytes32,uint256,string,string,bool,uint256,bytes32,bytes32))")[0:4]
  const selector = abiSelector("registerData((bytes32,string,bytes32,uint256,string,string,bool,uint256,bytes32,bytes32))");

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

  // Static fields: dataHash, provider, fileSize, isPermanent, releaseDate, commitment, secret
  // Dynamic fields: storageURI, contentType, fileName

  const encodedProvider = provider.toString(16).padStart(64, "0");
  const encodedFileSize = fileSize.toString(16).padStart(64, "0");
  const encodedIsPermanent = (isPermanent ? 1 : 0)
    .toString(16)
    .padStart(64, "0");
  const encodedReleaseDate = releaseDate.toString(16).padStart(64, "0");
  const encodedCommitment = encodeBytes32(commitment);
  const encodedSecret = encodeBytes32(secret);

  // 10 fields total.
  // Static parts:
  // 1. dataHash (inline)
  // 2. storageURI (offset) -> Dynamic
  // 3. provider (inline)
  // 4. fileSize (inline)
  // 5. contentType (offset) -> Dynamic
  // 6. fileName (offset) -> Dynamic
  // 7. isPermanent (inline)
  // 8. releaseDate (inline)
  // 9. commitment (inline)
  // 10. secret (inline)

  // Total static size = 10 * 32 = 320 bytes = 0x140
  const dynamicStart = 10 * 32;
  let currentOffset = dynamicStart;

  // Encode strings
  const storageURIData = encodeStringToBytes(storageURI);
  const contentTypeData = encodeStringToBytes(contentType);
  const fileNameData = encodeStringToBytes(fileName);

  // Calculate offsets
  const storageURIOffset = currentOffset;
  currentOffset += 32 + Math.ceil(new TextEncoder().encode(storageURI).length / 32) * 32;

  const contentTypeOffset = currentOffset;
  currentOffset += 32 + Math.ceil(new TextEncoder().encode(contentType).length / 32) * 32;

  const fileNameOffset = currentOffset;

  // Build payload
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
    encodedCommitment +
    encodedSecret +
    storageURIData.data +
    contentTypeData.data +
    fileNameData.data;

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
  const selector = abiSelector("updateData(bytes32,bytes32,string,bytes32,uint256)");

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
    (newProvider.toString(16).padStart(64, "0")) + // encode as bytes32 (left-padded for consistency)
    encodeUint256(newFileSize);

  const tail = encodeUint256(uriLen) + uriPaddedHex;

  return "0x" + selector + head + tail;
}

/**
 * Encode function call for calculateFee
 */
export function encodeCalculateFee(): string {
  const selector = abiSelector("calculateFee()");
  
  // No arguments for new calculateFee
  return "0x" + selector;
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
  // the actual tuple data starts. We must detect and skip this wrapper so that
  // field indices and dynamic string offsets are calculated correctly.
  let hexNo0x = rawHex;

  if (rawHex.length >= 64) {
    const firstWord = BigInt("0x" + rawHex.slice(0, 64));
    if (firstWord === BigInt(32)) {
      // Outer tuple wrapper detected — skip 1 word (32 bytes = 64 hex chars).
      // eth_call responses for struct/tuple return types are wrapped with this
      // pointer so that field indices and dynamic string offsets are correct.
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
      // Dynamic offsets in the tuple head are relative to the start of the tuple,
      // NOT relative to the start of the full response. Since we already sliced
      // off the outer wrapper, the offset value read from the head word is already
      // correct relative to hexNo0x — no further adjustment needed.
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
  releaseEntropy: string;
  commitment: string;
  secret?: string;
  encryptedKey?: string;
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
      if ((result as { error?: unknown }).error) {
        const rpcErr = (result as { error: { message?: string; code?: number } }).error;
        throw Object.assign(new Error(rpcErr.message ?? "Contract call reverted"), { isRevert: true });
      }
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

  // Kumpulkan semua RPC URLs: cari chain yang cocok berdasarkan rpcUrl atau rpcUrls
  const allRpcUrls: string[] = [];

  for (const key of Object.keys(CHAIN_CONFIG)) {
    const cfg = CHAIN_CONFIG[key as ChainId] as { rpcUrl: string; rpcUrls?: unknown };
    const urls: string[] = Array.isArray((cfg as { rpcUrls?: unknown }).rpcUrls)
      ? ((cfg as { rpcUrls?: string[] }).rpcUrls!).filter((u): u is string => typeof u === "string")
      : [];
    const isMatch =
      cfg.rpcUrl === params.rpcUrl || urls.includes(params.rpcUrl);
    if (isMatch) {
      // Tambahkan semua rpcUrls dari chain yang cocok
      for (const u of urls) {
        if (!allRpcUrls.includes(u)) allRpcUrls.push(u);
      }
      if (!allRpcUrls.includes(cfg.rpcUrl)) allRpcUrls.push(cfg.rpcUrl);
    }
  }

  // Selalu sertakan params.rpcUrl sebagai fallback terakhir
  if (!allRpcUrls.includes(params.rpcUrl)) allRpcUrls.push(params.rpcUrl);

  // Coba semua RPC URLs secara berurutan
  for (const rpcUrl of allRpcUrls) {
    try {
      console.log(`🔄 Trying RPC: ${rpcUrl}`);
      return await callWithTimeout(rpcUrl, 2000);
    } catch (error) {
      if (error instanceof Error && (error as { isRevert?: boolean }).isRevert) {
        throw error;
      }
      console.warn(`❌ RPC Failed: ${rpcUrl}`, error);
      continue;
    }
  }

  // Jika semua RPC gagal, coba MetaMask
  console.log("🔄 All RPCs failed, trying MetaMask...");

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


export function getNetworkIdFromChainKey(chainKey: ChainId): number {
  return CHAIN_CONFIG[chainKey]?.chainId || 0;
}

export function getChainKeyFromNumericChainId(chainId: number): ChainId | null {
  const entry = Object.entries(CHAIN_CONFIG).find(([_, config]) => config.chainId === chainId);
  return entry ? (entry[0] as ChainId) : null;
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
  // Result is a tuple: (owner, currentDataHash, currentStorageURI, currentProvider, ...)

  const typesNew = [
    "address", // owner (0)
    "bytes32", // currentDataHash (1)
    "string", // currentStorageURI (2)
    "bytes32", // currentProvider (3)
    "uint256", // createdAt (4)
    "uint256", // lastUpdatedAt (5)
    "bytes32", // commitment (6)
    "uint256", // fileSize (7)
    "string", // contentType (8)
    "string", // fileName (9)
    "bool", // isPermanent (10)
    "uint256", // currentVersion (11)
    "uint256", // totalVersions (12)
    "uint256", // totalFeePaid (13)
    "uint256", // releaseDate (14)
    "bool", // isReleased (15)
    "bytes32", // releaseEntropy (16)
  ];

  const typesV2 = [
    "address", // owner (0)
    "bytes32", // currentDataHash (1)
    "string", // currentStorageURI (2)
    "uint8", // currentProvider (3)
    "uint256", // createdAt (4)
    "uint256", // lastUpdatedAt (5)
    "uint256", // fileSize (6)
    "string", // contentType (7)
    "string", // fileName (8)
    "bool", // isPermanent (9)
    "uint256", // currentVersion (10)
    "uint256", // totalVersions (11)
    "uint256", // totalFeePaid (12)
    "uint256", // releaseDate (13)
    "bool", // isReleased (14)
    "bytes32", // releaseEntropy (15)
    "string", // encryptedKey (16)
  ];

  // LEGACY ABI (Bitxen.sol original) - 16 fields (including commitment, excluding releaseEntropy)
  // Based on previous metamaskWallet.ts structure
  const typesLegacy = [
    "address", // owner (0)
    "uint8", // currentProvider (1)
    "uint256", // createdAt (2)
    "uint256", // lastUpdatedAt (3)
    "bytes32", // currentDataHash (4)
    "bytes32", // commitment (5)
    "string", // currentStorageURI (6)
    "uint256", // fileSize (7)
    "string", // contentType (8)
    "string", // fileName (9)
    "bool", // isPermanent (10)
    "uint256", // currentVersion (11)
    "uint256", // totalVersions (12)
    "uint256", // totalFeePaid (13)
    "uint256", // releaseDate (14)
    "bool", // isReleased (15)
  ];

  let decoded: unknown[] | null = null;
  let variant: "new" | "v2" | "legacy" = "new";
  let lastError: unknown = null;

  for (const candidate of [
    { variant: "new" as const, types: typesNew },
    { variant: "v2" as const, types: typesV2 },
    { variant: "legacy" as const, types: typesLegacy },
  ]) {
    try {
      decoded = decodeAbiTuple(candidate.types, result);
      variant = candidate.variant;
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!decoded) {
    throw (lastError instanceof Error ? lastError : new Error("Failed to decode getDataRecord response"));
  }

  let mapped: Partial<BitxenDataRecordRead> = {};

  if (variant === "new") {
      mapped = {
        owner: decoded[0] as string,
        currentDataHash: decoded[1] as string,
        currentStorageURI: decoded[2] as string,
        currentProvider: Number(BigInt(decoded[3] as string)),
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
        currentProvider: decoded[3] as number,
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
      mapped = {
        owner: decoded[0] as string,
        currentProvider: decoded[1] as number,
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
        releaseEntropy: "0x" + "0".repeat(64), // Default empty for legacy
      };
  }

  const isReleased = mapped.isReleased as boolean;
  const contractDataId = params.contractDataId;

  // If released, the releaseEntropy should be present.
  // HOWEVER, for vaults encrypted with "envelope" mode using a contract that generates random entropy (original BitxenEntropy),
  // the releaseEntropy in the struct will be random and NOT the key.
  // We must try to fetch the actual secret via getVaultSecret.
  
  let secret = "0x" + "0".repeat(64);
  if (isReleased) {
    try {
      // Try to get the secret from the contract
      // Note: This relies on the contract having getVaultSecret function
      const selector = abiSelector("getVaultSecret(bytes32)");
      const data = "0x" + selector + encodeBytes32(contractDataId);
      const secretHex = await ethCall({
        rpcUrl: config.rpcUrl,
        to: contractAddress,
        data,
      });
      if (secretHex && secretHex.startsWith("0x") && secretHex !== "0x" + "0".repeat(64)) {
        secret = secretHex;
      }
    } catch (e) {
      // If getVaultSecret fails (e.g. not released, or function doesn't exist on older ABI, or strict check failed),
      // we fall back to what we have in releaseEntropy.
      // But if the vault relies on this secret, decryption will fail later.
      console.warn("Failed to fetch vault secret via getVaultSecret", e);
    }
  }

  // If we found a secret (from getVaultSecret), use it to override releaseEntropy
  // This ensures the frontend gets the correct key for decryption.
  if (secret !== "0x" + "0".repeat(64)) {
    mapped.releaseEntropy = secret;
  } else if (isReleased && mapped.releaseEntropy && mapped.releaseEntropy !== "0x" + "0".repeat(64)) {
    // Fallback: if getVaultSecret failed or returned empty, but releaseEntropy is set, use that.
    // This covers cases where the contract MIGHT have set releaseEntropy correctly (e.g. if my previous patch was deployed elsewhere)
    // or if the frontend logic changes.
    mapped.releaseEntropy = mapped.releaseEntropy;
  }



  return {
    owner: mapped.owner as string,
    currentDataHash: mapped.currentDataHash as string,
    currentStorageURI: mapped.currentStorageURI as string,
    currentProvider: mapped.currentProvider as number,
    createdAt: mapped.createdAt as bigint,
    lastUpdatedAt: mapped.lastUpdatedAt as bigint,
    commitment: mapped.commitment as string,
    fileSize: mapped.fileSize as bigint,
    contentType: mapped.contentType as string,
    fileName: mapped.fileName as string,
    isPermanent: mapped.isPermanent as boolean,
    currentVersion: mapped.currentVersion as bigint,
    totalVersions: mapped.totalVersions as bigint,
    totalFeePaid: mapped.totalFeePaid as bigint,
    releaseDate: mapped.releaseDate as bigint,
    isReleased: mapped.isReleased as boolean,
    releaseEntropy: mapped.releaseEntropy as string,
    secret,
    encryptedKey: mapped.encryptedKey,
  };
}

export async function finalizeRelease(
  chainId: ChainId,
  contractDataId: string,
  contractAddress?: string,
): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const config = CHAIN_CONFIG[chainId];
  const targetAddress =
    typeof contractAddress === "string" && contractAddress.trim().length > 0
      ? contractAddress.trim()
      : config.contractAddress;

  const userAddress = await connectMetaMask();
  const currentChainId = await getCurrentChainId();

  if (currentChainId !== config.chainId) {
    await switchToChain(chainId);
  }

  const selector = abiSelector("finalizeRelease(bytes32)");
  const data = "0x" + selector + encodeBytes32(contractDataId);

  const txHash = (await window.ethereum.request({
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
 * Calculate dynamic fee from contract
 * Returns fee in wei (as bigint)
 */
export async function calculateBitxenFee(
  chainId: ChainId
): Promise<bigint> {
  const config = CHAIN_CONFIG[chainId];

  try {
    const data = encodeCalculateFee();
    const resultHex = await ethCall({
      rpcUrl: config.rpcUrl,
      to: config.contractAddress,
      data,
    });
    
    if (!resultHex || resultHex === "0x") return BigInt(0);
    return BigInt(resultHex);
  } catch (error) {
    console.error("Failed to calculate Bitxen fee:", error);
    // Fallback: Return 0 or handle error appropriately
    throw error;
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
 * Get BITXEN token balance for a given address on a given chain.
 * Uses eth_call with balanceOf(address) – no gas cost.
 * @param chainId - The chain to query
 * @param address - Wallet address to check
 * @returns Balance in wei (bigint)
 */
export async function getBitxenBalance(
  chainId: ChainId,
  address: string,
): Promise<bigint> {
  const config = CHAIN_CONFIG[chainId];
  // ERC-20 balanceOf(address) selector = 0x70a08231
  const selector = abiSelector("balanceOf(address)");
  // Encode address: pad to 32 bytes
  const encodedAddress = address.toLowerCase().replace("0x", "").padStart(64, "0");
  const data = "0x" + selector + encodedAddress;

  try {
    const resultHex = await ethCall({
      rpcUrl: config.rpcUrl,
      to: config.contractAddress,
      data,
    });
    if (!resultHex || resultHex === "0x") return BigInt(0);
    return BigInt(resultHex);
  } catch (error) {
    console.warn("Failed to read BITXEN balance:", error);
    return BigInt(0);
  }
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
  const commitment = typeof options.commitment === "string" ? options.commitment : "0x" + "0".repeat(64);
  const secret = typeof options.secret === "string" ? options.secret : "0x" + "0".repeat(64);
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
    const fee = await calculateBitxenFee(chainId);
    console.log(`📝 Registration fee: ${formatBitxenAmount(fee)}`);

    // Cek balance BITXEN sebelum kirim transaksi
    const balance = await getBitxenBalance(chainId, fromAddress);
    console.log(`💰 BITXEN balance: ${formatBitxenAmount(balance)}`);
    if (balance < fee) {
      throw new InsufficientBitxenError({ required: fee, balance, chainId });
    }

    // Register with ar:// URI pointing to Arweave
    const storageURI = `ar://${arweaveTxId}`;

    const txData = existingContractDataId
      ? encodeUpdateData(
          existingContractDataId,
          dataHash,
          storageURI,
          1, // provider as number, will be encoded to bytes32 in helper
          fileSize,
        )
      : encodeRegisterData(
          dataHash,
          storageURI,
          1, // provider as number, will be encoded to bytes32 in helper
          fileSize,
          "application/json",
          `vault-${vaultId}.json`,
          isPermanent,
          releaseDate,
          commitment,
          secret,
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

    // Re-throw InsufficientBitxenError as-is agar frontend bisa
    // mendeteksinya dengan instanceof dan tampilkan UI khusus.
    if (error instanceof InsufficientBitxenError) {
      throw error;
    }

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
