// Wander Wallet (ArConnect) integration library
// Wander is a browser wallet for Arweave - https://wander.app
// Arweave fee for storage is automatically handled during transaction dispatch
//
// HYBRID MODE:
// - If browser extension is available → use extension
// - If not (mobile browser) → fallback to Wander Connect SDK (embedded wallet)

import Arweave from 'arweave';

// WanderConnect is dynamically imported to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WanderConnectType = any;

// Type definitions for arweaveWallet (injected by Wander/ArConnect wallet extensions)
// Using interface merging with Window, compatible with arweave package types
interface ArweaveWallet {
  connect: (permissions: string[], appInfo?: { name?: string; logo?: string }) => Promise<void>;
  disconnect: () => Promise<void>;
  getActiveAddress: () => Promise<string>;
  getPermissions: () => Promise<string[]>;
  sign: (transaction: unknown, options?: { saltLength?: number }) => Promise<unknown>;
  dispatch: (transaction: unknown) => Promise<{ id: string; type: string }>;
  getArweaveConfig: () => Promise<{ host: string; port: number; protocol: string }>;
}

declare global {
  interface Window {
    WanderSDK?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      WanderConnect: any;
    }
  }
}

// Helper to get arweaveWallet from window with proper typing
function getArweaveWallet(): ArweaveWallet | undefined {
  if (typeof window !== 'undefined' && 'arweaveWallet' in window) {
    return (window as unknown as { arweaveWallet: ArweaveWallet }).arweaveWallet;
  }
  return undefined;
}

/**
 * Wander Wallet configuration
 * Note: No business fee - user only pays Arweave storage fee
 */
export const WANDER_CONFIG = {
  // Required permissions for the app
  permissions: ['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH'] as string[],
  
  // App info for wallet connection
  appInfo: {
    name: 'Inheritance - Digital Vault',
    logo: 'https://chat.bitxen.com/logo.png',
  },
  
  // Wander Connect Client ID (free tier for now)
  clientId: 'FREE_TRIAL',
} as const;

// Store Wander Connect instance (dynamically imported)
let wanderConnectInstance: WanderConnectType | null = null;

// Track current wallet connection mode
type WalletMode = 'extension' | 'connect' | 'none';
let currentConnectionMode: WalletMode = 'none';

/**
 * Get the current wallet mode (before connection)
 */
export function getWalletMode(): WalletMode {
  if (getArweaveWallet() !== undefined) {
    return 'extension';
  }
  return 'none';
}

/**
 * Check if currently using Wander Connect (embedded wallet)
 * Returns true if the user connected via Wander Connect SDK
 */
export function isUsingWanderConnect(): boolean {
  return currentConnectionMode === 'connect';
}

/**
 * Check if Wander Wallet (ArConnect) extension is installed
 */
export function isWanderWalletInstalled(): boolean {
  return getArweaveWallet() !== undefined;
}

/**
 * Initialize Wander Connect SDK (embedded wallet)
 * This is used when browser extension is not available (e.g., mobile browser)
 */
/**
 * Preload Wander Connect SDK script
 */
export function preloadWanderConnect(): void {
  if (typeof window === 'undefined' || window.WanderSDK || document.querySelector('script[src="/wander-connect.js"]')) {
    return;
  }
  const script = document.createElement('script');
  script.src = '/wander-connect.js';
  script.async = true;
  document.body.appendChild(script);
}

/**
 * Initialize Wander Connect SDK (embedded wallet)
 * This is used when browser extension is not available (e.g., mobile browser)
 */
