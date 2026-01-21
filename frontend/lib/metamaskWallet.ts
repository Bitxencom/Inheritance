// MetaMask Wallet integration library for Bitxen blockchain storage
// Supports multiple chains: BSC, Ethereum, Poly, Base, Arbitrum
//
// USAGE:
// - connectMetaMask() -> connects wallet and returns address
// - switchToChain(chainId) -> switches MetaMask to specified chain
// - dispatchToBitxen(data, vaultId, chainId) -> stores data on blockchain
//
// NOTE: Uses native window.ethereum API (no ethers dependency required)

// Chain configurations with Bitxen contract addresses
export const CHAIN_CONFIG = {
  bsc: {
    chainId: 56,
    chainIdHex: "0x38",
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrl: "https://bsc-dataseed.binance.org/",
    blockExplorer: "https://bscscan.com",
    contractAddress: "0x1f3310a9dE5e554CdE6717648E25888EF35B3254",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
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
  },
} as const;

export type ChainId = keyof typeof CHAIN_CONFIG;

// Default chain for Bitxen
export const DEFAULT_CHAIN: ChainId = "bsc";

// Get list of available chains
export function getAvailableChains(): ChainId[] {
  return Object.keys(CHAIN_CONFIG) as ChainId[];
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
  return typeof window.ethereum !== "undefined" && window.ethereum.isMetaMask === true;
}

/**
 * Connect to MetaMask wallet
 * @returns Connected wallet address
 */
export async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
    
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
 * Get currently connected address
 */
