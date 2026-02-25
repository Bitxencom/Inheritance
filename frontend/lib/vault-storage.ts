import { CHAIN_CONFIG, type ChainId } from "./metamaskWallet";

/**
 * Vault Storage - localStorage utility for tracking pending vaults
 */

const STORAGE_KEY = "wishlist_pending_vaults";

export type PendingVaultStatus = "pending" | "confirmed" | "error";

export type PendingVault = {
  vaultId: string;
  title: string;
  willType: "one-time" | "editable";
  status: PendingVaultStatus;
  createdAt: string;
  confirmedAt?: string;
  fractionKeys: string[];
  triggerType?: "date" | "manual";
  triggerDate?: string;
  storageType?: "arweave" | "bitxenArweave";
  blockchainTxHash?: string;
  blockchainChain?: string;
  contractDataId?: string;
  contractAddress?: string;
  arweaveTxId: string;
};

/**
 * Get all pending vaults from localStorage
 */
export function getPendingVaults(): PendingVault[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    // Parse raw data which might contain legacy "shardKeys" or "shards"
    const parsed = JSON.parse(data);

    // Map legacy keys to fractionKeys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed.map((vault: any) => {
      let fractionKeys =
        vault.fractionKeys ||
        vault.shardKeys ||
        vault.shards ||
        vault.shares ||
        [];

      // Handle case where keys are stored as an object { shard1: "...", shard2: "..." }
      if (
        fractionKeys &&
        typeof fractionKeys === "object" &&
        !Array.isArray(fractionKeys)
      ) {
        fractionKeys = Object.values(fractionKeys).filter(
          (k) => typeof k === "string",
        );
      }

      return {
        ...vault,
        fractionKeys,
      };
    }) as PendingVault[];
  } catch (error) {
    console.error("Error reading pending vaults from localStorage:", error);
    return [];
  }
}

/**
 * Save a new pending vault to localStorage
 */
export function savePendingVault(
  vault: Omit<PendingVault, "status" | "createdAt">,
): PendingVault {
  const vaults = getPendingVaults();

  // Debug log to ensure we are receiving storageType
  console.log("💾 savePendingVault called:", {
    id: vault.vaultId,
    storageType: vault.storageType,
    blockchainChain: vault.blockchainChain,
    blockchainTxHash: vault.blockchainTxHash,
    contractDataId: vault.contractDataId,
  });

  const newVault: PendingVault = {
    ...vault,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  // Check if vault already exists
  const existingIndex = vaults.findIndex((v) => v.vaultId === vault.vaultId);
  if (existingIndex >= 0) {
    vaults[existingIndex] = newVault;
  } else {
    vaults.unshift(newVault); // Add to beginning
  }

  // Keep only last 20 vaults
  const trimmedVaults = vaults.slice(0, 20);

  saveVaultsToStorage(trimmedVaults);

  return newVault;
}

/**
 * Helper to save vaults to localStorage with backward compatibility
 */
function saveVaultsToStorage(vaults: PendingVault[]) {
  try {
    // Map back to shardKeys for storage to maintain backward compatibility
    const vaultsToStore = vaults.map((v) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fractionKeys, ...rest } = v;
      return {
        ...rest,
        // Explicitly ensure these fields are preserved from v (safety check)
        storageType: v.storageType,
        blockchainTxHash: v.blockchainTxHash,
        blockchainChain: v.blockchainChain,
        contractDataId: v.contractDataId,
        contractAddress: v.contractAddress,
        // Store as shardKeys (legacy key preference)
        shardKeys: fractionKeys,
      };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultsToStore));
  } catch (error) {
    console.error("Error saving vaults to localStorage:", error);
  }
}

/**
 * Update vault status in localStorage
 */
export function updateVaultStatus(
  vaultId: string,
  status: PendingVaultStatus,
  confirmedAt?: string,
): PendingVault | null {
  const vaults = getPendingVaults();
  const index = vaults.findIndex((v) => v.vaultId === vaultId);

  if (index < 0) return null;

  vaults[index] = {
    ...vaults[index],
    status,
    confirmedAt:
      confirmedAt ||
      (status === "confirmed" ? new Date().toISOString() : undefined),
  };

  saveVaultsToStorage(vaults);

  return vaults[index];
}