export async function initializeWanderConnect(): Promise<string> {
  // If already initialized and wallet is ready, return address
  if (wanderConnectInstance && getArweaveWallet()) {
    try {
      const address = await getArweaveWallet()!.getActiveAddress();
      currentConnectionMode = 'connect';
      return address;
    } catch {
      // Failed to get address, maybe disconnected. Continue to re-init.
    }
  }

  // Load script manually if not present
  if (!window.WanderSDK) {
    if (!document.querySelector('script[src="/wander-connect.js"]')) {
        await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/wander-connect.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Wander Connect SDK'));
        document.body.appendChild(script);
        });
    } else {
        // Script loading but not ready, wait a bit
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (window.WanderSDK) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
  }

  if (!window.WanderSDK || !window.WanderSDK.WanderConnect) {
     throw new Error('Wander Connect SDK loaded but object is missing.');
  }

  const WanderConnect = window.WanderSDK.WanderConnect;
  
  // Create new Wander Connect instance
  wanderConnectInstance = new WanderConnect({
    clientId: WANDER_CONFIG.clientId,
  });

  // Force open UI immediately to trigger sign-in popup
  const tryOpen = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (wanderConnectInstance && typeof (wanderConnectInstance as any).open === 'function') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (wanderConnectInstance as any).open();
          return true;
        } catch (e) {
          console.warn('Failed to auto-open Wander Connect UI:', e);
          return false;
        }
    }
    return false;
  };

  if (!tryOpen()) {
    // Retry a few times if immediate open fails
    let retries = 0;
    const interval = setInterval(() => {
        if (tryOpen() || retries > 5) clearInterval(interval);
        retries++;
    }, 500);
  }

  // Wait for wallet loaded event
  return new Promise((resolve, reject) => {
    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      reject(new Error('Wander Connect initialization timed out. Please try again.'));
    }, 5 * 60 * 1000);

    // Listen for wallet loaded event
    const handleWalletLoaded = async (e: Event) => {
      clearTimeout(timeout);
      window.removeEventListener('arweaveWalletLoaded', handleWalletLoaded);

      try {
        // Always try to connect forcefully to trigger popup
        const wallet = getArweaveWallet();
        if (wallet) {
          // Force connect to trigger popup
          await wallet.connect(WANDER_CONFIG.permissions, WANDER_CONFIG.appInfo);
          
          const address = await wallet.getActiveAddress();
          if (address) {
            currentConnectionMode = 'connect';
            
            // Close the Wander Connect popup automatically after successful connection
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (wanderConnectInstance && typeof (wanderConnectInstance as any).close === 'function') {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (wanderConnectInstance as any).close();
                } catch (e) {
                    console.warn('Failed to close Wander Connect UI:', e);
                }
            }

            resolve(address);
          } else {
            reject(new Error('Unable to get wallet address.'));
          }
        } else {
          reject(new Error('Wallet not available after initialization.'));
        }
      } catch (error) {
        reject(error);
      }
    };

    window.addEventListener('arweaveWalletLoaded', handleWalletLoaded);
  });
}

/**
 * Destroy Wander Connect instance
 * Call this when user disconnects or app unmounts
 */
export async function destroyWanderConnect(): Promise<void> {
  if (wanderConnectInstance) {
    if (typeof wanderConnectInstance.destroy === 'function') {
      try {
        await wanderConnectInstance.destroy();
      } catch (e) {
        console.error('Error destroying Wander Connect:', e);
      }
    }
    wanderConnectInstance = null;
    currentConnectionMode = 'none';
  }
}

/**
 * Connect to Wander Wallet
 * - Uses browser extension if available
 * - Falls back to Wander Connect (embedded wallet) if not
 */
