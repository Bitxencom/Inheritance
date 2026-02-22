import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import { encryptMetadata, decryptMetadata, decryptQuestion } from "../../services/vault-service.js";
import { combineShares } from "../../services/crypto/shamir.js";
import {
    decryptPayload,
    decryptPayloadHybrid,
    encryptPayload,
    generateAesKey,
    HybridEncryptedVault,
} from "../../services/crypto/aes.js";
import type { EncryptedVault, VaultPayload } from "../../types/vault.js";
import { base64ToKey } from "../../services/crypto/pqc.js";
import {
    fetchVaultPayloadById,
    getVaultUploadCostEstimate,
    estimateUploadCost,
} from "../../services/storage/arweave.js";

import {
    unlockPolicyV1,
    rateLimitVerify,
    computeClaimNonce,
    selectRequiredIndexes,
    verifyAnswerAgainstEntry,
    getEntryPoints,
    formatSize,
} from "./vault.helpers.js";
import {
    vaultSchema,
    clientEncryptedSchema,
    unlockSchema,
    verifySecurityQuestionsSchema,
} from "./vault.schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Estimate cost (simple — data size only)
// ─────────────────────────────────────────────────────────────────────────────
export const estimateCostSimple = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<unknown> => {
    try {
        const { dataSizeBytes } = req.body;

        if (!dataSizeBytes || typeof dataSizeBytes !== "number" || dataSizeBytes <= 0) {
            return res.status(400).json({
                success: false,
                error: "Data size must be valid.",
            });
        }

        const costAR = await estimateUploadCost(dataSizeBytes);

        return res.status(200).json({
            success: true,
            message: "Cost estimate ready.",
            estimate: {
                costAR,
                dataSizeBytes,
                dataSizeKB: formatSize(dataSizeBytes, "KB"),
                dataSizeMB: formatSize(dataSizeBytes, "MB"),
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Estimate cost (full schema — encrypts a dummy payload for accuracy)
// ─────────────────────────────────────────────────────────────────────────────
export const estimateCost = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<unknown> => {
    try {
        const parsed = vaultSchema.parse(req.body);
        const dummyKey = generateAesKey();
        const encryptedVault = encryptPayload(parsed, dummyKey);

        const estimatePayload = {
            vaultId: "estimate-only",
            encryptedData: encryptedVault,
            metadata: {
                trigger: parsed.triggerRelease,
                beneficiaryCount: parsed.beneficiaries.length,
                securityQuestions: parsed.securityQuestions?.map((sq) => sq.question) || [],
                willType: parsed.willDetails?.willType || "one-time",
            },
        };

        const costEstimate = await getVaultUploadCostEstimate(estimatePayload);
        const totalDocumentSize =
            parsed.willDetails?.documents?.reduce((total, doc) => total + (doc.size || 0), 0) || 0;

        return res.status(200).json({
            success: true,
            message: "Cost estimate ready.",
            estimate: {
                costAR: costEstimate.costAR,
                dataSizeBytes: costEstimate.dataSizeBytes,
                dataSizeKB: formatSize(costEstimate.dataSizeBytes, "KB"),
                dataSizeMB: formatSize(costEstimate.dataSizeBytes, "MB"),
                beneficiaryCount: parsed.beneficiaries.length,
                documentCount: parsed.willDetails?.documents?.length || 0,
                totalDocumentSizeBytes: totalDocumentSize,
                totalDocumentSizeKB: formatSize(totalDocumentSize, "KB"),
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: error.errors.map((err) => ({
                    path: err.path.join("."),
                    message: err.message,
                })),
            });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Deprecated: server-side prepare
// ─────────────────────────────────────────────────────────────────────────────
export const prepareDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend encryption is deprecated. Please use client-side encryption and call /prepare-client.",
    });

// ─────────────────────────────────────────────────────────────────────────────
// Prepare client-encrypted vault (new vault, generates vaultId)
// ─────────────────────────────────────────────────────────────────────────────
export const prepareClient = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<unknown> => {
    try {
        const parsed = clientEncryptedSchema.parse(req.body);
        const vaultId = randomUUID();
        const metadata = { ...parsed.metadata };

        const arweavePayload = {
            id: vaultId,
            v: 1,
            t: "d",
            m: encryptMetadata(metadata, vaultId),
            d: parsed.encryptedVault,
        };

        return res.status(200).json({
            success: true,
            message: "Client-encrypted vault ready for upload.",
            details: {
                vaultId,
                arweavePayload,
                encryptionVersion: metadata.encryptionVersion,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: error.errors.map((err) => ({
                    path: err.path.join("."),
                    message: err.message,
                })),
            });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Prepare client-encrypted vault (existing vaultId supplied in URL)
// ─────────────────────────────────────────────────────────────────────────────
export const prepareClientById = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<unknown> => {
    try {
        const { vaultId } = req.params;
        if (!vaultId) {
            return res.status(400).json({ success: false, error: "Vault ID is required." });
        }

        const parsed = clientEncryptedSchema.parse(req.body);
        const metadata = { ...parsed.metadata };

        const arweavePayload = {
            id: vaultId,
            v: 1,
            t: "d",
            m: encryptMetadata(metadata, vaultId),
            d: parsed.encryptedVault,
        };

        return res.status(200).json({
            success: true,
            message: "Vault ready for upload.",
            details: { vaultId, arweavePayload },
            shouldDispatch: true,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: error.errors.map((err) => ({
                    path: err.path.join("."),
                    message: err.message,
                })),
            });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Unlock vault
// ─────────────────────────────────────────────────────────────────────────────
export const unlockVault = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<unknown> => {
    try {
        const { vaultId } = req.params;
        const parsed = unlockSchema.parse(req.body);

        if (!vaultId) {
            return res.status(400).json({ success: false, error: "Vault ID is required." });
        }

        const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
        const encryptedVault = uploadPayload.encryptedData as EncryptedVault | HybridEncryptedVault;
        const encryptedMetadata = uploadPayload.metadata?.encryptedMetadata as string | undefined;

        let metadata: Record<string, unknown> = uploadPayload.metadata || {};
        if (encryptedMetadata && typeof encryptedMetadata === "string") {
            try {
                metadata = decryptMetadata(encryptedMetadata, vaultId);
            } catch (error) {
                console.error("❌ Failed to decrypt metadata for unlock:", error);
            }
        }

        const encryptionVersion = (metadata.encryptionVersion as string) || "v1-backend";

        // Trigger check
        const triggerCandidate = (
            metadata.trigger ||
            (metadata as unknown as { triggerRelease?: unknown }).triggerRelease
        ) as { triggerType?: unknown; triggerDate?: unknown } | undefined;

        if (triggerCandidate && typeof triggerCandidate === "object") {
            const { triggerType, triggerDate } = triggerCandidate;

            if (triggerType === "date") {
                if (typeof triggerDate !== "string" || triggerDate.trim().length === 0) {
                    return res.status(400).json({
                        success: false,
                        error:
                            "This inheritance is set to open on a specific date, but we can't verify the date. Please contact support if this persists.",
                    });
                }
                const releaseDate = new Date(triggerDate);
                if (Number.isNaN(releaseDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        error:
                            "This inheritance is set to open on a specific date, but we can't verify the date. Please contact support if this persists.",
                    });
                }
                if (Date.now() < releaseDate.getTime()) {
                    return res.status(403).json({
                        success: false,
                        error: "This inheritance isn't ready to be opened just yet.",
                        trigger: { triggerType: "date", triggerDate: releaseDate.toISOString() },
                    });
                }
            }

            if (triggerType === "death") {
                return res.status(403).json({
                    success: false,
                    error:
                        "This inheritance requires death certificate verification before it can be opened. Please ensure the verification process is complete.",
                    trigger: { triggerType: "death" },
                });
            }
        }

        // Security question check
        const storedHashes = (
            metadata.securityQuestionHashes as Array<Record<string, unknown>>
        ) || [];

        if (storedHashes.length > 0) {
            if (!parsed.securityQuestionAnswers || parsed.securityQuestionAnswers.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: "Security questions are required to unlock this vault.",
                });
            }

            const limit = rateLimitVerify(req, vaultId);
            if (!limit.ok) {
                const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1000));
                res.setHeader("Retry-After", String(seconds));
                return res.status(429).json({
                    success: false,
                    error: "Too many attempts. Please try again later.",
                });
            }

            const expectedClaimNonce = computeClaimNonce({
                vaultId,
                latestTxId: uploadPayload.latestTxId,
            });
            const requiredIndexes = selectRequiredIndexes({
                totalQuestions: storedHashes.length,
                claimNonce: expectedClaimNonce,
            });

            const useRequiredIndexes =
                typeof parsed.claimNonce === "string" && parsed.claimNonce.length > 0;
            if (useRequiredIndexes && parsed.claimNonce !== expectedClaimNonce) {
                return res.status(400).json({ success: false, error: "Invalid claim nonce." });
            }

            const providedAnswers = parsed.securityQuestionAnswers;
            const answersByIndex = new Map<number, string>();
            for (let i = 0; i < providedAnswers.length; i += 1) {
                const provided = providedAnswers[i];
                const idx = typeof provided.index === "number" ? provided.index : i;
                if (!answersByIndex.has(idx)) answersByIndex.set(idx, provided.answer);
            }

            const indexesToCheck = useRequiredIndexes
                ? requiredIndexes
                : Array.from({ length: providedAnswers.length }, (_, i) => i);

            const incorrectIndexes: number[] = [];
            const correctIndexes: number[] = [];

            for (const idx of indexesToCheck) {
                if (idx < 0 || idx >= storedHashes.length) {
                    incorrectIndexes.push(idx);
                    continue;
                }
                const answer = answersByIndex.get(idx);
                if (!answer) { incorrectIndexes.push(idx); continue; }
                const entry = storedHashes[idx] as Record<string, unknown>;
                if (!verifyAnswerAgainstEntry(answer, entry)) {
                    incorrectIndexes.push(idx);
                    continue;
                }
                correctIndexes.push(idx);
            }

            const achieved = { correctCount: correctIndexes.length, points: 0 };
            let canEnforcePoints = true;
            for (const idx of correctIndexes) {
                const entry = storedHashes[idx] as Record<string, unknown>;
                const { points } = getEntryPoints(entry);
                if (points == null) { canEnforcePoints = false; continue; }
                achieved.points += points;
            }

            const policy = unlockPolicyV1;
            const ok =
                achieved.correctCount >= policy.requiredCorrect &&
                (canEnforcePoints ? achieved.points >= policy.minPoints : true);

            if (!ok) {
                return res.status(401).json({
                    success: false,
                    error:
                        achieved.correctCount >= policy.requiredCorrect
                            ? "Unlock policy requirements not met."
                            : "Incorrect answers to security questions. Please try again.",
                    incorrectIndexes,
                    unlockPolicy: policy,
                    achieved,
                    fallbackRequired: !canEnforcePoints,
                });
            }
        }

        // Client-encrypted vaults — return raw encrypted payload for client-side decryption
        if (encryptionVersion === "v2-client" || encryptionVersion === "v3-envelope") {
            return res.status(200).json({
                success: true,
                message: "Access granted. Encrypted vault ready for client-side decryption.",
                encryptedVault,
                metadata: { ...metadata, encryptionVersion },
                latestTxId: uploadPayload.latestTxId ?? null,
            });
        }

        // Legacy PQC hybrid — decrypt server-side for migration
        const isPqcEnabled = metadata.isPqcEnabled === true;
        const isHybridEncrypted =
            isPqcEnabled ||
            (typeof (encryptedVault as HybridEncryptedVault | undefined)?.pqcCipherText === "string" &&
                (encryptedVault as HybridEncryptedVault).pqcCipherText.length > 0);

        if (isHybridEncrypted) {
            if (!parsed.fractionKeys || parsed.fractionKeys.length < 3) {
                return res.status(400).json({
                    success: false,
                    error: "Please provide at least 3 Fraction Keys to open the inheritance.",
                });
            }
            try {
                const combinedKeyBuffer = combineShares(parsed.fractionKeys);
                const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
                const decrypted = decryptPayloadHybrid(
                    encryptedVault as HybridEncryptedVault,
                    pqcSecretKey,
                ) as VaultPayload;

                return res.status(200).json({
                    success: true,
                    message: "Access granted. Legacy vault decrypted for migration.",
                    encryptedVault,
                    decryptedVault: decrypted,
                    metadata: { ...metadata, encryptionVersion },
                    legacy: { encryptionVersion, isPqcEnabled: true },
                    latestTxId: uploadPayload.latestTxId ?? null,
                });
            } catch {
                return res.status(400).json({
                    success: false,
                    error: "Fraction keys do not match. Make sure all 3 fraction keys are correct.",
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Access granted. Encrypted vault ready for client-side decryption.",
            encryptedVault,
            metadata: { ...metadata, encryptionVersion },
            legacy: { encryptionVersion, isPqcEnabled: false },
            latestTxId: uploadPayload.latestTxId ?? null,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: error.errors.map((err) => ({
                    path: err.path.join("."),
                    message: err.message,
                })),
            });
        }
        console.error("❌ Failed to unlock vault:", error);
        if (
            error instanceof Error &&
            (error.message.includes("pending") || error.message.includes("Newer version"))
        ) {
            return res.status(202).json({
                success: false,
                error:
                    "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
                originalError: error.message,
            });
        }
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Deprecated: server-side claim
// ─────────────────────────────────────────────────────────────────────────────
export const claimDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend claim (server-side decryption) is deprecated. Use /unlock and decrypt on the client instead.",
    });

// ─────────────────────────────────────────────────────────────────────────────
// Deprecated: server-side edit / preview
// ─────────────────────────────────────────────────────────────────────────────
export const editDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend edit (server-side decryption/re-encryption) is deprecated. Re-encrypt on the client and call /prepare-client instead.",
    });

export const previewDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend preview (server-side decryption) is deprecated. Use /unlock and decrypt on the client instead.",
    });

export const verifyFractionKeysDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend fraction key verification is deprecated. Unlock and decrypt on the client instead.",
    });

export const downloadDocumentDeprecated = (_req: Request, res: Response): unknown =>
    res.status(410).json({
        success: false,
        error:
            "Backend document download is deprecated. Unlock and decrypt documents on the client instead.",
    });

// ─────────────────────────────────────────────────────────────────────────────
// Get security questions
// ─────────────────────────────────────────────────────────────────────────────
export const getSecurityQuestions = async (
    req: Request,
    res: Response,
): Promise<unknown> => {
    try {
        const { vaultId } = req.params;
        if (!vaultId) {
            return res.status(400).json({ success: false, error: "Vault ID is required." });
        }

        const arweaveTxId = req.body.arweaveTxId;
        const uploadPayload = await fetchVaultPayloadById(vaultId, arweaveTxId);

        const rawHashes = uploadPayload.metadata?.securityQuestionHashes as
            | Array<{
                q?: string;
                a?: string;
                encryptedQuestion?: string;
                question?: string;
                answerHash?: string;
            }>
            | undefined;

        let securityQuestions: string[] = [];

        if (rawHashes && rawHashes.length > 0) {
            securityQuestions = rawHashes.map((sq) => {
                if (sq.q) {
                    try { return decryptQuestion(sq.q, vaultId); } catch { /* fall through */ }
                }
                if (sq.encryptedQuestion) {
                    try { return decryptQuestion(sq.encryptedQuestion, vaultId); } catch { /* fall through */ }
                }
                return sq.question ?? "[Question not available]";
            });
        } else {
            securityQuestions = (uploadPayload.metadata?.securityQuestions as string[]) || [];
        }

        const willType = (uploadPayload.metadata?.willType as "one-time" | "editable") || "one-time";
        const trigger = uploadPayload.metadata?.trigger as
            | { triggerType?: "date" | "death" | "manual"; triggerDate?: string }
            | undefined;

        if (securityQuestions.length === 0) {
            return res.status(200).json({
                success: true,
                securityQuestions: [],
                willType,
                trigger: trigger || null,
                latestTxId: uploadPayload.latestTxId || null,
                message: "Vault found but has no security questions.",
            });
        }

        const claimNonce = computeClaimNonce({ vaultId, latestTxId: uploadPayload.latestTxId });
        const requiredIndexes = selectRequiredIndexes({
            totalQuestions: securityQuestions.length,
            claimNonce,
        });

        return res.status(200).json({
            success: true,
            securityQuestions,
            requiredIndexes,
            claimNonce,
            unlockPolicy: unlockPolicyV1,
            willType,
            trigger: trigger || null,
            latestTxId: uploadPayload.latestTxId || null,
            message: "Security questions loaded successfully from blockchain storage.",
        });
    } catch (error) {
        console.error("❌ Failed to load security questions for vault:", error);
        if (
            error instanceof Error &&
            (error.message.includes("pending") || error.message.includes("Newer version"))
        ) {
            return res.status(202).json({
                success: false,
                error:
                    "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
                originalError: error.message,
            });
        }
        return res.status(404).json({
            success: false,
            error: error instanceof Error ? error.message : "Vault not found",
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Verify security question answers (without requiring fraction keys)
// ─────────────────────────────────────────────────────────────────────────────
export const verifySecurityQuestions = async (
    req: Request,
    res: Response,
): Promise<unknown> => {
    try {
        const { vaultId } = req.params;
        const parsed = verifySecurityQuestionsSchema.parse(req.body);

        if (!vaultId) {
            return res.status(400).json({ success: false, error: "Vault ID is required." });
        }

        const limit = rateLimitVerify(req, vaultId);
        if (!limit.ok) {
            const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1000));
            res.setHeader("Retry-After", String(seconds));
            return res.status(429).json({
                success: false,
                error: "Too many attempts. Please try again later.",
            });
        }

        const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
        const storedHashes = (
            uploadPayload.metadata?.securityQuestionHashes as Array<Record<string, unknown>>
        ) || [];

        if (storedHashes.length === 0) {
            return res.status(400).json({
                success: false,
                error:
                    "This vault was created with an older encryption scheme and is no longer supported. Please create a new vault using the latest frontend encryption.",
                fallbackRequired: false,
            });
        }

        const expectedClaimNonce = computeClaimNonce({
            vaultId,
            latestTxId: uploadPayload.latestTxId,
        });
        const requiredIndexes = selectRequiredIndexes({
            totalQuestions: storedHashes.length,
            claimNonce: expectedClaimNonce,
        });

        const useRequiredIndexes =
            typeof parsed.claimNonce === "string" && parsed.claimNonce.length > 0;

        if (useRequiredIndexes && parsed.claimNonce !== expectedClaimNonce) {
            return res.status(400).json({ success: false, error: "Invalid claim nonce." });
        }

        const providedAnswers = parsed.securityQuestionAnswers;
        const answersByIndex = new Map<number, string>();
        for (let i = 0; i < providedAnswers.length; i += 1) {
            const provided = providedAnswers[i];
            const idx = typeof provided.index === "number" ? provided.index : i;
            if (!answersByIndex.has(idx)) answersByIndex.set(idx, provided.answer);
        }

        const indexesToCheck = useRequiredIndexes
            ? requiredIndexes
            : Array.from({ length: providedAnswers.length }, (_, i) => i);

        const incorrectIndexes: number[] = [];
        const correctIndexes: number[] = [];

        for (const idx of indexesToCheck) {
            if (idx < 0 || idx >= storedHashes.length) { incorrectIndexes.push(idx); continue; }
            const answer = answersByIndex.get(idx);
            if (!answer) { incorrectIndexes.push(idx); continue; }
            const entry = storedHashes[idx] as Record<string, unknown>;
            if (!verifyAnswerAgainstEntry(answer, entry)) { incorrectIndexes.push(idx); continue; }
            correctIndexes.push(idx);
        }

        const achieved = { correctCount: correctIndexes.length, points: 0 };
        let canEnforcePoints = true;
        for (const idx of correctIndexes) {
            const entry = storedHashes[idx] as Record<string, unknown>;
            const { points } = getEntryPoints(entry);
            if (points == null) { canEnforcePoints = false; continue; }
            achieved.points += points;
        }

        const policy = unlockPolicyV1;
        const ok =
            achieved.correctCount >= policy.requiredCorrect &&
            (canEnforcePoints ? achieved.points >= policy.minPoints : true);

        if (!ok) {
            return res.status(401).json({
                success: false,
                error:
                    achieved.correctCount >= policy.requiredCorrect
                        ? "Unlock policy requirements not met."
                        : "Security question answers do not match.",
                incorrectIndexes,
                unlockPolicy: policy,
                achieved,
                fallbackRequired: !canEnforcePoints,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Security question answers are valid.",
            unlockPolicy: policy,
            achieved,
            requiredIndexes: useRequiredIndexes ? requiredIndexes : undefined,
            claimNonce: useRequiredIndexes ? expectedClaimNonce : undefined,
            fallbackRequired: !canEnforcePoints,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: error.errors.map((err) => ({
                    path: err.path.join("."),
                    message: err.message,
                })),
            });
        }
        console.error("❌ Failed to validate security question answers:", error);
        if (
            error instanceof Error &&
            (error.message.includes("pending") || error.message.includes("Newer version"))
        ) {
            return res.status(202).json({
                success: false,
                error:
                    "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
                originalError: error.message,
            });
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "An error occurred while validating answers.",
        });
    }
};
