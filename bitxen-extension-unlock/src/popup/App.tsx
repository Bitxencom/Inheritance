import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Unlock, Key, FileText, Download, AlertCircle, Loader2, ArrowRight, Video, Music, X, Play, Upload } from 'lucide-react'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { motion, AnimatePresence } from 'motion/react';

// Crypto imports
import { fetchVaultMetadata, fetchEncryptedVault, parseVaultPayloadFromArweave } from '@/lib/arweave';
import { combineSharesClient, normalizeFractionKeysClient, isValidFractionKey, getFractionKeyShareInfo } from '@/lib/shamirClient';
import { decryptVaultPayloadClient, decryptVaultPayloadRawKeyClient, deriveEffectiveAesKeyClient, deriveUnlockKey, unwrapKeyClient, decryptMetadata, recoverWithDrand, type WrappedKeyV1 } from '@/lib/clientVaultCrypto';
import { verifySecurityAnswerEntry } from '@/lib/securityQuestionsClient';
import type { VaultMetadata, DecryptedVaultContent, SecurityQuestionHash, UnlockPolicy, ScoreTier, EncryptedVault } from '@/lib/types';
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import { extractArweaveTxIdFromStorageUri, readBitxenDataRecord, discoverBitxenChainInfo, CHAIN_CONFIG, type ChainId, getChainKeyFromNumericChainId } from '@/lib/bitxen';

// Backend URL for sponsored gas finalization
const FINALIZE_BACKEND_URLS = [
    "http://localhost:7000/api/v1/vaults",  // local dev (nginx)
    "http://localhost:7002/api/v1/vaults",  // local dev (backend direct)
];

async function backendFinalizeRelease(
    vaultId: string,
    blockchainContext?: { chain?: string; contractDataId?: string; contractAddress?: string },
): Promise<{ success: boolean; releaseEntropy?: string; txHash?: string }> {
    const body: Record<string, string> = {};
    if (blockchainContext?.chain) body.chain = blockchainContext.chain;
    if (blockchainContext?.contractDataId) body.contractDataId = blockchainContext.contractDataId;
    if (blockchainContext?.contractAddress) body.contractAddress = blockchainContext.contractAddress;

    for (const baseUrl of FINALIZE_BACKEND_URLS) {
        try {
            const res = await fetch(
                `${baseUrl}/${encodeURIComponent(vaultId)}/finalize-release`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success && data.releaseEntropy) {
                return { success: true, releaseEntropy: data.releaseEntropy, txHash: data.txHash };
            }
            // Non-ok but reachable — don't try other URLs (server rejected, e.g. 403/404)
            if (res.status !== 0) {
                // If 404, the vault might not be in DB — try next URL only if we have blockchain context
                // (another server instance might have different DB state)
                if (res.status === 404 && Object.keys(body).length > 0) continue;
                return { success: false };
            }
        } catch {
            // Unreachable — try next URL
            continue;
        }
    }
    return { success: false };
}

const loadingStates = [
    { text: "Downloading encrypted payload" },
    { text: "Verifying integrity (SHA-256)" },
    { text: "Reconstructing ML-KEM-768 secret key" },
    { text: "Decapsulating shared secret" },
    { text: "Deriving AES vault key" },
    { text: "Decrypting payload" },
    { text: "Importing vault content" },
    { text: "Showing vault content" },
];

const PageWrapper = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.05, y: -10 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={className}
    >
        {children}
    </motion.div>
);

interface MediaItem {
    type: 'video' | 'audio';
    url: string;
    title: string;
}

interface VaultDocument {
    name: string;
    size: number;
    type: string;
    content?: string;
}

const scoreTierToPoints = (tier: ScoreTier): 10 | 20 | 30 => {
    if (tier === "high") return 30;
    if (tier === "medium") return 20;
    return 10;
};

const getPointsForHashEntry = (entry: SecurityQuestionHash | undefined): 10 | 20 | 30 | null => {
    if (!entry) return null;
    if (entry.points === 10 || entry.points === 20 || entry.points === 30) return entry.points;
    if (entry.scoreTier === "low" || entry.scoreTier === "medium" || entry.scoreTier === "high") {
        return scoreTierToPoints(entry.scoreTier);
    }
    return null;
};

const parseUnlockPolicy = (metadata: VaultMetadata): UnlockPolicy | null => {
    const raw = metadata.unlockPolicy as unknown;
    if (!raw || typeof raw !== "object") return null;
    const maybe = raw as Partial<UnlockPolicy>;
    if (
        typeof maybe.policyVersion === "number" &&
        Number.isFinite(maybe.policyVersion) &&
        typeof maybe.requiredCorrect === "number" &&
        Number.isFinite(maybe.requiredCorrect) &&
        typeof maybe.minPoints === "number" &&
        Number.isFinite(maybe.minPoints)
    ) {
        return {
            policyVersion: Math.max(0, Math.floor(maybe.policyVersion)),
            requiredCorrect: Math.max(0, Math.floor(maybe.requiredCorrect)),
            minPoints: Math.max(0, Math.floor(maybe.minPoints)),
        };
    }
    return null;
};

const getDefaultUnlockPolicy = (metadata: VaultMetadata): UnlockPolicy | null => {
    const hasPointsOrTier =
        Array.isArray(metadata.securityQuestionHashes) &&
        metadata.securityQuestionHashes.some((x) => x && (x.points || x.scoreTier));
    if (!hasPointsOrTier) return null;
    return { policyVersion: 1, requiredCorrect: 3, minPoints: 50 };
};

const computeAchieved = (params: {
    correctIndexes: number[];
    hashes: SecurityQuestionHash[];
    requiredCorrect: number;
}): { correctCount: number; points: number | null } => {
    const deduped = Array.from(new Set(params.correctIndexes)).filter(
        (idx) => Number.isFinite(idx) && idx >= 0 && idx < params.hashes.length,
    );
    const points = deduped
        .map((idx) => getPointsForHashEntry(params.hashes[idx]))
        .filter((x): x is 10 | 20 | 30 => x === 10 || x === 20 || x === 30)
        .sort((a, b) => a - b)
        .slice(0, Math.max(0, Math.floor(params.requiredCorrect)));

    if (points.length < Math.max(0, Math.floor(params.requiredCorrect))) {
        return { correctCount: deduped.length, points: null };
    }

    return { correctCount: deduped.length, points: points.reduce((sum, x) => sum + x, 0) };
};

function getCryptoSubtle(): SubtleCrypto {
    if (!globalThis.crypto?.subtle) {
        throw new Error("Web Crypto API not available");
    }
    return globalThis.crypto.subtle;
}

