// MetaMask Wallet integration library for Bitxen blockchain storage
// Supports multiple chains: BSC, Ethereum, Poly, Base, Arbitrum
//
// USAGE:
// - connectMetaMask() -> connects wallet and returns address
// - switchToChain(chainId) -> switches MetaMask to specified chain
// - dispatchToBitxen(data, vaultId, chainId) -> stores data on blockchain
//
// NOTE: Uses native window.ethereum API (no ethers dependency required)

// ABI encoding/decoding utilities — pulled from abi-encoder.ts
// Re-export for backward compatibility (consumers importing from this file still work)
export {
  bytesToHex,
  hexToBytes,
  abiSelector,
  encodeBytes32,
  encodeUint256,
  encodeRegisterData,
  encodeUpdateData,
  encodeCalculateFee,
  decodeAbiTuple,
} from "./abi-encoder";

// Import for internal use within this file
import {
  bytesToHex,
  abiSelector,
  encodeBytes32,
  encodeUint256,
  encodeRegisterData,
  encodeUpdateData,
  encodeCalculateFee,
  decodeAbiTuple,
} from "./abi-encoder";

// keccak_256 is still needed for ARWEAVE_PROVIDER_HASH in dispatchHybrid
import { keccak_256 } from "@noble/hashes/sha3";

// Chain configurations with Bitxen contract addresses
import {
  CHAIN_CONFIG,
  ChainId,
  getAvailableChains,
  getChainKeyFromNumericChainId,
  getNetworkIdFromChainKey,
  type ChainInfo,
} from "./chains";

export {
  CHAIN_CONFIG,
  getAvailableChains,
  getChainKeyFromNumericChainId,
  getNetworkIdFromChainKey,
};
export type { ChainId };

// Default chain for Bitxen
export const DEFAULT_CHAIN: ChainId = "bscTestnet";

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
  getVaultSecret: {
    name: "getVaultSecret",
    inputs: [{ name: "_dataId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
};

// ABI utilities are imported from abi-encoder.ts at the top of this file.
// pad32Hex is only used internally below.
function pad32Hex(hexNo0x: string): string {
  return hexNo0x.replace(/^0x/i, "").padStart(64, "0");
}

type BitxenDataRecordRead = {
  owner: string;
  currentDataHash: string;
  currentStorageURI: string;
  currentProvider: number | string;
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


// getNetworkIdFromChainKey and getChainKeyFromNumericChainId moved to chains.ts

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
      currentProvider: decoded[3] as string, // was decoded as bytes32
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
  {
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
    currentProvider: mapped.currentProvider as string | number,
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

// export async function finalizeRelease(
//   chainId: ChainId,
//   contractDataId: string,
//   contractAddress?: string,
// ): Promise<string> {

export async function finalizeRelease(params: {
  chainId: ChainId;
  contractDataId: string;
  contractAddress?: string;
}): Promise<string> {
  if (!window.ethereum) {
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

    const ARWEAVE_PROVIDER_HASH = "0x" + bytesToHex(keccak_256(new TextEncoder().encode("arweave")));

    const txData = existingContractDataId
      ? encodeUpdateData(
        existingContractDataId,
        dataHash,
        storageURI,
        ARWEAVE_PROVIDER_HASH,
        fileSize,
      )
      : encodeRegisterData(
        dataHash,
        storageURI,
        ARWEAVE_PROVIDER_HASH,
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

// formatWalletAddress moved to crypto-utils.ts
import { formatWalletAddress } from "./crypto-utils";
export { formatWalletAddress };

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
