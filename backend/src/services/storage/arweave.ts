import Arweave from "arweave";
import { calculate } from "@metaplex/arweave-cost";

// import { appEnv } from "../../config/env.js";
import { encryptMetadata, decryptMetadata } from "../vault-service.js";

// Always use Arweave Mainnet
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const ARWEAVE_GATEWAYS = [
  "https://arweave.net",
  "https://ar-io.net",
  "https://g8way.io",
  "https://arweave.dev",
];

/**
 * Internal format for upload (with clear keys)
 */
type UploadPayloadInput = {
  vaultId: string;
  encryptedData: unknown;
  metadata: Record<string, unknown>;
  /** The transaction ID of the latest version of this vault */
  latestTxId?: string;
};

/**
 * Calculate estimated cost for uploading to Arweave based on data size
 * @param dataSize - Data size in bytes
 * @returns Estimated cost in AR (Arweave token)
 */
export const estimateUploadCost = async (dataSize: number): Promise<number> => {
  try {
    const result = await calculate([dataSize]);
    return result.arweave;
  } catch (error) {
    console.warn(`⚠️  Failed to calculate blockchain cost estimate:`, error);
    return 0;
  }
};

/**
 * Get cost estimate for vault payload before upload
 * @param payload - Payload to upload
 * @returns Estimated cost in AR and data size in bytes
 */
export const getVaultUploadCostEstimate = async (
  payload: UploadPayloadInput
): Promise<{ costAR: number; dataSizeBytes: number }> => {
  const payloadString = JSON.stringify(payload);
  const dataSize = new TextEncoder().encode(payloadString).length;
  const costAR = await estimateUploadCost(dataSize);
  
  return {
    costAR,
    dataSizeBytes: dataSize,
  };
};

// export const uploadVaultPayload = ... (REMOVED: Client-side upload only)