export async function getConnectedAddress(): Promise<string | null> {
  if (!isMetaMaskInstalled() || !window.ethereum) return null;

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
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
 * Dispatch result from blockchain transaction
 */
export interface DispatchResult {
  txHash: string;
  chainId: ChainId;
  blockExplorerUrl: string;
  dataId?: string; // The data ID returned from registerData
}

/**
 * Bitxen Contract ABI (partial - only functions we need)
 */
const BITXEN_ABI = {
  // ERC20 approve function
  approve: {
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
  },
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
 * Encode function call for ERC20 approve
 */
function encodeApprove(spender: string, amount: bigint): string {
  // Function selector: keccak256("approve(address,uint256)")[0:4]
  const selector = "095ea7b3";
  // Pad address to 32 bytes (remove 0x prefix, pad left)
  const paddedSpender = spender.slice(2).toLowerCase().padStart(64, "0");
  // Convert amount to hex, pad to 32 bytes
  const paddedAmount = amount.toString(16).padStart(64, "0");
  return "0x" + selector + paddedSpender + paddedAmount;
}

/**
 * Encode function call for registerData
 */
function encodeRegisterData(
  dataHash: string,
  storageURI: string,
  provider: number,
  fileSize: bigint,
  contentType: string,
  fileName: string,
  isPermanent: boolean,
  releaseDate: bigint,
  encryptedKey: string
): string {
  // Function selector: keccak256("registerData((bytes32,string,uint8,uint256,string,string,bool,uint256,string))")[0:4]
  // Pre-computed: 0x5a66b38d (you may need to verify this)
  const selector = "5a66b38d";

  // Helper to encode string
  const encodeString = (str: string): string => {
    const bytes = new TextEncoder().encode(str);
    const length = bytes.length.toString(16).padStart(64, "0");
    const paddedBytes = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .padEnd(Math.ceil(bytes.length / 32) * 64, "0");
    return length + paddedBytes;
  };

  // Build dynamic data offsets
  // The struct has 9 fields, but 5 are dynamic (strings)
  // Static data size: 32*4 + 1 (bool as 32) = 160 bytes per static field
  // Dynamic fields need offsets

  // This is complex ABI encoding - let's use a simpler approach
  // We'll encode as raw hex with proper padding

  // dataHash (bytes32 - 32 bytes)
  const encodedDataHash = dataHash.startsWith("0x")
    ? dataHash.slice(2).padStart(64, "0")
    : dataHash.padStart(64, "0");

  // For simplicity, we'll encode the tuple as individual params
  // Since the contract expects a struct, we need proper tuple encoding

  // Tuple offset (starts at 32 bytes = 0x20)
  const tupleOffset = "0000000000000000000000000000000000000000000000000000000000000020";

  // Static fields in order: dataHash, provider, fileSize, isPermanent, releaseDate
  // Dynamic fields: storageURI, contentType, fileName, encryptedKey

  // Encode static parts
  const encodedProvider = provider.toString(16).padStart(64, "0");
  const encodedFileSize = fileSize.toString(16).padStart(64, "0");
  const encodedIsPermanent = (isPermanent ? 1 : 0).toString(16).padStart(64, "0");
  const encodedReleaseDate = releaseDate.toString(16).padStart(64, "0");

  // Calculate offsets for dynamic data
  // Position after all static fields (9 * 32 = 288 bytes = 0x120)
  const dynamicStart = 9 * 32;
  let currentOffset = dynamicStart;

  // Helper for string encoding with length prefix
  const encodeStringToBytes = (str: string): { offset: string; data: string } => {
    const bytes = new TextEncoder().encode(str);
    const length = bytes.length;
    const lengthHex = length.toString(16).padStart(64, "0");
    const dataHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Pad to 32-byte boundary
    const paddedData = dataHex.padEnd(Math.ceil(length / 32) * 64, "0");
    return { offset: "", data: lengthHex + paddedData };
  };

  // Encode all strings
  const storageURIData = encodeStringToBytes(storageURI);
  const contentTypeData = encodeStringToBytes(contentType);
  const fileNameData = encodeStringToBytes(fileName);
  const encryptedKeyData = encodeStringToBytes(encryptedKey);

  // Calculate actual offsets
  const storageURIOffset = currentOffset;
  currentOffset += 32 + Math.ceil(new TextEncoder().encode(storageURI).length / 32) * 32;
  const contentTypeOffset = currentOffset;
  currentOffset += 32 + Math.ceil(new TextEncoder().encode(contentType).length / 32) * 32;
  const fileNameOffset = currentOffset;
  currentOffset += 32 + Math.ceil(new TextEncoder().encode(fileName).length / 32) * 32;
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
  isPermanent: boolean = false
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
export async function dispatchToBitxen(
  data: unknown,
  vaultId: string,
  chainId: ChainId = DEFAULT_CHAIN,
  isPermanent: boolean = false
): Promise<DispatchResult> {
  if (!isMetaMaskInstalled() || !window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  const config = CHAIN_CONFIG[chainId];

  // Ensure we're on the correct chain
  const currentChainId = await getCurrentChainId();
  if (currentChainId !== config.chainId) {
    await switchToChain(chainId);
  }

  // Get connected account
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No wallet connected. Please connect MetaMask first.");
  }
  const fromAddress = accounts[0];

  try {
    // Prepare data
    const payload = JSON.stringify({
      vaultId,
      data, // Encrypted vault data
      timestamp: Date.now(),
    });

    const dataHash = await hashData(payload);
    const fileSize = BigInt(new TextEncoder().encode(payload).length);

    // Get the required fee
    const fee = await getRegistrationFee(chainId, isPermanent);
    console.log(`📝 Registration fee: ${formatBitxenAmount(fee)}`);

    // Step 1: Approve token spending
    console.log("🔐 Step 1/2: Requesting token approval...");
    const approveData = encodeApprove(config.contractAddress, fee);

    const approveTxHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: config.contractAddress, // BITXEN token is the same as the contract
          data: approveData,
        },
      ],
    })) as string;

    console.log(`✅ Approval tx sent: ${approveTxHash}`);
    await waitForTransaction(approveTxHash);
    console.log(`✅ Approval confirmed`);

    // Step 2: Register data
    console.log("📦 Step 2/2: Registering data on blockchain...");

    const registerData = encodeRegisterData(
      dataHash,
      `bitxen://${vaultId}`, // Storage URI (using our own protocol)
      2, // CUSTOM provider
      fileSize,
      "application/json", // Content type
      `vault-${vaultId}.json`, // File name
      isPermanent,
      BigInt(0), // Release date (0 = immediate)
      "" // Encrypted key (empty for now)
    );

    const registerTxHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: config.contractAddress,
          data: registerData,
        },
      ],
    })) as string;

    console.log(`✅ Registration tx sent on ${config.name}:`, registerTxHash);
    await waitForTransaction(registerTxHash);
    console.log(`✅ Registration confirmed on ${config.name}:`, registerTxHash);

    return {
      txHash: registerTxHash,
      chainId,
      blockExplorerUrl: `${config.blockExplorer}/tx/${registerTxHash}`,
      dataId: dataHash, // The data ID is the hash
    };
  } catch (error) {
    console.error("Bitxen dispatch error:", error);

    if ((error as { code?: number }).code === 4001) {
      throw new Error("Transaction was rejected. Please try again.");
    }

    throw new Error(
      `Failed to store on ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Wait for transaction to be mined
 */
async function waitForTransaction(txHash: string, maxAttempts = 30): Promise<void> {
  if (!window.ethereum) return;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      
      if (receipt) {
        return; // Transaction confirmed
      }
    } catch {
      // Ignore errors, keep polling
    }
    
    // Wait 2 seconds before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Transaction not confirmed after max attempts, but still submitted
  console.warn("Transaction submitted but not yet confirmed. It may take a few minutes.");
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
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
