"use client";

import { getVaultById } from "@/lib/vault-storage";
import {
  sha256Hex,
  parseFractionKeyShareInfo,
} from "./crypto-utils";
import {
  decryptMetadataClient,
  type WrappedKeyV1,
  type EncryptedVaultClient,
} from "./clientVaultCrypto";
import {
  getAvailableChains,
  getChainKeyFromNumericChainId,
  readBitxenDataIdByHash,
  readBitxenDataRecord,
  CHAIN_CONFIG,
  type ChainId,
} from "./metamaskWallet";

export type FractionKeyCommitmentsV1 = {
  scheme: "sha256";
  version: 1;
  byShareId: Record<string, string>;
  createdAt?: string;
};

export type BitxenIndexV1 = {
  schema?: string;
  vaultId?: string;
  storageType?: string;
  bitxen?: {
    chainId?: number;
    chainKey?: string;
    contractAddress?: string;
    contractDataId?: string;
  };
  arweave?: {
    contentTxId?: string;
  };
};

/**
 * Lightweight discovery: find contractDataId + chainKey for a vault from the
 * Arweave bitxen-index document. Does NOT download the full vault payload.
 * Works from any browser (no localStorage required).
 */
export async function discoverBitxenChainInfo(params: {
  vaultId: string;
  arweaveTxId?: string | null;
  chainKeyHint?: ChainId | null;
}): Promise<{
  chainKey: ChainId;
  contractDataId: string;
  contractAddress?: string;
} | null> {
  const safeVaultId = typeof params.vaultId === "string" ? params.vaultId.trim() : "";
  if (!safeVaultId) return null;

  // Strategy 1: Query Arweave GraphQL for bitxen-index document
  try {
    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($vaultId: String!) {
            transactions(
              first: 1
              sort: HEIGHT_DESC
              tags: [
                { name: "Doc-Id", values: [$vaultId] }
                { name: "App-Name", values: ["doc-storage"] }
                { name: "Type", values: ["bitxen-index"] }
              ]
            ) {
              edges { node { id } }
            }
          }
        `,
        variables: { vaultId: safeVaultId },
      }),
    });
    if (response.ok) {
      const gql = await response.json().catch(() => ({}));
      const indexTxId = gql?.data?.transactions?.edges?.[0]?.node?.id;
      if (typeof indexTxId === "string" && indexTxId.trim().length > 0) {
        const indexText = await fetch(`https://arweave.net/${indexTxId.trim()}`)
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
        if (indexText) {
          const indexJson = JSON.parse(indexText) as BitxenIndexV1;
          const contractDataIdRaw = indexJson?.bitxen?.contractDataId;
          const contractDataId =
            typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
              ? contractDataIdRaw
              : null;
          const chainKeyRaw = indexJson?.bitxen?.chainKey;
          const numericChainId =
            typeof indexJson?.bitxen?.chainId === "number" ? indexJson.bitxen.chainId : null;
          const inferredChainKey = numericChainId
            ? getChainKeyFromNumericChainId(numericChainId)
            : null;
          const chainKey =
            typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
              ? (chainKeyRaw.trim() as ChainId)
              : inferredChainKey;
          const contractAddressRaw = indexJson?.bitxen?.contractAddress;
          const contractAddress =
            typeof contractAddressRaw === "string" &&
              /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
              ? contractAddressRaw.trim()
              : undefined;
          if (contractDataId && chainKey) {
            return { chainKey, contractDataId, contractAddress };
          }
        }
      }
    }
  } catch {
    // ignore, try next strategy
  }

  // Strategy 2: Fetch vault payload from Arweave and decrypt metadata using vaultId as key.
  const txId = typeof params.arweaveTxId === "string" ? params.arweaveTxId.trim() : "";
  if (txId.length > 0) {
    try {
      const payloadText = await fetch(`https://arweave.net/${txId}`)
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null);
      if (payloadText) {
        const payloadJson = JSON.parse(payloadText) as Record<string, unknown>;
        const encryptedMetadata = payloadJson?.m;
        if (typeof encryptedMetadata === "string" && encryptedMetadata.length > 0) {
          const metadata = await decryptMetadataClient(encryptedMetadata, safeVaultId).catch(() => null);
          if (metadata) {
            const contractDataIdRaw = (metadata as Record<string, unknown>).contractDataId;
            const contractDataId =
              typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
                ? contractDataIdRaw
                : null;
            const chainKeyRaw = (metadata as Record<string, unknown>).blockchainChain;
            const chainKey =
              typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
                ? (chainKeyRaw.trim() as ChainId)
                : null;
            const contractAddressRaw = (metadata as Record<string, unknown>).contractAddress;
            const contractAddress =
              typeof contractAddressRaw === "string" &&
                /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
                ? contractAddressRaw.trim()
                : undefined;

            let resolvedId = contractDataId;
            let resolvedChain = chainKey;
            let resolvedAddr = contractAddress;
            if (!resolvedId) {
              try {
                const payloadBuffer = new TextEncoder().encode(payloadText);
                const dataHashRaw = await sha256Hex(payloadBuffer);
                const dataHash = "0x" + dataHashRaw;
                const chainsToTry = resolvedChain
                  ? [resolvedChain]
                  : params.chainKeyHint
                    ? [params.chainKeyHint]
                    : (Object.keys(CHAIN_CONFIG) as ChainId[]);
                outer: for (const tryChain of chainsToTry) {
                  const tryAddress = resolvedAddr ?? CHAIN_CONFIG[tryChain].contractAddress;
                  for (let v = 1; v <= 5; v++) {
                    try {
                      const foundId = await readBitxenDataIdByHash({
                        chainId: tryChain,
                        dataHash,
                        version: BigInt(v),
                        contractAddress: tryAddress,
                      });
                      if (foundId && foundId !== "0x" + "0".repeat(64)) {
                        resolvedId = foundId;
                        resolvedChain = tryChain;
                        resolvedAddr = tryAddress;
                        break outer;
                      }
                    } catch {
                      // version not found, try next
                    }
                  }
                }
              } catch (e) {
                console.warn("Failed to derive contractDataId from hash lookup:", e);
              }
            }

            if (resolvedId && resolvedChain) {
              return { chainKey: resolvedChain, contractDataId: resolvedId, contractAddress: resolvedAddr };
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Strategy 3: Fallback - if no arweaveTxId was provided/found, query for the main "doc" transaction directly.
  if (txId.length === 0) {
    try {
      const response = await fetch("https://arweave.net/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query ($vaultId: String!) {
              transactions(
                first: 1
                sort: HEIGHT_DESC
                tags: [
                  { name: "Doc-Id", values: [$vaultId] }
                  { name: "App-Name", values: ["doc-storage"] }
                  { name: "Type", values: ["doc"] }
                ]
              ) {
                edges { node { id } }
              }
            }
          `,
          variables: { vaultId: safeVaultId },
        }),
      });
      if (response.ok) {
        const gql = await response.json().catch(() => ({}));
        const docTxId = gql?.data?.transactions?.edges?.[0]?.node?.id;

        if (typeof docTxId === "string" && docTxId.trim().length > 0) {
          const payloadText = await fetch(`https://arweave.net/${docTxId.trim()}`)
            .then((r) => (r.ok ? r.text() : null))
            .catch(() => null);

          if (payloadText) {
            const payloadJson = JSON.parse(payloadText) as Record<string, unknown>;
            const encryptedMetadata = payloadJson?.m;

            if (typeof encryptedMetadata === "string" && encryptedMetadata.length > 0) {
              const metadata = await decryptMetadataClient(encryptedMetadata, safeVaultId).catch(() => null);
              if (metadata) {
                const contractDataIdRaw = (metadata as Record<string, unknown>).contractDataId;
                const contractDataId =
                  typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x")
                    ? contractDataIdRaw
                    : null;
                const chainKeyRaw = (metadata as Record<string, unknown>).blockchainChain;
                const chainKey =
                  typeof chainKeyRaw === "string" && chainKeyRaw.trim().length > 0
                    ? (chainKeyRaw.trim() as ChainId)
                    : null;
                const contractAddressRaw = (metadata as Record<string, unknown>).contractAddress;
                const contractAddress =
                  typeof contractAddressRaw === "string" &&
                    /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw.trim())
                    ? contractAddressRaw.trim()
                    : undefined;

                let resolvedId3 = contractDataId;
                let resolvedChain3 = chainKey;
                let resolvedAddr3 = contractAddress;
                if (!resolvedId3) {
                  try {
                    const payloadBuffer = new TextEncoder().encode(payloadText);
                    const dataHashRaw = await sha256Hex(payloadBuffer);
                    const dataHash = "0x" + dataHashRaw;
                    const chainsToTry = resolvedChain3
                      ? [resolvedChain3]
                      : params.chainKeyHint
                        ? [params.chainKeyHint]
                        : (Object.keys(CHAIN_CONFIG) as ChainId[]);
                    outer3: for (const tryChain of chainsToTry) {
                      const tryAddress = resolvedAddr3 ?? CHAIN_CONFIG[tryChain].contractAddress;
                      for (let v = 1; v <= 5; v++) {
                        try {
                          const foundId = await readBitxenDataIdByHash({
                            chainId: tryChain,
                            dataHash,
                            version: BigInt(v),
                            contractAddress: tryAddress,
                          });
                          if (foundId && foundId !== "0x" + "0".repeat(64)) {
                            resolvedId3 = foundId;
                            resolvedChain3 = tryChain;
                            resolvedAddr3 = tryAddress;
                            break outer3;
                          }
                        } catch {
                          // version not found, try next
                        }
                      }
                    }
                  } catch (e) {
                    console.warn("Failed to derive contractDataId from hash lookup:", e);
                  }
                }

                if (resolvedId3 && resolvedChain3) {
                  return { chainKey: resolvedChain3, contractDataId: resolvedId3, contractAddress: resolvedAddr3 };
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function findLatestArweaveDocTxIdForVault(vaultId: string): Promise<string | null> {
  try {
    const safeVaultId = typeof vaultId === "string" ? vaultId.trim() : "";
    if (!safeVaultId) return null;

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($vaultId: String!) {
            transactions(
              first: 1
              sort: HEIGHT_DESC
              tags: [
                { name: "Doc-Id", values: [$vaultId] }
                { name: "App-Name", values: ["doc-storage"] }
                { name: "Type", values: ["doc"] }
              ]
            ) {
              edges { node { id } }
            }
          }
        `,
        variables: { vaultId: safeVaultId },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const id = data?.data?.transactions?.edges?.[0]?.node?.id;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  } catch {
    return null;
  }
}

export async function fetchArweaveText(txId: string): Promise<string> {
  const safe = typeof txId === "string" ? txId.trim() : "";
  if (!safe) throw new Error("Missing Arweave transaction ID.");
  const response = await fetch(`https://arweave.net/${safe}`, {
    method: "GET",
    headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
  });
  if (response.status === 202) {
    throw new Error("Vault transaction is pending. Please retry in a few minutes.");
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch from Arweave (HTTP ${response.status}).`);
  }
  return response.text();
}

export function parseArweaveTxIdFromStorageURI(storageURI: string): string | null {
  const trimmed = typeof storageURI === "string" ? storageURI.trim() : "";
  if (trimmed.startsWith("ar://")) {
    const id = trimmed.slice(5).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}

export async function tryLoadHybridEncryptedVault(params: {
  vaultId: string;
  onProgress?: (step: string, details?: string) => void;
}): Promise<{
  encryptedVault: EncryptedVaultClient;
  metadata: unknown | null;
  contractEncryptedKey: string | null;
  releaseEntropy?: string;
  isReleased?: boolean;
  canFinalize?: boolean;
  chainId?: ChainId;
  dataId?: string;
  contractAddress?: string;
} | null> {
  params.onProgress?.("🔍 Searching for vault location...");

  const latestDocTxId = await findLatestArweaveDocTxIdForVault(params.vaultId);
  if (!latestDocTxId) return null;

  params.onProgress?.("📥 Downloading vault metadata...");
  const latestText = await fetchArweaveText(latestDocTxId);
  const latestBytes = new TextEncoder().encode(latestText);
  const latestHash = ("0x" + (await sha256Hex(latestBytes))).toLowerCase();

  params.onProgress?.("🔗 Locating vault contract...");
  let discovered:
    | {
      chainKey: ChainId;
      contractDataId: string;
      contractAddress?: string;
      record?: Record<string, unknown>;
    }
    | null = null;

  const localVault = getVaultById(params.vaultId);
  const localChainKeyRaw = localVault?.blockchainChain;
  const localContractDataIdRaw = localVault?.contractDataId;
  const localContractAddressRaw = localVault?.contractAddress;
  if (
    localChainKeyRaw &&
    localContractDataIdRaw &&
    localContractDataIdRaw.startsWith("0x")
  ) {
    const record = await readBitxenDataRecord({
      chainId: localChainKeyRaw as ChainId,
      contractDataId: localContractDataIdRaw,
      ...(localContractAddressRaw?.trim()
        ? { contractAddress: localContractAddressRaw.trim() }
        : {}),
    }).catch(() => null);
    if (
      record &&
      record.currentDataHash?.toLowerCase() === latestHash
    ) {
      discovered = {
        chainKey: localChainKeyRaw as ChainId,
        contractDataId: localContractDataIdRaw,
        contractAddress: localContractAddressRaw?.trim() || undefined,
        record,
      };
      params.onProgress?.("✅ Found vault from local cache", `Chain: ${localChainKeyRaw}`);
    }
  }

  // Priority 2: Arweave Index Fallback
  if (!discovered) {
    params.onProgress?.("📄 Checking Arweave index...");
    const indexTxId = await (async () => {
      try {
        const safeVaultId = typeof params.vaultId === "string" ? params.vaultId.trim() : "";
        if (!safeVaultId) return null;
        const response = await fetch("https://arweave.net/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query ($vaultId: String!) {
                transactions(
                  first: 1
                  sort: HEIGHT_DESC
                  tags: [
                    { name: "Doc-Id", values: [$vaultId] }
                    { name: "App-Name", values: ["doc-storage"] }
                    { name: "Type", values: ["bitxen-index"] }
                  ]
                ) {
                  edges { node { id } }
                }
              }
            `,
            variables: { vaultId: safeVaultId },
          }),
        });
        if (!response.ok) return null;
        const data = await response.json().catch(() => ({}));
        const id = data?.data?.transactions?.edges?.[0]?.node?.id;
        return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
      } catch {
        return null;
      }
    })();

    if (indexTxId) {
      const indexText = await fetchArweaveText(indexTxId);
      const indexJson = JSON.parse(indexText) as BitxenIndexV1;
      const contractDataIdRaw = indexJson?.bitxen?.contractDataId;
      const contractDataId =
        typeof contractDataIdRaw === "string" && contractDataIdRaw.startsWith("0x") ? contractDataIdRaw : null;

      const chainKeyRaw = indexJson?.bitxen?.chainKey;
      const numericChainId = typeof indexJson?.bitxen?.chainId === "number" ? indexJson.bitxen.chainId : null;
      const inferredChainKey = numericChainId ? getChainKeyFromNumericChainId(numericChainId) : null;
      const chainKey = chainKeyRaw?.trim() as ChainId || inferredChainKey;

      if (contractDataId && chainKey) {
        const contractAddressRaw = indexJson?.bitxen?.contractAddress;
        const contractAddress = contractAddressRaw?.trim();
        discovered = { chainKey, contractDataId, contractAddress };
        params.onProgress?.("✅ Found vault via Arweave index", `Chain: ${chainKey}`);
      }
    }
  }

  // Priority 3: Hash Scanning
  if (!discovered) {
    params.onProgress?.("🔍 Scanning blockchain for vault...", "Checking multiple chains");
    const chains = getAvailableChains();
    for (const chainKey of chains) {
      for (let versionNum = 1; versionNum <= 5; versionNum += 1) {
        const id = await readBitxenDataIdByHash({
          chainId: chainKey,
          dataHash: latestHash,
          version: BigInt(versionNum),
        }).catch(() => null);
        if (id && id.startsWith("0x") && id.length === 66 && !/^0x0{64}$/i.test(id)) {
          const record = await readBitxenDataRecord({ chainId: chainKey, contractDataId: id }).catch(() => null);
          if (record && record.currentDataHash?.toLowerCase() === latestHash) {
            params.onProgress?.("✅ Found vault", `Chain: ${chainKey}, Version: ${versionNum}`);
            discovered = { chainKey, contractDataId: id, record };
            break;
          }
        }
      }
      if (discovered) break;
    }
  }

  if (!discovered) return null;

  const record =
    discovered.record ??
    (await readBitxenDataRecord({
      chainId: discovered.chainKey,
      contractDataId: discovered.contractDataId,
      ...(discovered.contractAddress ? { contractAddress: discovered.contractAddress } : {}),
    }));

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const releaseDate = record.releaseDate;
  const isTimePassed = releaseDate > 0 && nowSec >= releaseDate;
  const hasEntropy =
    typeof record.releaseEntropy === "string" &&
    record.releaseEntropy !== "0x0000000000000000000000000000000000000000000000000000000000000000";

  const needsFinalization = isTimePassed && !hasEntropy;

  if (!isTimePassed && !record.isReleased && !hasEntropy) {
    const when = new Date(Number(releaseDate) * 1000);
    throw new Error(`This inheritance isn't ready yet. Scheduled: ${when.toLocaleString()}.`);
  }

  params.onProgress?.("📥 Downloading encrypted vault...");
  const finalTxId = parseArweaveTxIdFromStorageURI(record.currentStorageURI);
  if (!finalTxId) throw new Error("Invalid storageURI from contract.");

  const vaultText = await fetchArweaveText(finalTxId);
  const vaultBytes = new TextEncoder().encode(vaultText);
  const payloadHash = await sha256Hex(vaultBytes);
  const expectedHash = record.currentDataHash.toLowerCase();
  const actualHash = ("0x" + payloadHash).toLowerCase();
  if (expectedHash !== actualHash) {
    throw new Error("Vault payload integrity check failed (hash mismatch).");
  }

  params.onProgress?.("🔓 Processing encrypted data...");
  const payloadJson = JSON.parse(vaultText) as Record<string, unknown>;
  const encryptedVault = (payloadJson?.d || payloadJson?.encryptedData) as EncryptedVaultClient;

  if (!encryptedVault) throw new Error("Encrypted payload not found in Arweave document.");

  params.onProgress?.("✅ Vault loaded successfully");

  let contractEncryptedKey: string | null = null;
  let metadataDecrypted: Record<string, unknown> | null = null;

  if (payloadJson?.m && typeof payloadJson.m === "string") {
    try {
      params.onProgress?.("🔓 Decrypting metadata...");
      metadataDecrypted = await decryptMetadataClient(payloadJson.m, params.vaultId);
      const candidate = metadataDecrypted?.["contractEncryptedKey"] || metadataDecrypted?.["encryptedKey"];
      contractEncryptedKey = typeof candidate === "string" ? candidate.trim() : null;
    } catch (e) {
      console.error("Failed to decrypt metadata:", e);
    }
  }

  return {
    encryptedVault,
    metadata: metadataDecrypted,
    contractEncryptedKey,
    releaseEntropy: record.releaseEntropy,
    isReleased: hasEntropy,
    canFinalize: needsFinalization,
    chainId: discovered.chainKey,
    dataId: discovered.contractDataId,
    contractAddress: discovered.contractAddress,
  };
}

export async function discoverBitxenEncryptedKeyForVault(vaultId: string): Promise<{
  chainKey: ChainId;
  contractDataId: string;
  contractEncryptedKey: string;
} | null> {
  const safeVaultId = typeof vaultId === "string" ? vaultId.trim() : "";
  if (!safeVaultId) return null;

  const localVault = getVaultById(safeVaultId);
  const txId =
    localVault?.arweaveTxId?.trim() || await findLatestArweaveDocTxIdForVault(safeVaultId);
  if (!txId) return null;

  const text = await fetchArweaveText(txId);
  const bytes = new TextEncoder().encode(text);
  const latestHash = ("0x" + (await sha256Hex(bytes))).toLowerCase();

  const chains = getAvailableChains();
  for (const chainKey of chains) {
    for (let v = 1; v <= 30; v += 1) {
      const id = await readBitxenDataIdByHash({
        chainId: chainKey,
        dataHash: latestHash,
        version: BigInt(v),
      }).catch(() => null);
      if (id && id.startsWith("0x") && id.length === 66 && !/^0x0{64}$/i.test(id)) {
        const record = await readBitxenDataRecord({ chainId: chainKey, contractDataId: id }).catch(() => null);
        if (record && record.currentDataHash?.toLowerCase() === latestHash) {
          return { chainKey, contractDataId: id, contractEncryptedKey: "" };
        }
      }
    }
  }

  return null;
}

export function extractWrappedKeyRawFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;
  const envelopeEncryptedKey = meta["envelope"]?.["encryptedKey"];
  const candidates = [
    meta["contractEncryptedKey"],
    meta["encryptedKey"],
    meta["wrappedKey"],
    envelopeEncryptedKey,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

export function parseWrappedKeyV1(value: unknown): WrappedKeyV1 {
  if (!value || typeof value !== "object") throw new Error("Invalid encrypted key format.");
  const v = value as Record<string, unknown>;
  if (v["schema"] !== "bitxen-wrapped-key-v1") throw new Error("Unsupported encrypted key schema.");
  if (v["v"] !== 1) throw new Error("Unsupported encrypted key version.");
  if (v["alg"] !== "AES-GCM") throw new Error("Unsupported encrypted key algorithm.");
  if (!v["iv"] || !v["cipherText"] || !v["checksum"]) throw new Error("Invalid encrypted key fields.");
  return v as WrappedKeyV1;
}

// parseFractionKeyShareInfo moved to crypto-utils.ts

export async function verifyFractionKeyCommitmentsIfPresent(params: {
  metadata: unknown;
  fractionKeys: string[];
}): Promise<void> {
  const metadataAny = params.metadata as { fractionKeyCommitments?: unknown } | null | undefined;
  const commitmentConfig = metadataAny?.fractionKeyCommitments as Partial<FractionKeyCommitmentsV1> | undefined;
  if (!commitmentConfig || commitmentConfig.scheme !== "sha256" || commitmentConfig.version !== 1) return;
  if (!commitmentConfig.byShareId) return;

  const byShareId = commitmentConfig.byShareId;
  const encoder = new TextEncoder();
  const seenIds = new Set<number>();

  for (const key of params.fractionKeys) {
    const trimmed = key.trim();
    const info = parseFractionKeyShareInfo(trimmed);
    if (seenIds.has(info.id)) throw new Error("Fraction Keys must be unique.");
    seenIds.add(info.id);

    const expected = byShareId[String(info.id)]?.trim().toLowerCase();
    if (!expected) throw new Error("Incorrect or mismatched Fraction Keys.");

    const actual = (await sha256Hex(encoder.encode(trimmed))).toLowerCase();
    if (actual !== expected) throw new Error("Incorrect or mismatched Fraction Keys.");
  }
}