export async function connectWanderWallet(): Promise<string> {
  // If extension is available, use it
  if (isWanderWalletInstalled()) {
    try {
      const wallet = getArweaveWallet()!;
      await wallet.connect(
        WANDER_CONFIG.permissions,
        WANDER_CONFIG.appInfo
      );

      const address = await wallet.getActiveAddress();
      
      if (!address) {
        throw new Error('Unable to detect a connected wallet address.');
      }

      currentConnectionMode = 'extension';
      return address;
    } catch (error) {
      if ((error as Error).message?.includes('User cancelled')) {
        throw new Error('Connection request was cancelled.');
      }
      throw new Error(`We couldn't connect to Wander Wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // No extension available, use Wander Connect (embedded wallet)
  return initializeWanderConnect();
}

/**
 * Get connected wallet address
 */
export async function getConnectedAddress(): Promise<string | null> {
  // Try extension first
  if (isWanderWalletInstalled()) {
    try {
      const wallet = getArweaveWallet()!;
      const permissions = await wallet.getPermissions();
      if (permissions.includes('ACCESS_ADDRESS')) {
        const address = await wallet.getActiveAddress();
        if (address) {
          currentConnectionMode = 'extension';
          return address;
        }
      }
    } catch {
      // Ignore extension errors, try fallback
    }
  }

  // If Wunder Connect was initialized, check it
  if (wanderConnectInstance && getArweaveWallet()) {
    try {
      const address = await getArweaveWallet()!.getActiveAddress();
      if (address) {
        currentConnectionMode = 'connect';
        return address;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Disconnect from Wander Wallet
 */
export async function disconnectWanderWallet(): Promise<void> {
  try {
    if (isWanderWalletInstalled()) {
      await getArweaveWallet()!.disconnect();
    }
    
    // Always cleanup Wander Connect
    await destroyWanderConnect();
  } catch (error) {
    console.error('Failed to disconnect:', error);
  }
}

/**
 * Check if wallet is connected and has required permissions
 */
export async function isWalletReady(): Promise<boolean> {
  try {
    // Check extension or injected wallet (Wander Connect injects arweaveWallet too)
    if (getArweaveWallet()) {
        const wallet = getArweaveWallet()!;
        const permissions = await wallet.getPermissions();
        const hasAllPermissions = WANDER_CONFIG.permissions.every(p => permissions.includes(p));
        
        if (!hasAllPermissions) {
          return false;
        }
    
        const address = await wallet.getActiveAddress();
        return !!address;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Dispatch data to Arweave via Wander Wallet
 * User pays storage fee directly from their wallet
 */
export interface DispatchResult {
  txId: string;
  type: string;
}

// Initialize Arweave for transaction creation (we use mainnet config by default)
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

export async function dispatchToArweave(data: unknown, vaultId?: string): Promise<DispatchResult> {
  const isReady = await isWalletReady();
  if (!isReady) {
    throw new Error('Wallet not connected. Please connect your wallet to proceed.');
  }

  try {
    // 1. Create transaction using arweave-js
    const transaction = await arweave.createTransaction({
      data: JSON.stringify(data),
    });

    // Add tags (using obfuscated names to hide purpose)
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'doc-storage');  // Generic app name
    transaction.addTag('Type', 'doc');               // Generic type
    transaction.addTag('Ts', Date.now().toString()); // Short timestamp key
    
    // Add Doc-Id tag (obfuscated vault ID) required for lookup
    if (vaultId) {
      transaction.addTag('Doc-Id', vaultId);
    }

    // 2. Sign transaction explicitly using Wander Wallet
    // Wander Wallet's sign method returns the signed transaction object
    // We must use this return value as it might not mutate the original object in-place reliably across environments
    const signedTransaction = await getArweaveWallet()!.sign(transaction) as typeof transaction;

    // 3. Post transaction to the network
    // Use the signed transaction returned by the wallet
    const txToPost = signedTransaction || transaction;
    const response = await arweave.transactions.post(txToPost);

    if (response.status === 200 || response.status === 202) {
      console.log('✅ Transaction posted successfully:', {
        id: txToPost.id,
        status: response.status
      });
      return {
        txId: txToPost.id,
        type: 'BASE', // L1 Transaction
      };
    } else {
      // If post fails, throw error with status
      console.error('❌ Post failed:', response);
      throw new Error(`Failed to post transaction to blockchain storage (Status: ${response.status} - ${response.statusText})`);
    }

  } catch (error) {
    console.error('Dispatch error:', error);
    if ((error as Error).message?.includes('User cancelled')) {
      throw new Error('Transaction was cancelled.');
    }
    throw new Error(`Failed to dispatch to blockchain storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check transaction status from Arweave
 */
export interface TransactionStatus {
  status: number;
  confirmed: {
    block_height: number;
    block_indep_hash: string;
    number_of_confirmations: number;
  } | null;
}

export async function checkTransactionStatus(txId: string): Promise<TransactionStatus> {
  try {
    const status = await arweave.transactions.getStatus(txId);
    return status;
  } catch (error) {
    console.error('Failed to check transaction status:', error);
    throw new Error('Failed to check transaction status.');
  }
}

// Legacy exports for backward compatibility
export const WANDER_PAYMENT_CONFIG = {
  fees: {
    basicVault: 'auto', // Automatic fee from Arweave
  },
  permissions: WANDER_CONFIG.permissions,
  appInfo: WANDER_CONFIG.appInfo,
};

// Legacy function - no longer does payment, just checks wallet is ready
export async function sendArPayment(): Promise<{ status: 'pending' }> {
  // No separate payment needed - fee handled by Arweave during dispatch
  const isReady = await isWalletReady();
  if (!isReady) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  return { status: 'pending' };
}
