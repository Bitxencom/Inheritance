/**
 * Arweave Gateway Client
 * 
 * Handles fetching vault data directly from Arweave.
 * Supports both direct TX ID access and Vault ID lookup via GraphQL.
 */

import type { ArweaveVaultPayload, VaultMetadata, EncryptedVault } from "./types";
import { decryptMetadata, decryptSecurityQuestion } from "./clientVaultCrypto";

const ARWEAVE_GATEWAY = "https://arweave.net";

/**
 * Fetch raw data from Arweave by transaction ID
 */
async function fetchFromArweave(txId: string): Promise<Response> {
  const response = await fetch(`${ARWEAVE_GATEWAY}/${txId}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from Arweave: ${response.status} ${response.statusText}`);
  }

  return response;
}

const ARWEAVE_GRAPHQL_ENDPOINTS = [
  "https://arweave.net/graphql",
  "https://arweave-search.goldsky.com/graphql",
];

/**
 * Find the latest Arweave transaction ID for a vault ID using GraphQL
 * 
 * @param vaultId - The vault ID to search for
 * @returns Transaction ID or null if not found
 */
const GQL_QUERIES = [
  // Strategy 1: doc-storage App-Name
  `query ($vaultId: String!) {
    transactions(
      first: 1
      sort: HEIGHT_DESC
      tags: [
        { name: "Doc-Id", values: [$vaultId] }
        { name: "App-Name", values: ["doc-storage"] }
        { name: "Type", values: ["doc"] }
      ]
    ) {
      edges { node { id block { height } } }
    }
  }`,
  // Strategy 2: Deheritance App-Name (older vaults)
  `query ($vaultId: String!) {
    transactions(
      first: 1
      sort: HEIGHT_DESC
      tags: [
        { name: "Doc-Id", values: [$vaultId] }
        { name: "App-Name", values: ["Deheritance"] }
      ]
    ) {
      edges { node { id block { height } } }
    }
  }`,
];

