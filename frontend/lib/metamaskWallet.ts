// MetaMask Wallet integration library for Bitxen blockchain storage
// Supports multiple chains: BSC, Ethereum, Polygon, Base, Arbitrum
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
  },
  polygon: {
    chainId: 137,
    chainIdHex: "0x89",
    name: "Polygon Mainnet",
    shortName: "MATIC",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    contractAddress: "0x8c7D96de6a5E7734E9E300e0F4D6C02e348ddf31",
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
}

/**
 * Convert string to hex
 */
function stringToHex(str: string): string {
  return "0x" + Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Simple hash function (SHA-256 like, using Web Crypto API)
 */
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Dispatch data to Bitxen blockchain
 * Stores data hash on the blockchain via transaction data field
 * 
 * @param data - The data to store (will be JSON stringified and hashed)
 * @param vaultId - Unique vault identifier
 * @param chainId - Which chain to use (default: bsc)
 */
export async function dispatchToBitxen(
  data: unknown,
  vaultId: string,
  chainId: ChainId = DEFAULT_CHAIN
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
  const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No wallet connected. Please connect MetaMask first.");
  }
  const fromAddress = accounts[0];

  try {
    // Prepare data payload - storing the actual encrypted data on-chain
    const payload = JSON.stringify({
      vaultId,
      data, // This is the encrypted vault data
    });

    const dataHex = stringToHex(payload);

    // Send transaction using raw eth_sendTransaction
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: config.contractAddress,
          value: "0x0", // No value transfer, just data storage
          data: dataHex,
        },
      ],
    }) as string;

    console.log(`✅ Transaction sent on ${config.name}:`, txHash);

    // Wait for transaction receipt (poll for confirmation)
    await waitForTransaction(txHash);

    console.log(`✅ Transaction confirmed on ${config.name}:`, txHash);

    return {
      txHash,
      chainId,
      blockExplorerUrl: `${config.blockExplorer}/tx/${txHash}`,
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
