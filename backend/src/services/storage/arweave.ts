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
              edges?: { node?: { id?: string } }[];
            };
          };
        };
        const edges = gqlJson.data?.transactions?.edges ?? [];
        txId = edges[0]?.node?.id || null;
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
    try {
      // We check via the data endpoint head/get request usually, 
      // but to be sure about "Pending" (202), we can use the /tx/{id}/status endpoint or just fetch data
      // Arweave gateway /tx/{id}/status returns { status: 200, confirmed: ... }
      const statusResponse = await fetch(`https://arweave.net/tx/${id}/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        // status 202 = Pending, 200 = Confirmed
        return statusData.status; 
      }
      return statusResponse.status;
    } catch (e) {
      return 0;
    }
  };

  // Case 1: GraphQL passed and found a TxID
  if (txId && !gqlError) {
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
      
      // Check status of fallbackTxId
      const status = await checkTxStatus(fallbackTxId);
      
      if (status === 202) {
        throw new Error("Vault transaction is pending");
      }
      
      if (status === 200) {
        // Confirmed! Use this ID
        txId = fallbackTxId;
      } else {
        // 404 or other error
        // If GraphQL yielded an error (network issue) AND fallback failed, we should report the network issue as primary cause if possible,
        // but here we know fallback ID is bad too.
             throw new Error(
          `Vault ID ${vaultId} not found on blockchain storage (and fallback ID invalid)`,
        );
      }
    } else {
      if (gqlError) {
         // If we had a network error and no fallback, tell the user it's a specific connection error
         throw new Error("Connection to blockchain failed. Please try again.");
      }
      throw new Error(
        `Vault ID ${vaultId} not found on blockchain storage`,
      );
    }
  }

  // Fetch transaction data using the resolved txId
  const dataUrl = `https://arweave.net/${txId}`;
  const txResponse = await fetch(dataUrl, { redirect: 'follow' });
  if (!txResponse.ok) {
     // Double check if it's pending just in case fetching data fails (e.g. 202 Accepted for data fetch)
      if (txResponse.status === 202) {
         throw new Error("Vault transaction is pending");
      }
    throw new Error(
      `Failed to fetch blockchain transaction data for txId=${txId}: HTTP ${txResponse.status}`,
    );
  }

  const payloadJson = await txResponse.json();

  // Handle obfuscated format (id, v, t, m, d) - used in newer versions
  if (payloadJson.id && payloadJson.m && payloadJson.d) {
    try {
      return {
        vaultId: payloadJson.id,
        encryptedData: payloadJson.d,
        metadata: decryptMetadata(payloadJson.m, payloadJson.id),
        latestTxId: txId, // Include the latest transaction ID
      };
    } catch (error) {
      console.error("❌ Failed to decrypt metadata in obfuscated payload:", error);
      throw new Error("Failed to decrypt vault metadata from blockchain storage.");
    }
  }

  // Handle legacy format (vaultId, encryptedData, metadata)
  if (payloadJson.vaultId && payloadJson.encryptedData) {
    return {
      ...payloadJson,
      latestTxId: txId, // Include the latest transaction ID
    } as UploadPayloadInput;
  }

  throw new Error(
    "Vault payload structure in blockchain storage is invalid or incomplete.",
  );
};