export const fetchVaultPayloadById = async (
  vaultId: string,
  fallbackTxId?: string,
): Promise<UploadPayloadInput> => {
  // Fetching public data does not require a wallet/JWK

  // Use Arweave GraphQL to find transaction by Doc-Id tag
  // Sort by HEIGHT_DESC to always get the latest version (for edited vaults)
  const gqlQuery = {
    query: `{
      transactions(
        tags: [
          { name: "Doc-Id", values: ["${vaultId}"] }
        ],
        sort: HEIGHT_DESC,
        first: 1
      ) {
        edges {
          node {
            id
            block {
              height
              timestamp
            }
            tags {
              name
              value
            }
          }
        }
      }
    }`,
  };

  const graphqlUrl = "https://arweave.net/graphql";

  let txId: string | null = null;
  let gqlError = false;
  let gqlBlockHeight: number | null = null;

  // Retry logic for GraphQL query
  const maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retrying Arweave GraphQL query (attempt ${attempt + 1}/${maxRetries})...`);
        // Add a small delay between retries
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const gqlResponse = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gqlQuery),
      });

      if (gqlResponse.ok) {
        const gqlJson = (await gqlResponse.json()) as {
          data?: {
            transactions?: {
              edges?: {
                node?: {
                  id?: string;
                  block?: { height?: number | null } | null;
                };
              }[];
            };
          };
        };
        const edges = gqlJson.data?.transactions?.edges ?? [];
        txId = edges[0]?.node?.id || null;
        gqlBlockHeight =
          typeof edges[0]?.node?.block?.height === "number"
            ? edges[0]?.node?.block?.height
            : null;
        success = true;
      } else {
        console.warn(`⚠️ Blockchain GraphQL query failed: HTTP ${gqlResponse.status}`);
        // Only mark as error if it's a server error (5xx) or strictly not 404/200 OK logic
        // But here we rely on the response for the ID. If it fails, we can't find the ID.
        // We continue to retry.
      }
    } catch (error) {
      console.warn(`⚠️ Blockchain GraphQL query failed (attempt ${attempt + 1}):`, error);
    }
    attempt++;
  }

  if (!success) {
    gqlError = true;
  }

  // === NEW LOGIC: Compare with fallbackTxId or use it as fallback ===
  
  // Helper to check status of a specific TxID
  const checkTxStatus = async (id: string): Promise<number> => {
    let lastNon404Status: number | null = null;

    for (const gateway of ARWEAVE_GATEWAYS) {
      try {
        const statusResponse = await fetch(`${gateway}/tx/${id}/status`, {
          method: "GET",
          redirect: "follow",
        });

        if (statusResponse.ok) {
          const statusData = (await statusResponse.json().catch(() => null)) as
            | { status?: unknown }
            | null;
          return typeof statusData?.status === "number" ? statusData.status : 200;
        }

        if (statusResponse.status === 202) return 202;
        if (statusResponse.status !== 404) lastNon404Status = statusResponse.status;
      } catch (e) {
        continue;
      }
    }

    return lastNon404Status ?? 0;
  };

  // Case 1: GraphQL passed and found a TxID
  if (txId && !gqlError) {
    if (gqlBlockHeight === null) {
      throw new Error("Vault transaction is pending");
    }

    // Check if fallbackTxId exists and is DIFFERENT from found txId
    // This implies fallbackTxId might be NEWER (pending) or OLDER. 
    // We assume if it's in local storage and different, it likely might be a pending newer version.
    if (fallbackTxId && fallbackTxId !== txId) {
       console.log(`ℹ️ Comparison: GraphQL TxId (${txId}) vs Local TxId (${fallbackTxId})`);
       
       // Check status of local fallbackTxId
       const localStatus = await checkTxStatus(fallbackTxId);
       
       if (localStatus === 202 || localStatus === 0) {
         // It is pending! Warn the user.
         throw new Error("Newer version pending");
       }
       // If localStatus is 404/400, it's invalid, stick to txId from GraphQL
       // If localStatus is 200 but different, it's weird (maybe GraphQL is lagging very much, or fork).
       // For now, if confirmed, we could arguably prefer the one from GraphQL as "truth", 
       // but let's stick to the secure default: use the one from GraphQL unless local is explicitly pending.
    }
  }

  // Case 2: GraphQL failed or returned nothing
  if (!txId) {
    if (fallbackTxId) {
      console.log(`⚠️ Vault ID not found via GraphQL, trying fallback TxId: ${fallbackTxId}`);
      
      // If fallbackTxId starts with 0x, it's a Smart Chain transaction!
      if (fallbackTxId.startsWith("0x")) {
        return fetchVaultFromSmartChain(vaultId, fallbackTxId);
      }

      // Check status of fallbackTxId (Arweave)
      const status = await checkTxStatus(fallbackTxId);
      
      if (status === 202) {
        throw new Error("Vault transaction is pending");
      }
      
      if (status === 200) {
        // Confirmed! Use this ID
        txId = fallbackTxId;
      } else {
        // 404 or other error
        throw new Error(
          `Vault ID ${vaultId} not found on blockchain storage (and fallback ID invalid)`,
        );
      }
    } else {
      if (gqlError) {
         throw new Error("Connection to blockchain failed. Please try again.");
      }
      
      // FINAL FALLBACK: If we have no txId but vaultId looks like it could be on Smart Chain
      // (This will only work if we have a way to scan logs or if vaultId IS the TxHash)
      // Since we don't have a registry yet, we can only try if vaultId is passed as the Hash
      if (vaultId.startsWith("0x")) {
        return fetchVaultFromSmartChain(vaultId, vaultId);
      }

      throw new Error(
        `Vault ID ${vaultId} not found on blockchain storage`,
      );
    }
  }

  // Fetch transaction data using the resolved txId
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchTxJson = async (id: string): Promise<unknown> => {
    const paths = [`/${id}`, `/raw/${id}`, `/tx/${id}/data`];
    let lastNon404Status: number | null = null;

    for (const gateway of ARWEAVE_GATEWAYS) {
      for (const path of paths) {
        const url = `${gateway}${path}`;
        try {
          const response = await fetchWithTimeout(
            url,
            {
              method: "GET",
              headers: {
                Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
              },
              redirect: "follow",
            },
            8000,
          );

          if (response.status === 202) {
            throw new Error("Vault transaction is pending");
          }

          if (!response.ok) {
            if (response.status !== 404) lastNon404Status = response.status;
            continue;
          }

          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            continue;
          }
          if (
            error instanceof Error &&
            (error.message.includes("pending") || error.message.includes("Newer version"))
          ) {
            throw error;
          }
          continue;
        }
      }
    }

    if (lastNon404Status === null) {
      const status = await checkTxStatus(id);
      if (status === 202 || status === 0) {
        throw new Error("Vault transaction is pending");
      }
      if (status === 200) {
        throw new Error(
          "Vault transaction is pending (transaction exists but data is not yet available on gateways)",
        );
      }
    }

    throw new Error(
      `Failed to fetch blockchain transaction data for txId=${id}: HTTP ${lastNon404Status ?? 404}`,
    );
  };

  const payloadJson = await fetchTxJson(txId);

  // Handle obfuscated format (id, v, t, m, d) - used in newer versions
  if (
    payloadJson &&
    typeof payloadJson === "object" &&
    "id" in payloadJson &&
    "m" in payloadJson &&
    "d" in payloadJson
  ) {
    try {
      const obfuscated = payloadJson as { id: string; m: string; d: unknown };
      return {
        vaultId: obfuscated.id,
        encryptedData: obfuscated.d,
        metadata: decryptMetadata(obfuscated.m, obfuscated.id),
        latestTxId: txId, // Include the latest transaction ID
      };
    } catch (error) {
      console.error("❌ Failed to decrypt metadata in obfuscated payload:", error);
      throw new Error("Failed to decrypt vault metadata from blockchain storage.");
    }
  }

  // Handle legacy format (vaultId, encryptedData, metadata)
  if (
    payloadJson &&
    typeof payloadJson === "object" &&
    "vaultId" in payloadJson &&
    "encryptedData" in payloadJson
  ) {
    return {
      ...payloadJson,
      latestTxId: txId, // Include the latest transaction ID
    } as UploadPayloadInput;
  }

  throw new Error(
    "Vault payload structure in blockchain storage is invalid or incomplete.",
  );
};

/**
 * Fetch vault data from a Smart Chain (BSC, etc.) using JSON-RPC
 * This is used as a fallback when data is not on Arweave
 */
async function fetchVaultFromSmartChain(
  vaultId: string, 
  txHash: string
): Promise<UploadPayloadInput> {
  console.log(`🌐 Fetching vault from Smart Chain: ${txHash}`);
  
  // List of RPC URLs to try (BSC as default)
  const rpcs = ["https://bsc-dataseed.binance.org/", "https://binance.llamarpc.com"];
  
  for (const rpc of rpcs) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionByHash",
          params: [txHash],
        }),
      });

      if (!response.ok) continue;

      const json = await response.json();
      const tx = json.result;

      if (!tx || !tx.input || tx.input === "0x") continue;

      // Transaction found! Parse UTF-8 from hex input
      const hex = tx.input.startsWith("0x") ? tx.input.slice(2) : tx.input;
      const jsonString = Buffer.from(hex, "hex").toString("utf8");
      
      const payload = JSON.parse(jsonString);

      // Verify it's what we expect
      if (payload.vaultId && payload.data) {
        return {
          vaultId: payload.vaultId,
          encryptedData: payload.data,
          metadata: payload.metadata || {}, // Smart Chain payload might be structured differently
          latestTxId: txHash,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Failed to fetch from RPC ${rpc}:`, error);
    }
  }

  throw new Error(`Vault ID ${vaultId} not found on Smart Chain storage (Checked hash ${txHash})`);
}