/**
 * Update vault transaction ID in localStorage (after edit)
 */
export function updateVaultTxId(
  vaultId: string,
  arweaveTxId: string,
  updates?: {
    storageType?: "arweave" | "bitxenArweave";
    blockchainTxHash?: string;
    blockchainChain?: string;
    contractDataId?: string;
    contractAddress?: string;
  },
): boolean {
  const vaults = getPendingVaults();
  const index = vaults.findIndex((v) => v.vaultId === vaultId);

  if (index < 0) return false;

  vaults[index] = {
    ...vaults[index],
    arweaveTxId,
    // Apply updates if provided
    ...(updates?.storageType && { storageType: updates.storageType }),
    ...(updates?.blockchainTxHash && {
      blockchainTxHash: updates.blockchainTxHash,
    }),
    ...(updates?.blockchainChain && {
      blockchainChain: updates.blockchainChain,
    }),
    ...(updates?.contractDataId && {
      contractDataId: updates.contractDataId,
    }),
    ...(updates?.contractAddress && {
      contractAddress: updates.contractAddress,
    }),
    // Reset status to pending as it's a new transaction waiting for confirmation
    status: "pending",
    // Update timestamp to bring it to top
    createdAt: new Date().toISOString(),
    // Clear confirmation time as it's a new pending tx
    confirmedAt: undefined,
  };

  saveVaultsToStorage(vaults);
  return true;
}

/**
 * Get a single vault by ID
 */
export function getVaultById(vaultId: string): PendingVault | null {
  const vaults = getPendingVaults();
  return vaults.find((v) => v.vaultId === vaultId) || null;
}

/**
 * Remove a vault from localStorage
 */
export function removeVault(vaultId: string): boolean {
  const vaults = getPendingVaults();
  const filtered = vaults.filter((v) => v.vaultId !== vaultId);

  if (filtered.length === vaults.length) return false;

  saveVaultsToStorage(filtered);
  return true;
}

/**
 * Remove fraction keys from a vault in localStorage, keeping the vault data
 */
export function removeVaultKeys(vaultId: string): boolean {
  const vaults = getPendingVaults();
  const index = vaults.findIndex((v) => v.vaultId === vaultId);

  if (index < 0) return false;

  // Update the vault with empty fraction keys
  vaults[index] = {
    ...vaults[index],
    fractionKeys: [],
  };

  saveVaultsToStorage(vaults);
  return true;
}

/**
 * Check Arweave transaction status using GraphQL
 */
export async function checkArweaveStatus(
  txId: string,
  vaultId?: string,
): Promise<{
  confirmed: boolean;
  blockHeight?: number;
  timestamp?: number;
  message?: string;
}> {
  // If vaultId is provided, try to use the internal API which has more robust confirmation logic
  if (vaultId && typeof window !== "undefined") {
    try {
      const response = await fetch("/api/vault/claim/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vaultId, arweaveTxId: txId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return {
            confirmed: data.isConfirmed,
            message: data.message,
          };
        }
      }
    } catch (error) {
      console.error("Error calling check API, falling back to GraphQL:", error);
    }
  }

  try {
    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            transaction(id: "${txId}") {
              id
              block {
                height
                timestamp
              }
            }
          }
        `,
      }),
    });

    const data = await response.json();
    const tx = data?.data?.transaction;

    if (tx?.block) {
      return {
        confirmed: true,
        blockHeight: tx.block.height,
        timestamp: tx.block.timestamp,
      };
    }

    return { confirmed: false };
  } catch (error) {
    console.error("Error checking blockchain storage status:", error);
    return { confirmed: false };
  }
}

/**
 * Get smart chain explorer URL for a transaction
 */
export function getSmartChainExplorerUrl(
  txId: string,
  chainId?: string,
): string {
  if (!txId || !chainId) return "";
  const config = CHAIN_CONFIG[chainId as ChainId];
  if (!config) return "";
  return `${config.blockExplorer}/tx/${txId}`;
}

/**
 * Get Arweave explorer URL for a transaction
 */
export function getArweaveExplorerUrl(txId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || "http://localhost:3021";
  return `${baseUrl}/explorer/arweave/tx/${txId}`;
}
