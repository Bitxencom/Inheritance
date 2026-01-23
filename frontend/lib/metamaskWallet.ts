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
  // BSC Testnet - for development testing
  // Get free tBNB from: https://www.bnbchain.org/en/testnet-faucet
  // Contract verified: BITXEN token with custom registration functions
  bscTestnet: {
    chainId: 97,
    chainIdHex: "0x61",
    name: "BNB Smart Chain Testnet",
    shortName: "BSC Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
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
  contractDataId: string; // Data ID from contract (hash)
  chainId: ChainId;
  blockExplorerUrl: string;
  arweaveUrl: string; // Direct link to Arweave data
}

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
  isPermanent: boolean = false,
  onProgress?: (status: string) => void,
): Promise<HybridDispatchResult> {
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

  const arweaveResult = await dispatchToArweave(arweavePayload, vaultId);
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

    const registerData = encodeRegisterData(
      dataHash,
      storageURI, // ar://{txId} - points to Arweave
      1, // ARWEAVE provider (not CUSTOM)
      fileSize,
      "application/json",
      `vault-${vaultId}.json`,
      isPermanent,
      BigInt(0), // Release date (0 = immediate)
      "", // Encrypted key
    );

    const registerTxHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: config.contractAddress,
          data: registerData,
          gas: "0x1E8480", // 2,000,000 Gas Limit (Manual override for estimation issues)
        },
      ],
    })) as string;

    console.log(`✅ Contract registration tx sent: ${registerTxHash}`);
    await waitForTransaction(registerTxHash);
    console.log(`✅ Hybrid storage complete!`);

    return {
      arweaveTxId,
      contractTxHash: registerTxHash,
      contractDataId: dataHash,
      chainId,
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
): Promise<void> {
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Transaction not confirmed after max attempts, but still submitted
  console.warn(
    "Transaction submitted but not yet confirmed. It may take a few minutes.",
  );
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