async function sha256HexFromString(value: string): Promise<string> {
    const hash = await getCryptoSubtle().digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

type BitxenDataRecord = Awaited<ReturnType<typeof readBitxenDataRecord>>;

function isBytes32Hex(value: string): boolean {
    return /^0x[0-9a-fA-F]{64}$/.test((value ?? "").trim());
}

async function fetchArweaveText(txId: string): Promise<string> {
    const safe = (txId ?? "").trim();
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

const BITXEN_CHAIN_PREFERENCE: ChainId[] = [
    "bsc",
    "bscTestnet",
    "base",
    "arbitrum",
    "optimism",
    "linea",
    "polygon",
    "eth",
    "sei",
    "avalanche",
    "monad",
];

async function loadVaultFromBitxenContractDataId(contractDataId: string): Promise<{
    chainId: ChainId;
    record: BitxenDataRecord;
    txId: string;
    vaultId: string;
    metadata: VaultMetadata;
    securityQuestions: string[];
    encryptedVault: EncryptedVault;
}> {
    const safeId = (contractDataId ?? "").trim();
    if (!isBytes32Hex(safeId)) {
        throw new Error("Invalid contract data id (expected bytes32 hex).");
    }

    let lastError: unknown = null;

    for (const chainId of BITXEN_CHAIN_PREFERENCE) {
        const record = await readBitxenDataRecord({ chainId, contractDataId: safeId }).catch((e) => {
            lastError = e;
            return null;
        });
        if (!record) continue;

        const txId = extractArweaveTxIdFromStorageUri(record.currentStorageURI);
        if (!txId) {
            throw new Error("Invalid storageURI from contract.");
        }

        let metadata: VaultMetadata = {
            securityQuestionHashes: [],
            unlockPolicy: {
                policyVersion: 1,
                requiredCorrect: 0,
                minPoints: 0,
            },
        };
        let securityQuestions: string[] = [];
        let encryptedVault: any = null;
        let vaultId = "";

        // If released, we can fetch and parse full payload
        if (record.isReleased) {
            const vaultText = await fetchArweaveText(txId);
            const expectedHashRaw = (record.currentDataHash ?? "").toLowerCase();
            const actualHashRaw = ("0x" + (await sha256HexFromString(vaultText))).toLowerCase();
            const expectedComparable = expectedHashRaw.startsWith("0x") ? expectedHashRaw : ("0x" + expectedHashRaw);
            if (expectedComparable !== actualHashRaw) {
                throw new Error("Vault payload integrity check failed (hash mismatch).");
            }

            const payloadJson = JSON.parse(vaultText) as Record<string, unknown>;
            const parsed = await parseVaultPayloadFromArweave({
                payload: payloadJson as any,
                txId,
            });

            metadata = parsed.metadata;
            securityQuestions = parsed.securityQuestions;
            encryptedVault = parsed.encryptedVault;
            vaultId = parsed.vaultId;
        }

        return {
            chainId,
            record,
            txId,
            vaultId: vaultId || `bitxen:${contractDataId}`,
            metadata,
            securityQuestions,
            encryptedVault,
        };
    }

    if (lastError instanceof Error) {
        throw new Error(`Unable to locate vault on supported chains. Last error: ${lastError.message}`);
    }
    throw new Error("Unable to locate vault on supported chains.");
}

const extractWrappedKeyRawFromMetadata = (metadata: VaultMetadata | null | undefined): string | null => {
    if (!metadata || typeof metadata !== "object") return null;
    const envelopeEncryptedKey =
        metadata.envelope && typeof metadata.envelope === "object"
            ? metadata.envelope.encryptedKey
            : null;
    const candidates = [
        metadata.contractEncryptedKey,
        metadata.encryptedKey,
        metadata.wrappedKey,
        envelopeEncryptedKey,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
            return candidate;
        }
    }
    return null;
};

const parseWrappedKeyV1 = (value: unknown): WrappedKeyV1 => {
    if (!value || typeof value !== "object") {
        throw new Error("Invalid encrypted key format.");
    }
    const v = value as Record<string, unknown>;
    if (v["schema"] !== "bitxen-wrapped-key-v1") {
        throw new Error("Unsupported encrypted key schema.");
    }
    if (v["v"] !== 1) {
        throw new Error("Unsupported encrypted key version.");
    }
    if (v["alg"] !== "AES-GCM") {
        throw new Error("Unsupported encrypted key algorithm.");
    }
    if (typeof v["iv"] !== "string" || typeof v["cipherText"] !== "string" || typeof v["checksum"] !== "string") {
        throw new Error("Invalid encrypted key fields.");
    }
    return v as unknown as WrappedKeyV1;
};

async function decryptVaultWithCombinedKey(params: {
    encryptedVault: EncryptedVault;
    metadata: VaultMetadata | null | undefined;
    combinedKey: Uint8Array;
    // Blockchain context for envelope keyMode (Bitxen3)
    releaseEntropy?: string | null;
    contractAddress?: string | null;
    chainId?: number | null;
    onProgress?: (msg: string) => void;
}): Promise<unknown> {
    const { encryptedVault, metadata, combinedKey, releaseEntropy, contractAddress, chainId, onProgress } = params;
    if (encryptedVault.keyMode === "envelope") {
        // Step 1: derive effective AES key from fraction keys (handles PQC if present)
        onProgress?.("Deriving AES key from fraction keys...");
        const attachmentKey = await deriveEffectiveAesKeyClient(encryptedVault, combinedKey);

        // Step 1.5: Drand Time-Lock — if metadata has sealedContractSecret, always recover it
        // (don't rely on effectiveReleaseEntropy from state which may be stale from a previous vault)
        let effectiveReleaseEntropy = releaseEntropy;
        const sealedSecret = metadata?.sealedContractSecret;
        if (typeof sealedSecret === "string" && sealedSecret.length > 0) {
            onProgress?.("Recovering secret from Drand Time-Lock...");
            try {
                const recoveredBytes = await recoverWithDrand(sealedSecret);
                effectiveReleaseEntropy = new TextDecoder().decode(recoveredBytes);
                console.log("[Unlock] Drand secret recovered successfully");
            } catch (e) {
                console.error("[Unlock] Drand recovery failed:", e);
                // Only fatal if we also have no on-chain entropy to fall back on
                if (!effectiveReleaseEntropy || effectiveReleaseEntropy === "0x" + "0".repeat(64)) {
                    throw new Error("Failed to recover time-locked secret. It may not be ready yet or there was a network error.");
                }
                console.warn("[Unlock] Falling back to on-chain releaseEntropy after Drand failure");
            }
        }

        // Step 2: if releaseEntropy is available, derive the unlock key (Bitxen3 envelope)
        // Fall back to contractAddress/blockchainChain stored in Arweave metadata when blockchain discovery failed
        let effectiveContractAddress = contractAddress;
        let effectiveChainId = chainId;
        if (!effectiveContractAddress && typeof metadata?.contractAddress === "string" && metadata.contractAddress.length > 0) {
            effectiveContractAddress = metadata.contractAddress;
            console.log("[Unlock] Using contractAddress from Arweave metadata:", effectiveContractAddress);
        }
        if ((effectiveChainId === null || effectiveChainId === undefined) && typeof metadata?.blockchainChain === "string" && metadata.blockchainChain.length > 0) {
            effectiveChainId = CHAIN_CONFIG[metadata.blockchainChain as ChainId]?.chainId ?? null;
            console.log("[Unlock] Using chainId from Arweave metadata blockchainChain:", metadata.blockchainChain, "→", effectiveChainId);
        }

        let vaultKey = attachmentKey;
        if (
            effectiveReleaseEntropy &&
            effectiveReleaseEntropy !== "0x" + "0".repeat(64) &&
            effectiveContractAddress &&
            effectiveChainId !== null &&
            effectiveChainId !== undefined
        ) {
            onProgress?.("Deriving unlock key from release entropy...");
            // Try with attachmentKey (PQC-derived) first, fall back to raw combinedKey
            try {
                vaultKey = await deriveUnlockKey(attachmentKey, effectiveReleaseEntropy, {
                    contractAddress: effectiveContractAddress,
                    chainId: effectiveChainId,
                });
                console.log("[Unlock] Vault key derived with attachmentKey");
            } catch (attachmentKeyError) {
                console.warn("[Unlock] deriveUnlockKey with attachmentKey failed, trying combinedKey:", attachmentKeyError);
                try {
                    vaultKey = await deriveUnlockKey(combinedKey, effectiveReleaseEntropy, {
                        contractAddress: effectiveContractAddress,
                        chainId: effectiveChainId,
                    });
                    console.log("[Unlock] Vault key derived with combinedKey fallback");
                } catch (combinedKeyError) {
                    console.error("[Unlock] Both key derivations failed:", { attachmentKeyError, combinedKeyError });
                    throw new Error("Failed to derive vault key. Please verify your Fraction Keys are correct.");
                }
            }
        }

        // Step 3: get wrapped key from metadata
        onProgress?.("Unwrapping payload key...");
        const wrappedKeyRaw = extractWrappedKeyRawFromMetadata(metadata);
        if (!wrappedKeyRaw) {
            throw new Error("Encrypted key not found in metadata.");
        }
        let wrappedKey: WrappedKeyV1;
        try {
            wrappedKey = parseWrappedKeyV1(JSON.parse(wrappedKeyRaw) as unknown);
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error("Invalid encrypted key format.");
        }

        // Step 4: unwrap the payload key using vaultKey, then decrypt.
        // Try multiple key variants in order of likelihood:
        //   Attempt 1: vaultKey derived from attachmentKey (PQC shared secret) + releaseEntropy
        //   Attempt 2: vaultKey derived from combinedKey (raw Shamir) + releaseEntropy (edit-wizard path)
        //   Attempt 3: attachmentKey directly, no entropy derivation (legacy vaults without Drand)
        // Ensure AES key is exactly 32 bytes (SHA-256 hash if needed)
        const toAesKey = async (raw: Uint8Array): Promise<Uint8Array> => {
            if (raw.length === 32) return raw;
            const buf = new Uint8Array(raw).buffer as ArrayBuffer;
            return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", buf));
        };

        let payloadKey: Uint8Array;
        try {
            console.log("[Unlock] Trying to unwrap with vaultKey (attachmentKey-derived)");
            payloadKey = await unwrapKeyClient(wrappedKey, vaultKey);
            console.log("[Unlock] Payload key unwrapped with vaultKey");
        } catch (unwrapError) {
            console.warn("[Unlock] Unwrap with vaultKey failed, trying combinedKey fallback:", unwrapError);
            let fallbackVaultKey: Uint8Array;
            if (!effectiveReleaseEntropy || effectiveReleaseEntropy === "0x" + "0".repeat(64)) {
                // No entropy: try attachmentKey directly then hashed-combinedKey
                fallbackVaultKey = await toAesKey(combinedKey);
            } else {
                fallbackVaultKey = await deriveUnlockKey(combinedKey, effectiveReleaseEntropy, {
                    contractAddress: effectiveContractAddress ?? "",
                    chainId: effectiveChainId ?? 0,
                });
            }
            try {
                console.log("[Unlock] Trying to unwrap with fallbackVaultKey (combinedKey-derived)");
                payloadKey = await unwrapKeyClient(wrappedKey, fallbackVaultKey);
                console.log("[Unlock] Payload key unwrapped with fallbackVaultKey");
            } catch (fallbackError) {
                // Last resort: try attachmentKey without entropy derivation
                try {
                    console.log("[Unlock] Trying to unwrap with attachmentKey directly (no entropy)");
                    payloadKey = await unwrapKeyClient(wrappedKey, attachmentKey);
                    console.log("[Unlock] Payload key unwrapped with attachmentKey directly");
                } catch (lastError) {
                    console.error("[Unlock] All unwrap attempts failed:", { unwrapError, fallbackError, lastError });
                    throw new Error("Failed to decrypt vault payload. Please verify your Fraction Keys are correct.");
                }
            }
        }

        onProgress?.("Decrypting vault content...");
        // Use decryptVaultPayloadRawKeyClient: payloadKey is already the raw AES key,
        // no PQC re-processing needed (pqcCipherText was used to derive attachmentKey above)
        return await decryptVaultPayloadRawKeyClient(encryptedVault, payloadKey);
    }
    return await decryptVaultPayloadClient(encryptedVault, combinedKey);
}

export default function App() {
    // Load initial state from localStorage if available
    const [step, setStep] = useState(() => parseInt(localStorage.getItem('step') || '1'));
    const [loading, setLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: ID
    const [vaultId, setVaultId] = useState(() => localStorage.getItem('vaultId') || "");
    const [arweaveTxId, setArweaveTxId] = useState(() => localStorage.getItem('arweaveTxId') || "");

    // Step 2: Answers
    const [currentQIndex, setCurrentQIndex] = useState(() => parseInt(localStorage.getItem('currentQIndex') || '0'));
    const [answerInput, setAnswerInput] = useState("");
    const [securityQuestions, setSecurityQuestions] = useState<string[]>([]);
    const [securityQuestionHashes, setSecurityQuestionHashes] = useState<SecurityQuestionHash[]>([]);
    const [unlockPolicy, setUnlockPolicy] = useState<UnlockPolicy | null>(null);
    const [securityCorrectIndexes, setSecurityCorrectIndexes] = useState<number[]>([]);
    const [resolvedTxId, setResolvedTxId] = useState<string>("");
    const [backupFileLoaded, setBackupFileLoaded] = useState(false);
    const [selectedBackupFileName, setSelectedBackupFileName] = useState<string | null>(null);
    const backupFileInputRef = useRef<HTMLInputElement | null>(null);

    // Blockchain context (from Bitxen contract) – needed for envelope keyMode decryption
    const [releaseEntropy, setReleaseEntropy] = useState<string | null>(() => localStorage.getItem('releaseEntropy') || null);
    const [blockchainContractAddress, setBlockchainContractAddress] = useState<string | null>(() => localStorage.getItem('blockchainContractAddress') || null);
    const [blockchainChainId, setBlockchainChainId] = useState<number | null>(() => {
        const saved = localStorage.getItem('blockchainChainId');
        return saved ? parseInt(saved, 10) : null;
    });

    // Step 3: Fraction Keys
    const [keys, setKeys] = useState<{ 1: string, 2: string, 3: string }>(() => {
        const saved = localStorage.getItem('keys');
        return saved ? JSON.parse(saved) : { 1: "", 2: "", 3: "" };
    });
    const [currentKeyStep, setCurrentKeyStep] = useState<1 | 2 | 3>(() => parseInt(localStorage.getItem('currentKeyStep') || '1') as 1 | 2 | 3);
    const [fractionKeysVerified, setFractionKeysVerified] = useState(false);

    const [blockchainContractDataId, setBlockchainContractDataId] = useState<string | null>(() => localStorage.getItem('blockchainContractDataId') || null);
    const [needsFinalize, setNeedsFinalize] = useState(() => localStorage.getItem('needsFinalize') === 'true');
    const [isWaitingFinalize, setIsWaitingFinalize] = useState(false);
    const finalizePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Step 5: Vault Content and Exit Modal
    const [vaultContent, setVaultContent] = useState<DecryptedVaultContent | null>(null);
    const [_vaultMetadata, setVaultMetadata] = useState<VaultMetadata | null>(null);
    const [showExitModal, setShowExitModal] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);

    // Persistence Effects
    useEffect(() => localStorage.setItem('step', step.toString()), [step]);
    useEffect(() => localStorage.setItem('vaultId', vaultId), [vaultId]);
    useEffect(() => localStorage.setItem('arweaveTxId', arweaveTxId), [arweaveTxId]);
    useEffect(() => localStorage.setItem('currentQIndex', currentQIndex.toString()), [currentQIndex]);
    useEffect(() => localStorage.setItem('keys', JSON.stringify(keys)), [keys]);
    useEffect(() => localStorage.setItem('currentKeyStep', currentKeyStep.toString()), [currentKeyStep]);
    useEffect(() => {
        if (releaseEntropy) localStorage.setItem('releaseEntropy', releaseEntropy);
        else localStorage.removeItem('releaseEntropy');
    }, [releaseEntropy]);
    useEffect(() => {
        if (blockchainContractDataId) localStorage.setItem('blockchainContractDataId', blockchainContractDataId);
        else localStorage.removeItem('blockchainContractDataId');
    }, [blockchainContractDataId]);
    useEffect(() => localStorage.setItem('needsFinalize', needsFinalize.toString()), [needsFinalize]);
    useEffect(() => {
        return () => {
            if (finalizePollingRef.current) clearInterval(finalizePollingRef.current);
        };
    }, []);
    useEffect(() => {
        if (blockchainChainId !== null) localStorage.setItem('blockchainChainId', blockchainChainId.toString());
        else localStorage.removeItem('blockchainChainId');
    }, [blockchainChainId]);
    useEffect(() => {
        if (blockchainContractAddress) localStorage.setItem('blockchainContractAddress', blockchainContractAddress);
        else localStorage.removeItem('blockchainContractAddress');
    }, [blockchainContractAddress]);

    useEffect(() => {
        const localStorageStep = parseInt(localStorage.getItem('step') || '1');
        if (localStorageStep >= 4 && vaultId && !releaseEntropy) {
            console.log("[Unlock] Step 4 or higher detected with missing releaseEntropy, attempting recovery...");
            // Non-blocking recovery
            (async () => {
                try {
                    const explicitTxId = localStorage.getItem('arweaveTxId') || undefined;
                    const result = await fetchVaultMetadata(vaultId, explicitTxId);
                    const chainKeyHint =
                        typeof result.metadata.blockchainChain === "string" && result.metadata.blockchainChain.trim().length > 0
                            ? (result.metadata.blockchainChain.trim() as ChainId)
                            : null;
                    const discoveredChain = await discoverBitxenChainInfo({
                        vaultId: result.vaultId,
                        arweaveTxId: result.txId || undefined,
                        chainKeyHint,
                        decryptMetadataFn: decryptMetadata,
                    });
                    if (discoveredChain) {
                        const chainConfig = CHAIN_CONFIG[discoveredChain.chainKey];
                        const contractAddress = discoveredChain.contractAddress ?? chainConfig?.contractAddress;
                        const record = await readBitxenDataRecord({
                            chainId: discoveredChain.chainKey,
                            contractDataId: discoveredChain.contractDataId,
                            contractAddress,
                        });
                        const entropy = record.releaseEntropy;
                        const isValidEntropy =
                            typeof entropy === "string" &&
                            entropy !== "0x" + "0".repeat(64) &&
                            entropy.length > 0;
                        if (isValidEntropy) {
                            setReleaseEntropy(entropy);
                        }
                        if (!blockchainChainId) setBlockchainChainId(chainConfig?.chainId ?? null);
                        if (!blockchainContractAddress) setBlockchainContractAddress(contractAddress ?? null);
                    }
                } catch (e) {
                    console.warn("[Unlock] Context recovery failed:", e);
                }
            })();
        }
    }, [step, vaultId, releaseEntropy]);

    // --- Handlers ---
    const parseBackupFileContent = (content: string) => {
        const normalized = (content ?? "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();

        if (!normalized) {
            throw new Error("The backup file is empty or invalid.");
        }

        if (
            normalized.length < 300 &&
            !normalized.includes("\n") &&
            (normalized.includes("/") || normalized.includes("\\")) &&
            /vault-backup-.*\.txt/i.test(normalized)
        ) {
            throw new Error("Invalid backup file. Please select the .txt file itself (not a file path).");
        }

        try {
            const parsed = JSON.parse(normalized) as unknown;
            if (
                parsed &&
                typeof parsed === "object" &&
                "vaultId" in parsed &&
                "fractionKeys" in parsed
            ) {
                const vaultId =
                    typeof (parsed as { vaultId?: unknown }).vaultId === "string"
                        ? (parsed as { vaultId: string }).vaultId.trim()
                        : "";
                const fractionKeysRaw = (parsed as { fractionKeys?: unknown }).fractionKeys;
                const fractionKeys = Array.isArray(fractionKeysRaw)
                    ? fractionKeysRaw.filter((k): k is string => typeof k === "string").map((k) => k.trim())
                    : [];

                if (vaultId && fractionKeys.length >= 3) {
                    return { vaultIdFromFile: vaultId, validKeys: fractionKeys.slice(0, 3) };
                }
            }
        } catch {
        }

        const uuidMatch = normalized.match(
            /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/
        );
        const vaultIdFromFile =
            normalized.match(/VAULT ID[\s\S]*?\n=+\s*\n([0-9a-fA-F-]{32,})/i)?.[1]?.trim() ||
            uuidMatch?.[0]?.trim() ||
            "";

        if (!vaultIdFromFile) {
            throw new Error("Please upload a correct backup file.");
        }

        const fractionKeyMatches = [
            ...normalized.matchAll(/\[Key #\d+\]\s*\n([0-9a-fA-F]+)\s*\n/g),
        ];
        const parsedKeysFromSections = fractionKeyMatches.map((match) => match[1].trim());
        const fallbackHexMatches = [...normalized.matchAll(/\b[0-9a-fA-F]{40,}\b/g)].map((m) =>
            m[0].trim()
        );
        const candidates = (parsedKeysFromSections.length > 0 ? parsedKeysFromSections : fallbackHexMatches)
            .filter((k) => /^[0-9a-fA-F]+$/.test(k))
            .filter((k) => k.length >= 40);

        const seen = new Set<string>();
        const validKeys = candidates.filter((k) => {
            const normalizedKey = k.toLowerCase();
            if (seen.has(normalizedKey)) return false;
            seen.add(normalizedKey);
            return true;
        }).slice(0, 3);

        if (validKeys.length < 3) {
            throw new Error("At least 3 valid Fraction Keys are required from the backup file.");
        }

        return { vaultIdFromFile, validKeys };
    };

    const handleBackupFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === "string") {
                try {
                    const { vaultIdFromFile, validKeys } = parseBackupFileContent(result);
                    setVaultId(vaultIdFromFile);
                    setKeys({ 1: validKeys[0], 2: validKeys[1], 3: validKeys[2] });
                    setCurrentKeyStep(3);
                    setBackupFileLoaded(true);
                    setSelectedBackupFileName(file.name);
                    setError(null);
                } catch (err) {
                    setBackupFileLoaded(false);
                    setError(err instanceof Error ? err.message : "Failed to read the backup file.");
                }
            }
            if (backupFileInputRef.current) {
                backupFileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const handleClearBackupFile = () => {
        setSelectedBackupFileName(null);
        setBackupFileLoaded(false);
        setVaultId("");
        setKeys({ 1: "", 2: "", 3: "" });
        setCurrentKeyStep(1);
        setError(null);
        if (backupFileInputRef.current) {
            backupFileInputRef.current.value = "";
        }
    };

    const handleUnlock = async () => {
        setIsVerifying(true);
        setError(null);

        // Reset stale blockchain context so previous vault's entropy doesn't bleed into this unlock
        setReleaseEntropy(null);
        setBlockchainContractAddress(null);
        setBlockchainChainId(null);
        setBlockchainContractDataId(null);
        setNeedsFinalize(false);

        try {
            const inputId = vaultId.trim() || arweaveTxId.trim();
            if (!inputId) {
                throw new Error("Please enter your Vault ID");
            }

            const explicitTxId = arweaveTxId.trim() || undefined;
            const shouldUseBitxenContract = !explicitTxId && isBytes32Hex(inputId);

            const result = shouldUseBitxenContract
                ? await (async () => {
                    const loaded = await loadVaultFromBitxenContractDataId(inputId);

                    // Save blockchain context for envelope keyMode decryption (Bitxen3)
                    const entropy = loaded.record.releaseEntropy;
                    const isValidEntropy =
                        typeof entropy === "string" &&
                        entropy !== "0x" + "0".repeat(64) &&
                        entropy.length > 0;
                    setReleaseEntropy(isValidEntropy ? entropy : null);
                    setBlockchainChainId(CHAIN_CONFIG[loaded.chainId]?.chainId ?? null);
                    setBlockchainContractAddress(CHAIN_CONFIG[loaded.chainId]?.contractAddress ?? null);

                    return {
                        vaultId: loaded.vaultId,
                        txId: loaded.txId,
                        metadata: loaded.metadata,
                        securityQuestions: loaded.securityQuestions,
                        encryptedVault: loaded.encryptedVault,
                        bitxenRecord: loaded.record,
                        bitxenChainKey: loaded.chainId,
                    };
                })()
                : { ...(await fetchVaultMetadata(inputId, explicitTxId)), bitxenRecord: undefined, bitxenChainKey: undefined as ChainId | undefined };

            // Store results
            setResolvedTxId(result.txId);
            setVaultMetadata(result.metadata);
            setSecurityQuestions(result.securityQuestions);
            setSecurityQuestionHashes(result.metadata.securityQuestionHashes || []);
            setCurrentQIndex(0);
            setSecurityCorrectIndexes([]);
            const policy = parseUnlockPolicy(result.metadata) || getDefaultUnlockPolicy(result.metadata);
            setUnlockPolicy(policy);

            // If vault ID was not explicitly set, use the one from Arweave
            if (!vaultId || shouldUseBitxenContract) {
                setVaultId(result.vaultId);
            }
            if (!explicitTxId) {
                setArweaveTxId(result.txId);
            }

            // For Arweave path: also try to discover blockchain context (contractDataId + chainKey)
            // This is needed when user uses UUID from backup file instead of bytes32 contractDataId
            if (!shouldUseBitxenContract) {
                try {
                    const chainKeyHint =
                        typeof result.metadata.blockchainChain === "string" && result.metadata.blockchainChain.trim().length > 0
                            ? (result.metadata.blockchainChain.trim() as ChainId)
                            : null;
                    const discoveredChain = await discoverBitxenChainInfo({
                        vaultId: result.vaultId,
                        arweaveTxId: result.txId,
                        chainKeyHint,
                        decryptMetadataFn: decryptMetadata,
                    });
                    if (discoveredChain) {
                        const chainConfig = CHAIN_CONFIG[discoveredChain.chainKey];
                        // Fetch blockchain record to get releaseEntropy
                        const contractAddress = discoveredChain.contractAddress ?? chainConfig?.contractAddress;
                        const record = await readBitxenDataRecord({
                            chainId: discoveredChain.chainKey,
                            contractDataId: discoveredChain.contractDataId,
                            contractAddress,
                        });
                        const entropy = record.releaseEntropy;
                        const isValidEntropy =
                            typeof entropy === "string" &&
                            entropy !== "0x" + "0".repeat(64) &&
                            entropy.length > 0;
                        console.log("[handleUnlock] Discovered blockchain context:", {
                            chainKey: discoveredChain.chainKey,
                            contractDataId: discoveredChain.contractDataId,
                            releaseEntropy: entropy,
                            isValidEntropy,
                        });
                        setBlockchainChainId(chainConfig?.chainId ?? null);
                        setBlockchainContractAddress(contractAddress ?? null);

                        if (isValidEntropy) {
                            setReleaseEntropy(entropy);
                        } else {
                            // Entropy not yet on-chain — check if release date has passed
                            const nowSec = BigInt(Math.floor(Date.now() / 1000));
                            const releaseDate = record.releaseDate as bigint;
                            const isTimePassed = releaseDate > BigInt(0) && nowSec >= releaseDate;
                            if (isTimePassed) {
                                // Try backend-sponsored finalize before MetaMask
                                const backendResult = await backendFinalizeRelease(result.vaultId, {
                                    chain: discoveredChain.chainKey,
                                    contractDataId: discoveredChain.contractDataId,
                                    contractAddress: contractAddress ?? undefined,
                                });
                                if (backendResult.success && backendResult.releaseEntropy) {
                                    setReleaseEntropy(backendResult.releaseEntropy);
                                } else {
                                    // If vault uses Drand time-lock, skip finalize — Drand handles decryption
                                    const hasDrand = typeof result.metadata.sealedContractSecret === "string" && result.metadata.sealedContractSecret.length > 0;
                                    if (!hasDrand) {
                                        setBlockchainContractDataId(discoveredChain.contractDataId);
                                        setNeedsFinalize(true);
                                    }
                                    console.log("[handleUnlock] Skipping finalization — vault uses Drand time-lock");
                                }
                            }
                        }
                    } else {
                        console.warn("[handleUnlock] Could not discover blockchain context (non-Bitxen vault or no index)");
                    }
                } catch (e) {
                    // Discovery failure is non-fatal — vault may not use envelope keyMode
                    console.warn("[handleUnlock] Blockchain discovery failed (non-fatal):", e);
                }
            }

            // If Bitxen contract, check finalization status
            if (shouldUseBitxenContract && result.bitxenRecord) {
                setBlockchainContractDataId(inputId);
                if (!result.bitxenRecord.isReleased) {
                    // Try backend-sponsored finalize with blockchain context
                    const backendResult = await backendFinalizeRelease(result.vaultId, {
                        chain: result.bitxenChainKey,
                        contractDataId: inputId,
                        contractAddress: CHAIN_CONFIG[result.bitxenChainKey!]?.contractAddress,
                    });
                    if (backendResult.success && backendResult.releaseEntropy) {
                        setReleaseEntropy(backendResult.releaseEntropy);
                    } else {
                        // If vault uses Drand time-lock, skip finalize — Drand handles decryption
                        const hasDrand = typeof result.metadata.sealedContractSecret === "string" && result.metadata.sealedContractSecret.length > 0;
                        if (!hasDrand) {
                            setNeedsFinalize(true);
                        }
                        console.log("[handleUnlock] Skipping finalization — vault uses Drand time-lock");
                    }
                }
            }

            const hasHashes = (result.metadata.securityQuestionHashes?.length || 0) > 0;

            // If no verifiable security questions, skip to step 3
            if (!hasHashes || result.securityQuestions.length === 0) {
                if (needsFinalize && backupFileLoaded) {
                    setStep(10); // Finalize before decrypt
                } else {
                    setStep(backupFileLoaded ? 4 : 3);
                }
            } else {
                setStep(2);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch vault. Please check your ID.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleFinalize = async () => {
        setIsVerifying(true);
        setError(null);
        try {
            // Try backend-sponsored finalize first — pass blockchain context for vaults not in backend DB
            if (vaultId) {
                const chainKey = blockchainChainId ? getChainKeyFromNumericChainId(blockchainChainId) : null;
                const backendResult = await backendFinalizeRelease(vaultId, {
                    chain: chainKey ?? undefined,
                    contractDataId: blockchainContractDataId ?? undefined,
                    contractAddress: blockchainContractAddress ?? undefined,
                });
                if (backendResult.success && backendResult.releaseEntropy) {
                    setReleaseEntropy(backendResult.releaseEntropy);
                    setNeedsFinalize(false);
                    setStep(4);
                    return;
                }
            }

            // Backend failed — check if vault uses Drand (can skip finalization)
            const hasDrand = typeof _vaultMetadata?.sealedContractSecret === "string" && _vaultMetadata.sealedContractSecret.length > 0;
            if (hasDrand) {
                console.log("[handleFinalize] Skipping MetaMask — vault uses Drand time-lock");
                setNeedsFinalize(false);
                setStep(4);
                return;
            }

            // Backend failed, no Drand — open the Bitxen frontend in a new tab for MetaMask finalization.
            // window.ethereum is not available in chrome-extension:// pages, but IS available in https:// tabs.
            if (!blockchainContractDataId) {
                throw new Error("Contract Data ID not found. Cannot finalize via MetaMask.");
            }

            // Clear any stale finalize result from previous attempts
            await chrome.storage.local.remove("extension-finalize-result");

            const extId = chrome.runtime.id;
            const chainKey = blockchainChainId ? getChainKeyFromNumericChainId(blockchainChainId) : null;
            const params = new URLSearchParams({
                contractDataId: blockchainContractDataId,
                vaultId: vaultId,
                extId,
                ...(chainKey ? { chainKey } : {}),
                ...(blockchainContractAddress ? { contractAddress: blockchainContractAddress } : {}),
            });

            const finalizeUrl = `http://localhost:7001/extension-finalize?${params.toString()}`;
            await chrome.tabs.create({ url: finalizeUrl });

            // Start polling chrome.storage.local for the result sent back by the website
            setIsWaitingFinalize(true);
            setIsVerifying(false);

            if (finalizePollingRef.current) clearInterval(finalizePollingRef.current);
            finalizePollingRef.current = setInterval(async () => {
                const stored = await chrome.storage.local.get("extension-finalize-result");
                const result = stored["extension-finalize-result"] as {
                    success: boolean;
                    releaseEntropy?: string | null;
                    error?: string | null;
                    timestamp: number;
                } | undefined;

                if (!result) return;

                // Ignore stale results older than 10 minutes
                if (Date.now() - result.timestamp > 10 * 60 * 1000) {
                    await chrome.storage.local.remove("extension-finalize-result");
                    clearInterval(finalizePollingRef.current!);
                    finalizePollingRef.current = null;
                    setIsWaitingFinalize(false);
                    setError("Finalization timed out. Please try again.");
                    return;
                }

                clearInterval(finalizePollingRef.current!);
                finalizePollingRef.current = null;
                await chrome.storage.local.remove("extension-finalize-result");

                if (result.success && result.releaseEntropy) {
                    setReleaseEntropy(result.releaseEntropy);
                    setNeedsFinalize(false);
                    setIsWaitingFinalize(false);
                    setStep(4);
                } else {
                    setIsWaitingFinalize(false);
                    setError(result.error ?? "Finalization failed. Please try again.");
                }
            }, 1500);

            return; // don't hit finally setIsVerifying(false) — already done above
        } catch (err) {
            setError(err instanceof Error ? err.message : "Finalization failed");
        } finally {
            setIsVerifying(false);
        }
    };


    const handleAnswerSubmit = async () => {
        setIsVerifying(true);
        setError(null);

        try {
            const entry = securityQuestionHashes[currentQIndex];
            const isValid = await verifySecurityAnswerEntry(answerInput.trim(), entry);

            if (isValid) {
                setAnswerInput(""); // Clear input on success
                setSecurityCorrectIndexes((prev) => (prev.includes(currentQIndex) ? prev : [...prev, currentQIndex]));
            }

            const effectivePolicy = unlockPolicy || { policyVersion: 0, requiredCorrect: 3, minPoints: 0 };
            const achievedNext = computeAchieved({
                correctIndexes: isValid
                    ? Array.from(new Set([...securityCorrectIndexes, currentQIndex]))
                    : securityCorrectIndexes,
                hashes: securityQuestionHashes,
                requiredCorrect: effectivePolicy.requiredCorrect,
            });

            const meetsCorrect = achievedNext.correctCount >= effectivePolicy.requiredCorrect;
            let shouldEnforcePoints = false;
            let meetsPoints = true;
            if (unlockPolicy && typeof unlockPolicy.minPoints === "number" && achievedNext.points !== null) {
                shouldEnforcePoints = true;
                meetsPoints = achievedNext.points >= unlockPolicy.minPoints;
            }

            if (meetsCorrect && meetsPoints) {
                if (needsFinalize && backupFileLoaded) {
                    setStep(10); // Finalize before decrypt
                } else {
                    setStep(backupFileLoaded ? 4 : 3);
                }
                return;
            } else {
                if (!isValid) {
                    setError("Incorrect answer. Please continue.");
                } else if (shouldEnforcePoints && achievedNext.points !== null) {
                    const minPointsTarget = unlockPolicy?.minPoints ?? effectivePolicy.minPoints;
                    setError(
                        `Verified ${Math.min(achievedNext.correctCount, effectivePolicy.requiredCorrect)}/${effectivePolicy.requiredCorrect}. Points: ${achievedNext.points}/${minPointsTarget}.`,
                    );
                } else {
                    setError(
                        `Verified ${Math.min(achievedNext.correctCount, effectivePolicy.requiredCorrect)}/${effectivePolicy.requiredCorrect}.`,
                    );
                }
            }

            setAnswerInput("");
            if (securityQuestions.length > 0) {
                setCurrentQIndex((prev) => (prev + 1) % securityQuestions.length);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed.");
        } finally {
            setIsVerifying(false);
        }
    };

    const updateKey = (idx: 1 | 2 | 3, val: string) => {
        if (fractionKeysVerified) {
            setFractionKeysVerified(false);
            setVaultContent(null);
            setVaultMetadata(null);
        }
        setKeys(prev => ({ ...prev, [idx]: val }));
    };

    const handleKeySubmit = async () => {
        setIsVerifying(true);
        setError(null);

        const currentKey = keys[currentKeyStep].trim();
        if (currentKey.length !== 4835 && currentKey.length !== 4805) {
            setError("Invalid Fraction Key length");
            setIsVerifying(false);
            return;
        }

        if (!isValidFractionKey(currentKey)) {
            setError("Invalid Fraction Key format. Please check and try again.");
            setIsVerifying(false);
            return;
        }

        if (currentKeyStep >= 2) {
            const prevKey1 = keys[1].trim();
            if (prevKey1 && currentKey === prevKey1) {
                setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
                setIsVerifying(false);
                return;
            }
        }

        if (currentKeyStep >= 3) {
            const prevKey2 = keys[2].trim();
            if (prevKey2 && currentKey === prevKey2) {
                setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
                setIsVerifying(false);
                return;
            }
        }

        const currentInfo = getFractionKeyShareInfo(currentKey);
        if (!currentInfo) {
            setError("Invalid Fraction Key format. Please check and try again.");
            setIsVerifying(false);
            return;
        }

        let metadataForCommitment = _vaultMetadata;
        if (!metadataForCommitment && vaultId.trim()) {
            try {
                const vaultData = await fetchEncryptedVault(vaultId.trim(), resolvedTxId.trim() || undefined);
                metadataForCommitment = vaultData.metadata;
                setVaultMetadata(vaultData.metadata);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch vault for verification.");
                setIsVerifying(false);
                return;
            }
        }

        const commitmentConfig = metadataForCommitment?.fractionKeyCommitments;
        const commitmentByShareId =
            commitmentConfig?.scheme === "sha256" && commitmentConfig.version === 1 ? commitmentConfig.byShareId : null;

        if (commitmentByShareId && Object.keys(commitmentByShareId).length > 0) {
            const expected = commitmentByShareId[String(currentInfo.id)];
            if (!expected) {
                setError("Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.");
                setIsVerifying(false);
                return;
            }
            const actual = await sha256HexFromString(currentKey);
            if (actual !== expected.toLowerCase()) {
                setError("Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.");
                setIsVerifying(false);
                return;
            }
        }

        if (currentKeyStep >= 2) {
            const prevKey1 = keys[1].trim();
            const prevInfo1 = prevKey1 ? getFractionKeyShareInfo(prevKey1) : null;
            if (prevInfo1 && prevInfo1.bits !== currentInfo.bits) {
                setError("Fraction Keys do not match. Please ensure all keys come from the same backup.");
                setIsVerifying(false);
                return;
            }
            if (prevInfo1 && prevInfo1.id === currentInfo.id) {
                setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
                setIsVerifying(false);
                return;
            }
        }

        if (currentKeyStep >= 3) {
            const prevKey2 = keys[2].trim();
            const prevInfo2 = prevKey2 ? getFractionKeyShareInfo(prevKey2) : null;
            if (prevInfo2 && prevInfo2.bits !== currentInfo.bits) {
                setError("Fraction Keys do not match. Please ensure all keys come from the same backup.");
                setIsVerifying(false);
                return;
            }
            if (prevInfo2 && prevInfo2.id === currentInfo.id) {
                setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
                setIsVerifying(false);
                return;
            }
        }

        if (currentKeyStep < 3) {
            setIsVerifying(false);
            setCurrentKeyStep((prev) => (prev + 1) as 1 | 2 | 3);
            return;
        }

        const allKeys: Array<{ idx: 1 | 2 | 3; value: string }> = [
            { idx: 1, value: keys[1].trim() },
            { idx: 2, value: keys[2].trim() },
            { idx: 3, value: keys[3].trim() },
        ];

        const firstInvalid = allKeys.find((k) => !isValidFractionKey(k.value));
        if (firstInvalid) {
            if (firstInvalid.value.length !== 4835 && firstInvalid.value.length !== 4805) {
                setError("Invalid Fraction Key length");
            } else {
                setError("Invalid Fraction Key format. Please check and try again.");
            }
            setCurrentKeyStep(firstInvalid.idx);
            setIsVerifying(false);
            return;
        }

        const allValues = allKeys.map((k) => k.value);
        const uniqueValues = new Set(allValues);
        if (uniqueValues.size !== allValues.length) {
            const a = allValues[0];
            const b = allValues[1];
            const c = allValues[2];
            const dupIdx: 1 | 2 | 3 =
                a === b ? 2 : a === c ? 3 : b === c ? 3 : 3;
            setCurrentKeyStep(dupIdx);
            setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
            setIsVerifying(false);
            return;
        }

        const shareInfos = allKeys.map((k) => ({ idx: k.idx, info: getFractionKeyShareInfo(k.value) }));
        const firstMissingInfo = shareInfos.find((x) => !x.info);
        if (firstMissingInfo) {
            setCurrentKeyStep(firstMissingInfo.idx);
            setError("Invalid Fraction Key format. Please check and try again.");
            setIsVerifying(false);
            return;
        }

        const bitsSet = new Set(shareInfos.map((x) => (x.info as { bits: number; id: number }).bits));
        if (bitsSet.size !== 1) {
            setError("Fraction Keys do not match. Please ensure all keys come from the same backup.");
            setIsVerifying(false);
            return;
        }

        const ids = shareInfos.map((x) => (x.info as { bits: number; id: number }).id);
        const idsSet = new Set(ids);
        if (idsSet.size !== ids.length) {
            setError("Each Fraction Key must be unique. Please do not enter the same key twice.");
            setIsVerifying(false);
            return;
        }

        try {
            const vaultData = await fetchEncryptedVault(vaultId, resolvedTxId);
            const commitmentConfig = vaultData.metadata?.fractionKeyCommitments;
            const commitmentByShareId =
                commitmentConfig?.scheme === "sha256" && commitmentConfig.version === 1 ? commitmentConfig.byShareId : null;

            if (commitmentByShareId && Object.keys(commitmentByShareId).length > 0) {
                for (const keyEntry of allKeys) {
                    const info = getFractionKeyShareInfo(keyEntry.value);
                    if (!info) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error("Invalid Fraction Key format. Please check and try again.");
                    }
                    const expected = commitmentByShareId[String(info.id)];
                    if (!expected) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error(
                            "Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.",
                        );
                    }
                    const actual = await sha256HexFromString(keyEntry.value);
                    if (actual !== expected.toLowerCase()) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error(
                            "Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.",
                        );
                    }
                }
            }

            const keysArray = normalizeFractionKeysClient(allKeys.map((k) => k.value));
            if (keysArray.length < 3) {
                throw new Error("Please provide at least 3 valid Fraction Keys.");
            }

            // If finalization is still needed, skip decryption (releaseEntropy not available yet)
            // Just validate keys and go to finalize step; step 4 will decrypt after finalization
            if (needsFinalize) {
                setFractionKeysVerified(true);
                setVaultMetadata(vaultData.metadata);
                setStep(10);
                setIsVerifying(false);
                return;
            }

            const combinedKey = combineSharesClient(keysArray);
            const decrypted = await decryptVaultWithCombinedKey({
                encryptedVault: vaultData.encryptedVault,
                metadata: vaultData.metadata,
                combinedKey,
                releaseEntropy,
                contractAddress: blockchainContractAddress,
                chainId: blockchainChainId,
            });

            setVaultContent(decrypted as DecryptedVaultContent);
            setVaultMetadata(vaultData.metadata);
            setFractionKeysVerified(true);
            setStep(4);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Decryption failed. Please verify your Fraction Keys.",
            );
        } finally {
            setIsVerifying(false);
        }
    };

    const handleFinalProcess = async () => {
        if (fractionKeysVerified && vaultContent) {
            // Already decrypted, just show animation then go to step 5
            setLoading(true);
            const totalDuration = 1000 * loadingStates.length;
            setTimeout(() => {
                setLoading(false);
                setStep(5);
            }, totalDuration);
            return;
        }

        // Decrypt first WITHOUT animation — show error immediately if it fails
        try {
            // DEBUG: log blockchain context state
            console.log('[Unlock] State debug:', {
                vaultId,
                resolvedTxId,
                releaseEntropy,
                blockchainChainId,
                blockchainContractAddress,
                fractionKeysVerified,
            });

            // Fetch encrypted vault
            const vaultData = await fetchEncryptedVault(vaultId, resolvedTxId);
            console.log('[Unlock] encryptedVault keyMode:', vaultData.encryptedVault?.keyMode, '| alg:', vaultData.encryptedVault?.alg, '| hasPqc:', !!vaultData.encryptedVault?.pqcCipherText, '| metadata.encryptionVersion:', vaultData.metadata?.encryptionVersion);

            const commitmentConfig = vaultData.metadata?.fractionKeyCommitments;
            const commitmentByShareId =
                commitmentConfig?.scheme === "sha256" && commitmentConfig.version === 1 ? commitmentConfig.byShareId : null;

            const allKeys: Array<{ idx: 1 | 2 | 3; value: string }> = [
                { idx: 1, value: keys[1].trim() },
                { idx: 2, value: keys[2].trim() },
                { idx: 3, value: keys[3].trim() },
            ];

            const firstInvalid = allKeys.find((k) => !isValidFractionKey(k.value));
            if (firstInvalid) {
                setCurrentKeyStep(firstInvalid.idx);
                throw new Error("Invalid Fraction Key format. Please check and try again.");
            }

            const allValues = allKeys.map((k) => k.value);
            const uniqueValues = new Set(allValues);
            if (uniqueValues.size !== allValues.length) {
                const a = allValues[0];
                const b = allValues[1];
                const c = allValues[2];
                const dupIdx: 1 | 2 | 3 =
                    a === b ? 2 : a === c ? 3 : b === c ? 3 : 3;
                setCurrentKeyStep(dupIdx);
                throw new Error("Each Fraction Key must be unique. Please do not enter the same key twice.");
            }

            const shareInfos = allKeys.map((k) => ({ idx: k.idx, info: getFractionKeyShareInfo(k.value) }));
            const firstMissingInfo = shareInfos.find((x) => !x.info);
            if (firstMissingInfo) {
                setCurrentKeyStep(firstMissingInfo.idx);
                throw new Error("Invalid Fraction Key format. Please check and try again.");
            }

            const bitsSet = new Set(shareInfos.map((x) => (x.info as { bits: number; id: number }).bits));
            if (bitsSet.size !== 1) {
                throw new Error("Fraction Keys do not match. Please ensure all keys come from the same backup.");
            }

            const ids = shareInfos.map((x) => (x.info as { bits: number; id: number }).id);
            const idsSet = new Set(ids);
            if (idsSet.size !== ids.length) {
                throw new Error("Each Fraction Key must be unique. Please do not enter the same key twice.");
            }

            if (commitmentByShareId && Object.keys(commitmentByShareId).length > 0) {
                for (const keyEntry of allKeys) {
                    const info = getFractionKeyShareInfo(keyEntry.value);
                    if (!info) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error("Invalid Fraction Key format. Please check and try again.");
                    }
                    const expected = commitmentByShareId[String(info.id)];
                    if (!expected) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error(
                            "Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.",
                        );
                    }
                    const actual = await sha256HexFromString(keyEntry.value);
                    if (actual !== expected.toLowerCase()) {
                        setCurrentKeyStep(keyEntry.idx);
                        throw new Error(
                            "Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.",
                        );
                    }
                }
            }

            // Combine fraction keys
            const keysArray = normalizeFractionKeysClient(allKeys.map((k) => k.value));
            if (keysArray.length < 3) {
                throw new Error("Please provide at least 3 valid fraction keys.");
            }

            const combinedKey = combineSharesClient(keysArray);
            const decrypted = await decryptVaultWithCombinedKey({
                encryptedVault: vaultData.encryptedVault,
                metadata: vaultData.metadata,
                combinedKey,
                releaseEntropy,
                contractAddress: blockchainContractAddress,
                chainId: blockchainChainId,
            });

            // Decryption succeeded — store content then show animation
            setVaultContent(decrypted as DecryptedVaultContent);
            setVaultMetadata(vaultData.metadata);

            setLoading(true);
            const totalDuration = 1000 * loadingStates.length;
            setTimeout(() => {
                setLoading(false);
                setStep(5);
            }, totalDuration);
        } catch (err) {
            console.error('[Unlock] performDecryption error:', err);
            setStep(4); // Stay on step 4
            setError(err instanceof Error ? err.message : "Decryption failed. Please verify your fraction keys.");
        }
    };

    const resetAll = () => {
        setStep(1);
        setVaultId("");
        setArweaveTxId("");
        setCurrentQIndex(0);
        setAnswerInput("");
        setKeys({ 1: "", 2: "", 3: "" });
        setCurrentKeyStep(1);
        setFractionKeysVerified(false);
        setShowExitModal(false);
        setShowResetConfirm(false);
        setError(null);
        setIsVerifying(false);
        setActiveMedia(null);
        setVaultContent(null);
        setVaultMetadata(null);
        setSecurityQuestions([]);
        setSecurityQuestionHashes([]);
        setResolvedTxId("");
        setBackupFileLoaded(false);
        setSelectedBackupFileName(null);
        setReleaseEntropy(null);
        setBlockchainContractAddress(null);
        setBlockchainChainId(null);
        setBlockchainContractDataId(null);
        setNeedsFinalize(false);
        if (backupFileInputRef.current) {
            backupFileInputRef.current.value = "";
        }
        localStorage.clear();
    };

    const downloadDocument = (doc: VaultDocument) => {
        if (!doc.content) return;

        // doc.content is base64 encoded
        const link = document.createElement('a');
        link.href = doc.content.startsWith('data:') ? doc.content : `data:${doc.type};base64,${doc.content}`;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadVaultContent = () => {
        const will = vaultContent?.willDetails;
        if (!will) return;

        // Download title/message as a text file if present
        const textParts: string[] = [];
        if (will.title) {
            textParts.push(`Title: ${will.title}`);
        }
        if (will.content) {
            textParts.push(`Message:\n${will.content}`);
        }
        if (textParts.length > 0) {
            const vid = (vaultId || "").trim();
            const prefix = vid ? vid.split("-")[0] : "";
            const fileName = prefix ? `vault-content-${prefix}.txt` : "vault-content.txt";
            const blob = new Blob([textParts.join("\n\n")], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // Download all documents (multiple downloads)
        const documents = will.documents || [];
        documents.forEach((doc, idx) => {
            setTimeout(() => downloadDocument(doc), idx * 200);
        });
    };

    // --- Render Steps ---

    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-2 text-center">
                <div className="mb-6">
                    <img src="/assets/logo.png" alt="Deheritance Logo" className="w-full h-auto mx-auto object-contain" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="id">Vault ID</Label>
                    <div className="relative">
                        <Input
                            id="id"
                            placeholder="Enter your Vault ID"
                            value={vaultId}
                            onChange={(e) => setVaultId(e.target.value)}
                            className="text-center font-mono pr-10"
                            disabled={isVerifying}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-md"
                            disabled={isVerifying}
                            onClick={selectedBackupFileName ? handleClearBackupFile : () => backupFileInputRef.current?.click()}
                            title={selectedBackupFileName ? "Remove backup file" : "Upload backup file"}
                        >
                            {selectedBackupFileName ? (
                                <X className="h-3 w-3" />
                            ) : (
                                <Upload className="h-3 w-3" />
                            )}
                        </Button>
                    </div>
                </div>
                <input
                    ref={backupFileInputRef}
                    type="file"
                    className="hidden"
                    disabled={isVerifying}
                    accept=".txt"
                    onChange={handleBackupFileUpload}
                />
                {selectedBackupFileName && (
                    <div className="flex items-center justify-between border rounded-md p-3 bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[200px]">{selectedBackupFileName}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Button onClick={handleUnlock} className="w-full" variant="premium" size="lg" disabled={isVerifying}>
                    {isVerifying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                        </>
                    ) : (
                        <>
                            Unlock Now <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>
                <div className="text-center">
                    <Button
                        variant="link"
                        className="text-xs text-muted-foreground"
                        disabled={isVerifying}
                        onClick={() => chrome.tabs.create({ url: 'http://localhost:7001/' })}
                    >
                        How do I find my Vault ID?
                    </Button>
                </div>

            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold">Security Verification</h2>
                <Progress value={((currentQIndex) / securityQuestions.length) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground pt-1">Question {currentQIndex + 1} of {securityQuestions.length}</p>
                <p className="text-xs text-muted-foreground">
                    Policy: {unlockPolicy?.requiredCorrect ?? 3} correct
                    {unlockPolicy ? `, minPoints ${unlockPolicy.minPoints}` : ""}
                </p>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-normal text-muted-foreground">Security Question</CardTitle>
                    <CardDescription className="text-lg font-medium text-foreground">
                        {securityQuestions[currentQIndex] || "Loading..."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        key={currentQIndex}
                        placeholder="Type your answer..."
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isVerifying) {
                                handleAnswerSubmit();
                            }
                        }}
                        autoFocus
                        disabled={isVerifying}
                    />
                    {error && (
                        <p className="text-destructive text-xs mt-2 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {error}
                        </p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnswerSubmit} className="w-full" disabled={isVerifying || !answerInput.trim()}>
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                            </>
                        ) : (
                            currentQIndex === securityQuestions.length - 1 ? "Verify Identity" : "Next Question"
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );

    const handlePaste = async (num: 1 | 2 | 3) => {
        try {
            // Try standard API first
            const text = await navigator.clipboard.readText();
            if (text) {
                updateKey(num, text);
            }
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback...', err);

            // Fallback: create hidden textarea
            try {
                const textarea = document.createElement('textarea');
                document.body.appendChild(textarea);
                textarea.focus();
                document.execCommand('paste');
                const text = textarea.value;
                document.body.removeChild(textarea);

                if (text) {
                    updateKey(num, text);
                    return;
                }
            } catch (fallbackErr) {
                console.error('Fallback paste failed:', fallbackErr);
            }

            // If all fails, show error to user
            setError("Could not access clipboard. Please press Ctrl+V to paste manually.");
        }
    };

    const handleFileUpload = (num: 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result === 'string') {
                updateKey(num, result.trim());
            }
        };
        reader.readAsText(file);
    };

    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold">Fraction Keys</h2>
                <Progress value={((currentKeyStep - 1) / 3) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground pt-1">Key {currentKeyStep} of 3</p>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-normal text-muted-foreground">Enter Fraction Key #{currentKeyStep}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-9 pr-24 font-mono text-xs truncate"
                            placeholder={`Paste key #${currentKeyStep}`}
                            value={keys[currentKeyStep]}
                            onChange={(e) => updateKey(currentKeyStep, e.target.value)}
                            disabled={isVerifying}
                        />
                        <div className="absolute right-1 top-1 flex gap-1">
                            {/* Paste Button */}
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-[#bb9854]/20"
                                title="Paste from Clipboard"
                                onClick={() => handlePaste(currentKeyStep)}
                                disabled={isVerifying}
                            >
                                <span className="sr-only">Paste</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clipboard"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
                            </Button>

                            {/* Upload Button */}
                            {/* Upload Button */}
                            <label
                                className={`h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-[#bb9854]/20 cursor-pointer ${isVerifying ? 'opacity-50 pointer-events-none' : ''}`}
                                title="Upload Key File"
                            >
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(currentKeyStep, e)}
                                    disabled={isVerifying}
                                />
                                <span className="sr-only">Upload</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                            </label>
                        </div>
                    </div>
                    {error && (
                        <p className="text-destructive text-xs mt-2 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {error}
                        </p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleKeySubmit}
                        className="w-full"
                        disabled={!keys[currentKeyStep] || isVerifying}
                        variant={currentKeyStep === 3 ? "premium" : "default"}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                            </>
                        ) : (
                            currentKeyStep === 3 ? "Verify Keys & Continue" : "Verify & Next Key"
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );

    const renderFinalizeStep = () => (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-[#bb9854]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#bb9854]/30">
                    <img src="/assets/metamask.png" alt="MetaMask" className="w-10 h-10 object-contain" />
                </div>
                <h2 className="text-xl font-semibold">Finalize Release</h2>
                <p className="text-sm text-muted-foreground px-4">
                    This vault is ready but needs to be finalized on the blockchain before it can be unlocked.
                </p>
            </div>

            <Card className="border-[#bb9854]/30 bg-[#bb9854]/5">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-medium text-center">Blockchain Action Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-xs space-y-2 bg-background/50 p-3 rounded-md border border-border/50">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Network:</span>
                            <span className="font-mono text-[#bb9854]">{getChainKeyFromNumericChainId(blockchainChainId || 0) || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Data ID:</span>
                            <span className="font-mono truncate ml-4" title={blockchainContractDataId || ""}>{blockchainContractDataId ? `${blockchainContractDataId.slice(0, 8)}...${blockchainContractDataId.slice(-8)}` : "N/A"}</span>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="py-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="flex-col gap-2">
                    {isWaitingFinalize ? (
                        <div className="w-full text-center space-y-2">
                            <div className="flex items-center justify-center gap-2 text-sm text-[#bb9854]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Waiting for browser tab to complete...</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Complete the MetaMask transaction in the tab that just opened, then return here.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                    if (finalizePollingRef.current) {
                                        clearInterval(finalizePollingRef.current);
                                        finalizePollingRef.current = null;
                                    }
                                    setIsWaitingFinalize(false);
                                }}
                            >
                                Cancel Wait
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={handleFinalize} className="w-full" variant="premium" disabled={isVerifying}>
                            {isVerifying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                                </>
                            ) : (
                                <>
                                    <Unlock className="mr-2 h-4 w-4" /> Finalize with MetaMask
                                </>
                            )}
                        </Button>
                    )}
                </CardFooter>
            </Card>

            <div className="text-center">
                <Button variant="link" size="sm" className="text-xs text-muted-foreground" onClick={resetAll}>
                    Cancel and Start Over
                </Button>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            {/* Loading state is now handled by MultiStepLoader overlay in the main render */}
            {loading ? (
                <div className="space-y-6 flex flex-col items-center opacity-0 pointer-events-none">
                    {/* Hidden placeholder to keep layout stable if needed, mostly empty now */}
                </div>
            ) : (
                <div className="space-y-6 w-full">
                    {error && (
                        <Alert variant="destructive" className="py-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="bg-[#bb9854]/10 p-4 rounded-lg border border-[#bb9854]/50 text-left">
                        <h3 className="text-[#bb9854] font-semibold flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4" /> Ready to Decrypt
                        </h3>
                        <p className="text-sm text-[#bb9854]/90 leading-relaxed">
                            You are about to decrypt this vault locally. Ensure you are in a private environment.
                            Once unlocked, specific documents will be visible.
                        </p>
                    </div>
                    <Button onClick={handleFinalProcess} className="w-full" variant="premium" size="lg">
                        <Unlock className="w-4 h-4 mr-2" /> Proceed to Unlock
                    </Button>
                </div>
            )}
        </div>
    );

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderStep5 = () => {
        const documents = vaultContent?.willDetails?.documents || [];
        const message = vaultContent?.willDetails?.content;
        const title = vaultContent?.willDetails?.title;

        // Categorize documents
        const videoDocs = documents.filter(doc => doc.type?.startsWith('video/'));
        const audioDocs = documents.filter(doc => doc.type?.startsWith('audio/'));
        const otherDocs = documents.filter(doc => !doc.type?.startsWith('video/') && !doc.type?.startsWith('audio/'));

        // Helper for static classes to avoid Tailwind purging issues
        const getFileStyles = (type: string) => {
            if (type?.startsWith('video/')) return {
                bg: 'bg-purple-500/10',
                text: 'text-purple-500',
                hover: 'hover:bg-purple-500/20',
                icon: Video
            };
            if (type?.startsWith('audio/')) return {
                bg: 'bg-orange-500/10',
                text: 'text-orange-500',
                hover: 'hover:bg-orange-500/20',
                icon: Music
            };
            if (type === 'application/pdf') return {
                bg: 'bg-red-500/10',
                text: 'text-red-500',
                hover: 'hover:bg-red-500/20',
                icon: FileText
            };
            return {
                bg: 'bg-blue-500/10',
                text: 'text-blue-500',
                hover: 'hover:bg-blue-500/20',
                icon: FileText
            };
        };

        const renderDocItem = (doc: VaultDocument, key: string | number) => {
            const styles = getFileStyles(doc.type);
            const Icon = styles.icon;
            const isMedia = doc.type?.startsWith('video/') || doc.type?.startsWith('audio/');

            return (
                <Card key={key}>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-md ${styles.bg}`}>
                                <Icon className={`h-5 w-5 ${styles.text}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {isMedia && doc.content && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-8 px-3 whitespace-nowrap rounded-md ${styles.bg} ${styles.hover}`}
                                    onClick={() => setActiveMedia({
                                        type: doc.type?.startsWith('video/') ? 'video' : 'audio',
                                        url: doc.content!.startsWith('data:') ? doc.content! : `data:${doc.type};base64,${doc.content}`,
                                        title: doc.name
                                    })}
                                >
                                    <Play className="h-3 w-3 mr-1" /> Play
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => downloadDocument(doc)}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            );
        };

        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Vault Content</h2>
                    {documents.length > 0 && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={downloadVaultContent}>
                            <Download className="w-3 h-3 mr-1" /> Download All
                        </Button>
                    )}
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
                    {/* Title */}
                    {title && (
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                            <h4 className="text-primary text-sm font-medium mb-1">Title</h4>
                            <p className="text-lg font-semibold">{title}</p>
                        </div>
                    )}

                    {/* Message from Owner */}
                    {message && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                            <h4 className="text-green-500 text-sm font-medium mb-1">Message from Owner</h4>
                            <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
                                {message}
                            </p>
                        </div>
                    )}

                    {/* Video Wills */}
                    {videoDocs.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">Video Wills</h3>
                            {videoDocs.map((doc, idx) => renderDocItem(doc, `vid-${idx}`))}
                        </div>
                    )}

                    {/* Audio Wills */}
                    {audioDocs.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">Audio Wills</h3>
                            {audioDocs.map((doc, idx) => renderDocItem(doc, `aud-${idx}`))}
                        </div>
                    )}

                    {/* Other Documents */}
                    {otherDocs.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">Documents</h3>
                            {otherDocs.map((doc, idx) => renderDocItem(doc, `doc-${idx}`))}
                        </div>
                    )}

                    {documents.length === 0 && !message && (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No documents found in this vault.</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t">
                    <Button variant="destructive" className="w-full" onClick={() => setShowExitModal(true)}>
                        Done & Exit
                    </Button>
                </div>

                {/* Exit Modal Overlay */}
                {showExitModal && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <Card className="w-full shadow-2xl border-destructive/20">
                            <CardHeader>
                                <CardTitle>Lock Vault?</CardTitle>
                                <CardDescription>
                                    This will clear the decrypted data from memory and return to the login screen.
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowExitModal(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={resetAll}>Lock & Exit</Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-[360px] h-[600px] bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 relative rounded-xl border-none overflow-hidden">
            <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
                className="pointer-events-none"
            />

            {/* MultiStepLoader Overlay */}
            <MultiStepLoader
                loadingStates={loadingStates}
                loading={loading}
                duration={1000}
                loop={false}
            />

            {/* Media Player Modal */}
            <AnimatePresence>
                {activeMedia && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col p-4"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-medium truncate max-w-[280px]">{activeMedia.title}</h3>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-white hover:bg-white/20 rounded-full"
                                onClick={() => setActiveMedia(null)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                            {activeMedia.type === 'video' ? (
                                <video
                                    src={activeMedia.url}
                                    controls
                                    autoPlay
                                    className="w-full max-h-[60vh] object-contain rounded-lg shadow-2xl border border-white/10"
                                />
                            ) : (
                                <div className="w-full max-w-[200px] aspect-square bg-[#bb9854]/20 rounded-full flex items-center justify-center relative animate-pulse">
                                    <div className="absolute inset-0 rounded-full border border-[#bb9854]/40 animate-ping opacity-20"></div>
                                    <Music className="h-16 w-16 text-[#bb9854]" />
                                    <audio
                                        src={activeMedia.url}
                                        controls
                                        autoPlay
                                        className="absolute bottom-[-80px] w-[280px]"
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="p-4 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide">Deheritance Unlock Vault</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowResetConfirm(true)}>
                    <X className="h-4 w-4" />
                </Button>
            </header>

            {/* Global Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
                    <Card className="w-full shadow-2xl border-destructive/20 relative z-[80]">
                        <CardHeader>
                            <CardTitle>Close and Reset?</CardTitle>
                            <CardDescription>
                                Are you sure you want to go back to the start? Any progress will be lost.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => {
                                setShowResetConfirm(false);
                                resetAll();
                            }}>Yes, Close</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 p-6 relative overflow-hidden z-10">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <PageWrapper key="step1">
                            {renderStep1()}
                        </PageWrapper>
                    )}
                    {step === 10 && (
                        <PageWrapper key="stepFinalize">
                            {renderFinalizeStep()}
                        </PageWrapper>
                    )}
                    {step === 2 && (
                        <PageWrapper key="step2">
                            {renderStep2()}
                        </PageWrapper>
                    )}
                    {step === 3 && (
                        <PageWrapper key="step3">
                            {renderStep3()}
                        </PageWrapper>
                    )}
                    {step === 4 && (
                        <PageWrapper key="step4">
                            {renderStep4()}
                        </PageWrapper>
                    )}
                    {step === 5 && (
                        <PageWrapper key="step5" className="h-full">
                            {renderStep5()}
                        </PageWrapper>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}