export async function findVaultTxIdByVaultId(vaultId: string): Promise<string | null> {
  for (const query of GQL_QUERIES) {
    for (const endpoint of ARWEAVE_GRAPHQL_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ query, variables: { vaultId } }),
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          console.warn(`[Arweave] GraphQL query failed at ${endpoint}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const edges = data?.data?.transactions?.edges;

        if (!edges || edges.length === 0) continue;

        return edges[0].node.id;
      } catch (err) {
        console.warn(`[Arweave] GraphQL query error at ${endpoint}:`, err);
      }
    }
  }

  return null;
}

/**
 * Fetch vault payload from Arweave
 * 
 * @param txId - Arweave transaction ID
 * @returns Raw vault payload from Arweave
 */
export async function fetchVaultFromArweave(txId: string): Promise<ArweaveVaultPayload> {
  const response = await fetchFromArweave(txId);
  const payload = await response.json();
  return payload as ArweaveVaultPayload;
}

/**
 * Parse and normalize vault payload from Arweave
 * Handles both new (m, d) and legacy (metadata, encryptedData) formats
 */
function normalizeVaultPayload(payload: ArweaveVaultPayload): {
  vaultId: string;
  encryptedVault: EncryptedVault;
  encryptedMetadata?: string;
  rawMetadata?: VaultMetadata;
} {
  // New format: id, m (encrypted metadata), d (encrypted data)
  if (payload.d) {
    return {
      vaultId: payload.id,
      encryptedVault: payload.d,
      encryptedMetadata: payload.m,
    };
  }

  // Legacy format: vaultId, encryptedData, metadata
  if (payload.encryptedData) {
    return {
      vaultId: payload.vaultId || payload.id,
      encryptedVault: payload.encryptedData,
      encryptedMetadata: payload.metadata?.encryptedMetadata,
      rawMetadata: payload.metadata,
    };
  }

  throw new Error("Invalid vault payload format");
}

export async function parseVaultPayloadFromArweave(params: {
  payload: ArweaveVaultPayload;
  txId: string;
  fallbackVaultId?: string;
}): Promise<{
  vaultId: string;
  txId: string;
  metadata: VaultMetadata;
  securityQuestions: string[];
  encryptedVault: EncryptedVault;
}> {
  const normalized = normalizeVaultPayload(params.payload);
  const vaultId =
    (typeof normalized.vaultId === "string" && normalized.vaultId.trim().length > 0
      ? normalized.vaultId.trim()
      : "") ||
    (typeof params.fallbackVaultId === "string" ? params.fallbackVaultId.trim() : "");

  let metadata: VaultMetadata = {};
  if (normalized.encryptedMetadata) {
    try {
      metadata = (await decryptMetadata(normalized.encryptedMetadata, vaultId)) as VaultMetadata;
    } catch {
      metadata = normalized.rawMetadata || {};
    }
  } else if (normalized.rawMetadata) {
    metadata = normalized.rawMetadata;
  }

  const securityQuestions: string[] = [];
  if (metadata.securityQuestionHashes && metadata.securityQuestionHashes.length > 0) {
    for (const sq of metadata.securityQuestionHashes) {
      if (sq.q) {
        try {
          const question = await decryptSecurityQuestion(sq.q, vaultId);
          securityQuestions.push(question);
          continue;
        } catch {
        }
      }

      if (sq.encryptedQuestion) {
        try {
          const question = await decryptSecurityQuestion(sq.encryptedQuestion, vaultId);
          securityQuestions.push(question);
          continue;
        } catch {
        }
      }

      if (sq.question) {
        securityQuestions.push(sq.question);
      } else {
        securityQuestions.push("[Question not available]");
      }
    }
  } else if (metadata.securityQuestions) {
    securityQuestions.push(...metadata.securityQuestions);
  }

  return {
    vaultId,
    txId: params.txId,
    metadata,
    securityQuestions,
    encryptedVault: normalized.encryptedVault,
  };
}

/**
 * Fetch and decrypt vault metadata
 * 
 * @param txIdOrVaultId - Transaction ID or Vault ID
 * @param providedTxId - Optional explicit TX ID (overrides lookup)
 * @returns Decrypted metadata with security questions
 */
export async function fetchVaultMetadata(
  txIdOrVaultId: string,
  providedTxId?: string
): Promise<{
  vaultId: string;
  txId: string;
  metadata: VaultMetadata;
  securityQuestions: string[];
  encryptedVault: EncryptedVault;
}> {
  // Determine if input is TX ID or Vault ID
  // TX IDs are 43 characters, Vault IDs are typically UUIDs (36 chars)
  let txId = providedTxId;
  let vaultId = txIdOrVaultId;

  if (!txId) {
    if (txIdOrVaultId.length === 43) {
      // Likely a TX ID
      txId = txIdOrVaultId;
    } else {
      // Likely a Vault ID, need to look up TX ID
      const foundTxId = await findVaultTxIdByVaultId(txIdOrVaultId);
      if (!foundTxId) {
        throw new Error("Your Vault ID is not found or waiting for confirmation. Please try again later.");
      }
      txId = foundTxId;
    }
  }

  // Fetch payload
  const rawPayload = await fetchVaultFromArweave(txId);
  console.log("[DEBUG] Raw payload:", rawPayload);

  const normalized = normalizeVaultPayload(rawPayload);
  console.log("[DEBUG] Normalized:", {
    vaultId: normalized.vaultId,
    hasEncryptedMetadata: !!normalized.encryptedMetadata,
    encryptedMetadataPrefix: normalized.encryptedMetadata?.substring(0, 20),
  });

  const parsed = await parseVaultPayloadFromArweave({ payload: rawPayload, txId, fallbackVaultId: vaultId });

  console.log("[DEBUG] Decrypted metadata:", parsed.metadata);
  console.log("[DEBUG] Security question hashes:", parsed.metadata.securityQuestionHashes);
  console.log("[DEBUG] Checking securityQuestionHashes:", parsed.metadata.securityQuestionHashes);
  if (parsed.metadata.securityQuestionHashes && parsed.metadata.securityQuestionHashes.length > 0) {
    console.log("[DEBUG] Found", parsed.metadata.securityQuestionHashes.length, "security question hashes");
  }

  return parsed;
}

/**
 * Fetch encrypted vault data for decryption
 * 
 * @param vaultId - Vault ID
 * @param txId - Optional explicit transaction ID
 * @returns Encrypted vault ready for decryption
 */
export async function fetchEncryptedVault(
  vaultId: string,
  txId?: string
): Promise<{
  encryptedVault: EncryptedVault;
  metadata: VaultMetadata;
  vaultId: string;
  txId: string;
}> {
  const result = await fetchVaultMetadata(vaultId, txId);
  return {
    encryptedVault: result.encryptedVault,
    metadata: result.metadata,
    vaultId: result.vaultId,
    txId: result.txId,
  };
}

/**
 * Check if an Arweave transaction is confirmed
 * 
 * @param txId - Transaction ID to check
 * @returns True if confirmed
 */
export async function isTransactionConfirmed(txId: string): Promise<boolean> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAY}/tx/${txId}/status`);
    if (!response.ok) {
      return false;
    }
    const status = await response.json();
    return status.number_of_confirmations > 0;
  } catch {
    return false;
  }
}
