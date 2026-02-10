import { Router } from "express";
import { z } from "zod";
import { createHmac, randomUUID } from "crypto";

import { prepareVault, hashSecurityAnswer, verifySecurityAnswerHash, encryptMetadata, hashSecurityQuestionAnswers, decryptMetadata } from "../services/vault-service.js";
import { combineShares } from "../services/crypto/shamir.js";
import {
  decryptPayload,
  decryptPayloadHybrid,
  encryptPayload,
  encryptPayloadHybrid,
  generateAesKey,
  HybridEncryptedVault,
} from "../services/crypto/aes.js";
import type { EncryptedVault, VaultPayload } from "../types/vault.js";
import { base64ToKey } from "../services/crypto/pqc.js";
import {
  fetchVaultPayloadById,
  getVaultUploadCostEstimate,
  estimateUploadCost,
} from "../services/storage/arweave.js";
import { appEnv } from "../config/env.js";

const vaultSchema = z.object({
  willDetails: z.object({
    willType: z.enum(["one-time", "editable"]),
    title: z.string(),
    content: z.string(),
    documents: z
      .array(
        z.object({
          name: z.string(),
          size: z.number(),
          type: z.string(),
          content: z.string(), // base64 encoded file content
        }),
      )
      .default([]),
  }),
  securityQuestions: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
  beneficiaries: z
    .array(
      z.object({
        fullName: z.string(),
        email: z.string().email(),
        dateOfBirth: z.string(),
        relationship: z.string(),
      }),
    )
    .optional()
    .default([]),
  triggerRelease: z.object({
    triggerType: z.enum(["date", "death", "manual"]),
    triggerDate: z.string().optional(),
  }),
  payment: z.object({
    paymentMethod: z.enum(["wander", "metamask"]),
  }),
  enablePqc: z.boolean().optional().default(true),
});

export const vaultRouter = Router();

const verifyAttemptStore = new Map<
  string,
  { count: number; windowStartedAt: number; lockedUntil?: number }
>();

const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 50;
const VERIFY_LOCK_MS = 15 * 60 * 1000;

const unlockPolicyV1 = {
  policyVersion: 1,
  requiredCorrect: 3,
  minPoints: 50,
} as const;

const toBase64Url = (buffer: Buffer): string =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const computeClaimNonce = (params: { vaultId: string; latestTxId: string | null | undefined }): string => {
  const h = createHmac("sha256", appEnv.unlockPolicySecret);
  h.update(`claimNonce:v1:${params.vaultId}:${params.latestTxId ?? ""}`, "utf8");
  return toBase64Url(h.digest()).slice(0, 43);
};

const selectRequiredIndexes = (params: { totalQuestions: number; claimNonce: string }): number[] => {
  const total = Math.max(0, Math.floor(params.totalQuestions));
  const target = Math.min(3, total);
  const scored = Array.from({ length: total }, (_, index) => {
    const h = createHmac("sha256", appEnv.unlockPolicySecret);
    h.update(`requiredIndexes:v1:${params.claimNonce}:${index}`, "utf8");
    return { index, score: h.digest("hex") };
  });
  scored.sort((a, b) => a.score.localeCompare(b.score));
  return scored
    .slice(0, target)
    .map((x) => x.index)
    .sort((a, b) => a - b);
};

const getEntryPoints = (entry: Record<string, unknown>): { points: number | null; tier: "low" | "medium" | "high" | null } => {
  const pointsRaw = entry.points;
  if (typeof pointsRaw === "number" && Number.isFinite(pointsRaw)) {
    const points = Math.floor(pointsRaw);
    if (points === 10) return { points, tier: "low" };
    if (points === 20) return { points, tier: "medium" };
    if (points === 30) return { points, tier: "high" };
  }

  const tierRaw = entry.scoreTier;
  if (typeof tierRaw === "string") {
    const norm = tierRaw.trim().toLowerCase();
    if (norm === "low") return { points: 10, tier: "low" };
    if (norm === "medium") return { points: 20, tier: "medium" };
    if (norm === "high") return { points: 30, tier: "high" };
  }

  return { points: null, tier: null };
};

const getClientIp = (req: { ip?: string; headers?: Record<string, unknown> }): string => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return typeof req.ip === "string" && req.ip.trim() ? req.ip : "unknown";
};

const rateLimitVerify = (req: { ip?: string; headers?: Record<string, unknown> }, vaultId: string) => {
  const ip = getClientIp(req);
  const key = `${vaultId}::${ip}`;
  const now = Date.now();
  const existing = verifyAttemptStore.get(key);
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return { ok: false, retryAfterMs: existing.lockedUntil - now };
  }
  if (!existing || now - existing.windowStartedAt > VERIFY_WINDOW_MS) {
    verifyAttemptStore.set(key, { count: 1, windowStartedAt: now });
    return { ok: true as const };
  }
  const nextCount = existing.count + 1;
  if (nextCount > VERIFY_MAX_ATTEMPTS) {
    verifyAttemptStore.set(key, {
      count: nextCount,
      windowStartedAt: existing.windowStartedAt,
      lockedUntil: now + VERIFY_LOCK_MS,
    });
    return { ok: false, retryAfterMs: VERIFY_LOCK_MS };
  }
  verifyAttemptStore.set(key, { ...existing, count: nextCount });
  return { ok: true as const };
};

const getHashCandidatesForEntry = (
  entry: Record<string, unknown>,
): { hashes: string[]; normalizationProfile: "none" | "default" } => {
  const hashesRaw = entry.hashes;
  if (Array.isArray(hashesRaw)) {
    const hashes = hashesRaw.filter((h): h is string => typeof h === "string" && h.length > 0);
    if (hashes.length > 0) {
      const mode = entry.mode;
      const normalizationProfileRaw = entry.normalizationProfile;
      const normalizationProfile =
        normalizationProfileRaw === "none" || normalizationProfileRaw === "default"
          ? normalizationProfileRaw
          : mode === "exact"
            ? "none"
            : "default";
      return { hashes, normalizationProfile };
    }
  }
  const single = entry.a ?? entry.answerHash;
  if (typeof single === "string" && single.length > 0) {
    return { hashes: [single], normalizationProfile: "default" };
  }
  return { hashes: [], normalizationProfile: "default" };
};

const verifyAnswerAgainstEntry = (answer: string, entry: Record<string, unknown>): boolean => {
  const { hashes, normalizationProfile } = getHashCandidatesForEntry(entry);
  if (hashes.length === 0) return false;
  for (const h of hashes) {
    if (verifySecurityAnswerHash(answer, h, { normalizationProfile })) return true;
  }
  return false;
};

// Simple endpoint to estimate cost based on data size only
vaultRouter.post("/estimate-cost-simple", async (req, res, next) => {
  try {
    const { dataSizeBytes } = req.body;
    
    if (!dataSizeBytes || typeof dataSizeBytes !== "number" || dataSizeBytes <= 0) {
      return res.status(400).json({
        success: false,
        error: "Data size must be valid.",
      });
    }

    const costAR = await estimateUploadCost(dataSizeBytes);
    
    // Format size without unnecessary decimals
    const formatSize = (bytes: number, unit: "KB" | "MB"): string => {
      const value = unit === "KB" ? bytes / 1024 : bytes / (1024 * 1024);
      // Remove decimals if not needed
      return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
    };

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
});

// Endpoint to get upload cost estimate before creating vault
vaultRouter.post("/estimate-cost", async (req, res, next) => {
  try {
    // Validate request body with the same schema as create vault
    const parsed = vaultSchema.parse(req.body);
    
    // To get accurate estimate, we need to do dummy encryption
    // with the same payload as what will be uploaded
    const tempVaultId = "estimate-only"; // Temporary ID for estimation
    
    // Encrypt dummy payload to get accurate encrypted data size
    const dummyKey = generateAesKey();
    const encryptedVault = encryptPayload(parsed, dummyKey);
    
    // Create payload to be uploaded (same as in createVault)
    const estimatePayload = {
      vaultId: tempVaultId,
      encryptedData: encryptedVault,
      metadata: {
        trigger: parsed.triggerRelease,
        beneficiaryCount: parsed.beneficiaries.length,
        securityQuestions: parsed.securityQuestions?.map(sq => sq.question) || [],
        willType: parsed.willDetails?.willType || "one-time",
      },
    };
    
    // Calculate cost estimate
    const costEstimate = await getVaultUploadCostEstimate(estimatePayload);
    
    // Calculate total document size (if any)
    const totalDocumentSize = parsed.willDetails?.documents?.reduce((total, doc) => {
      return total + (doc.size || 0);
    }, 0) || 0;
    
    // Format size without unnecessary decimals
    const formatSize = (bytes: number, unit: "KB" | "MB"): string => {
      const value = unit === "KB" ? bytes / 1024 : bytes / (1024 * 1024);
      // Remove decimals if not needed
      return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
    };
    
    return res.status(200).json({
      success: true,
      message: "Cost estimate ready.",
      estimate: {
        costAR: costEstimate.costAR,
        dataSizeBytes: costEstimate.dataSizeBytes,
        // Convert to more readable format
        dataSizeKB: formatSize(costEstimate.dataSizeBytes, "KB"),
        dataSizeMB: formatSize(costEstimate.dataSizeBytes, "MB"),
        // Additional information
        beneficiaryCount: parsed.beneficiaries.length,
        documentCount: parsed.willDetails?.documents?.length || 0,
        totalDocumentSizeBytes: totalDocumentSize,
        totalDocumentSizeKB: formatSize(totalDocumentSize, "KB"),
      },
    });
  } catch (error) {
    // Handle Zod validation errors
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
    
    // Handle other errors
    next(error);
  }
});

vaultRouter.post("/prepare", async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend encryption is deprecated. Please use client-side encryption and call /prepare-client.",
  });
});

const clientEncryptedSchema = z.object({
  encryptedVault: z.object({
    cipherText: z.string(),
    iv: z.string(),
    checksum: z.string(),
    pqcCipherText: z.string().optional(),
    alg: z.enum(["AES-CBC", "AES-GCM"]).optional(),
  }),
  metadata: z.object({
    trigger: z.any(),
    beneficiaryCount: z.number(),
    securityQuestionHashes: z.array(
      z.object({
        q: z.string().optional(),
        a: z.string().optional(),
        encryptedQuestion: z.string().optional(),
        question: z.string().optional(),
        answerHash: z.string().optional(),
      }),
    ),
    willType: z.string(),
    isPqcEnabled: z.boolean().optional(),
    pqcPublicKey: z.any().optional(),
    encryptionVersion: z.literal("v2-client"),
  }),
});

vaultRouter.post("/prepare-client", async (req, res, next) => {
  try {
    const parsed = clientEncryptedSchema.parse(req.body);

    const vaultId = randomUUID();

    const metadata = {
      ...parsed.metadata,
      encryptionVersion: "v2-client",
    };

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
        encryptionVersion: "v2-client",
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
});

vaultRouter.post("/:vaultId/prepare-client", async (req, res, next) => {
  try {
    const { vaultId } = req.params;
    const parsed = clientEncryptedSchema.parse(req.body);

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
      });
    }

    const metadata = {
      ...parsed.metadata,
      encryptionVersion: "v2-client",
    };

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
      details: {
        vaultId,
        arweavePayload,
      },
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
});



const unlockSchema = z.object({
  arweaveTxId: z.string().optional(),
  claimNonce: z.string().optional(),
  fractionKeys: z.array(z.string().min(1)).optional().default([]),
  securityQuestionAnswers: z
    .array(
      z.object({
        index: z.number().int().min(0).optional(),
        question: z.string().optional(),
        answer: z.string().min(1).max(256),
      }),
    )
    .min(3)
    .max(20)
    .optional(),
});

vaultRouter.post("/:vaultId/unlock", async (req, res, next) => {
  try {
    const { vaultId } = req.params;
    const parsed = unlockSchema.parse(req.body);

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
      });
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

    if (parsed.securityQuestionAnswers && parsed.securityQuestionAnswers.length > 0) {
      const limit = rateLimitVerify(req, vaultId);
      if (!limit.ok) {
        const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1000));
        res.setHeader("Retry-After", String(seconds));
        return res.status(429).json({
          success: false,
          error: "Too many attempts. Please try again later.",
        });
      }

      const storedHashes = (metadata.securityQuestionHashes as Array<{
        q?: string;
        a?: string;
        question?: string;
        answerHash?: string;
        hashes?: string[];
        mode?: string;
        normalizationProfile?: string;
        profileVersion?: number;
        scoreTier?: string;
        points?: number;
      }>) || [];

      if (storedHashes.length > 0) {
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
          return res.status(400).json({
            success: false,
            error: "Invalid claim nonce.",
          });
        }

        const providedAnswers = parsed.securityQuestionAnswers;
        const answersByIndex = new Map<number, string>();
        for (let i = 0; i < providedAnswers.length; i += 1) {
          const provided = providedAnswers[i];
          const idx = typeof provided.index === "number" ? provided.index : i;
          if (!answersByIndex.has(idx)) {
            answersByIndex.set(idx, provided.answer);
          }
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
          if (!answer) {
            incorrectIndexes.push(idx);
            continue;
          }
          const entry = storedHashes[idx] as unknown as Record<string, unknown>;
          if (!verifyAnswerAgainstEntry(answer, entry)) {
            incorrectIndexes.push(idx);
            continue;
          }
          correctIndexes.push(idx);
        }

        const achieved = {
          correctCount: correctIndexes.length,
          points: 0,
        };

        let canEnforcePoints = true;
        for (const idx of correctIndexes) {
          const entry = storedHashes[idx] as unknown as Record<string, unknown>;
          const { points } = getEntryPoints(entry);
          if (points == null) {
            canEnforcePoints = false;
            continue;
          }
          achieved.points += points;
        }

        const policy = unlockPolicyV1;
        const meetsCorrectCount = achieved.correctCount >= policy.requiredCorrect;
        const meetsPoints = canEnforcePoints ? achieved.points >= policy.minPoints : true;

        const ok = meetsCorrectCount && meetsPoints;

        if (!ok) {
          return res.status(401).json({
            success: false,
            error: meetsCorrectCount ? "Unlock policy requirements not met." : "Incorrect answers to security questions. Please try again.",
            incorrectIndexes,
            unlockPolicy: policy,
            achieved,
            fallbackRequired: !canEnforcePoints,
          });
        }
      }
    }

    if (encryptionVersion === "v2-client") {
      // Client-side encrypted vault: do not decrypt payload here
      return res.status(200).json({
        success: true,
        message: "Access granted. Encrypted vault ready for client-side decryption.",
        encryptedVault,
        metadata,
      });
    }

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
          metadata: {
            ...metadata,
            encryptionVersion,
          },
          legacy: {
            encryptionVersion,
            isPqcEnabled: true,
          },
        });
      } catch (error) {
        console.error("❌ Failed to decrypt PQC vault during unlock:", error);
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
      metadata: {
        ...metadata,
        encryptionVersion,
      },
      legacy: {
        encryptionVersion,
        isPqcEnabled: false,
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

    console.error("❌ Failed to unlock vault:", error);
    if (error instanceof Error && (error.message.includes("pending") || error.message.includes("Newer version"))) {
      return res.status(202).json({
        success: false,
        error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
        originalError: error.message
      });
    }
    next(error);
  }
});

// Claim endpoint schema - for claiming vault with full PQC support
const claimSchema = z.object({
  vaultId: z.string().min(1),
  arweaveTxId: z.string().optional(),
  fractionKeys: z.array(z.string().min(1)).min(3),
  securityAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .min(3),
  beneficiaryEmail: z.string().email(),
});

// Claim vault endpoint - supports both classic and PQC hybrid decryption
vaultRouter.post("/claim", async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend claim (server-side decryption) is deprecated. Use /unlock and decrypt on the client instead.",
  });
});

const editSchema = z.object({
  willDetails: z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    documents: z
      .array(
        z.object({
          name: z.string(),
          size: z.number(),
          type: z.string(),
          content: z.string().optional(), // base64 encoded file content (optional for backward compatibility)
        }),
      )
      .optional()
      .default([]),
  }),
  fractionKeys: z.array(z.string().min(1)).min(3),
  // Optional: New security questions to replace existing ones
  securityQuestions: z
    .array(
      z.object({
        question: z.string().min(1, "Question is required"),
        answer: z.string().min(1, "Answer is required"),
      }),
    )
    .min(3, "Minimum 3 security questions required")
    .optional(),
  arweaveTxId: z.string().optional(),
});

// Create new version of an existing vault (editable) using the same master key
vaultRouter.post("/:vaultId/edit", async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend edit (server-side decryption/re-encryption) is deprecated. Re-encrypt on the client and call /prepare-client instead.",
  });
});

const previewSchema = z.object({
  fractionKeys: z.array(z.string().min(1)).min(3),
  arweaveTxId: z.string().optional(),
  securityQuestionAnswers: z
    .array(
      z.object({
        question: z.string().optional(),
        answer: z.string(),
      }),
    )
    .optional(),
});

// Get current title & content of inheritance (latest version) to prefill edit form
vaultRouter.post("/:vaultId/preview", async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend preview (server-side decryption) is deprecated. Use /unlock and decrypt on the client instead.",
  });
});

vaultRouter.post("/:vaultId/security-questions", async (req, res) => {
  try {
    const { vaultId } = req.params;

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
      });
    }

    // Fetch vault payload from blockchain storage to get security questions from metadata
    // Does not decrypt or return secret answers.
    const arweaveTxId = req.body.arweaveTxId;
    const uploadPayload = await fetchVaultPayloadById(vaultId, arweaveTxId);

    // Import decrypt function
    const { decryptQuestion } = await import("../services/vault-service.js");

    // Get security question hashes from metadata (obfuscated format)
    const securityQuestionHashes = uploadPayload.metadata?.securityQuestionHashes as Array<{
      q?: string;                   // Obfuscated: encrypted question
      a?: string;                   // Obfuscated: answer hash
      encryptedQuestion?: string;   // Legacy format
      question?: string;            // Very old format (plain text)
      answerHash?: string;          // Legacy format
    }> | undefined;
    
    let securityQuestions: string[] = [];
    
    if (securityQuestionHashes && securityQuestionHashes.length > 0) {
      // Decrypt each question from securityQuestionHashes
      securityQuestions = securityQuestionHashes.map((sq) => {
        // Try obfuscated format first (q)
        if (sq.q) {
          try {
            return decryptQuestion(sq.q, vaultId);
          } catch (error) {
            console.error("❌ Failed to decrypt question (q):", error);
          }
        }
        // Try legacy format (encryptedQuestion)
        if (sq.encryptedQuestion) {
          try {
            return decryptQuestion(sq.encryptedQuestion, vaultId);
          } catch (error) {
            console.error("❌ Failed to decrypt question:", error);
          }
        }
        // Fallback to plain text (very old format)
        if (sq.question) {
          return sq.question;
        }
        return "[Question not available]";
      });
    } else {
      // Fallback: check old separate field (backward compatibility)
      securityQuestions = (uploadPayload.metadata?.securityQuestions as string[]) || [];
    }
    
    // Get willType from metadata for initial validation
    const willType = (uploadPayload.metadata?.willType as "one-time" | "editable") || "one-time";
    
    // Get trigger release from metadata for opening time validation
    const trigger = uploadPayload.metadata?.trigger as {
      triggerType?: "date" | "death" | "manual";
      triggerDate?: string;
    } | undefined;

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
    if (error instanceof Error && (error.message.includes("pending") || error.message.includes("Newer version"))) {
      return res.status(202).json({
        success: false,
        error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
        originalError: error.message
      });
    }
    return res.status(404).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Vault not found",
    });
  }
});

// Schema for validating security question answers
const verifySecurityQuestionsSchema = z.object({
  claimNonce: z.string().optional(),
  securityQuestionAnswers: z
    .array(
      z.object({
        index: z.number().int().min(0).optional(),
        question: z.string().optional(),
        answer: z.string().min(1).max(256),
      }),
    )
    .min(3, "At least 3 security question answers are required")
    .max(20),
  arweaveTxId: z.string().optional(),
});

// Endpoint to validate security question answers without requiring fraction keys
// Uses hashes stored in metadata
vaultRouter.post("/:vaultId/verify-security-questions", async (req, res) => {
  try {
    const { vaultId } = req.params;
    const parsed = verifySecurityQuestionsSchema.parse(req.body);

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
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

    // Fetch vault payload from blockchain storage
    const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);

    const storedHashes = (uploadPayload.metadata?.securityQuestionHashes as Array<{
      q?: string;
      a?: string;
      question?: string;
      answerHash?: string;
      hashes?: string[];
      mode?: string;
      normalizationProfile?: string;
      profileVersion?: number;
      scoreTier?: string;
      points?: number;
    }>) || [];

    // If no hashes stored (old vault), treat as unsupported legacy vault
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
      return res.status(400).json({
        success: false,
        error: "Invalid claim nonce.",
      });
    }

    const providedAnswers = parsed.securityQuestionAnswers;
    const answersByIndex = new Map<number, string>();
    for (let i = 0; i < providedAnswers.length; i += 1) {
      const provided = providedAnswers[i];
      const idx = typeof provided.index === "number" ? provided.index : i;
      if (!answersByIndex.has(idx)) {
        answersByIndex.set(idx, provided.answer);
      }
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
      if (!answer) {
        incorrectIndexes.push(idx);
        continue;
      }
      const entry = storedHashes[idx] as unknown as Record<string, unknown>;
      if (!verifyAnswerAgainstEntry(answer, entry)) {
        incorrectIndexes.push(idx);
        continue;
      }
      correctIndexes.push(idx);
    }

    const achieved = {
      correctCount: correctIndexes.length,
      points: 0,
    };

    let canEnforcePoints = true;
    for (const idx of correctIndexes) {
      const entry = storedHashes[idx] as unknown as Record<string, unknown>;
      const { points } = getEntryPoints(entry);
      if (points == null) {
        canEnforcePoints = false;
        continue;
      }
      achieved.points += points;
    }

    const policy = unlockPolicyV1;
    const meetsCorrectCount = achieved.correctCount >= policy.requiredCorrect;
    const meetsPoints = canEnforcePoints ? achieved.points >= policy.minPoints : true;

    const ok = meetsCorrectCount && meetsPoints;
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: meetsCorrectCount ? "Unlock policy requirements not met." : "Security question answers do not match.",
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
    if (error instanceof Error && (error.message.includes("pending") || error.message.includes("Newer version"))) {
      return res.status(202).json({
        success: false,
        error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
        originalError: error.message
      });
    }
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An error occurred while validating answers.",
    });
  }
});

// Schema for validating fraction keys
const verifyFractionKeysSchema = z.object({
  fractionKeys: z.object({
    key1: z.string().min(1, "Fraction Key #1 is required"),
    key2: z.string().min(1, "Fraction Key #2 is required"),
    key3: z.string().min(1, "Fraction Key #3 is required"),
  }),
  arweaveTxId: z.string().optional(),
});

// Endpoint to validate fraction keys without returning vault content
vaultRouter.post("/:vaultId/verify-fraction-keys", async (req, res) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend fraction key verification is deprecated. Unlock and decrypt on the client instead.",
  });
});

/*
vaultRouter.post("/:vaultId/verify-fraction-keys", async (req, res) => {
  try {
    const { vaultId } = req.params;
    const parsed = verifyFractionKeysSchema.parse(req.body);

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
      });
    }

    const fractionKeysArray = [
      parsed.fractionKeys.key1,
      parsed.fractionKeys.key2,
      parsed.fractionKeys.key3,
    ];

    // Validation: all fraction keys must be unique
    const uniqueFractionKeys = new Set(fractionKeysArray.map(k => k.trim()));
    if (uniqueFractionKeys.size !== 3) {
      return res.status(400).json({
        success: false,
        error: "Fraction Keys must be unique. Duplicates are not allowed.",
      });
    }

    // Fetch vault payload from blockchain storage
    const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
    const encryptedVault = uploadPayload.encryptedData;

    // Check if vault uses PQC
    const isPqcEnabled = uploadPayload.metadata?.isPqcEnabled === true;

    // Try to combine fraction keys
    let combinedKeyBuffer: Buffer;
    try {
      combinedKeyBuffer = combineShares(fractionKeysArray);
    } catch (error) {
      console.error("❌ Fraction keys combine failed:", error);
      return res.status(400).json({
        success: false,
        error: "Invalid fraction keys. Make sure all 3 fraction keys are correct.",
      });
    }

    // Try to decrypt to validate fraction keys are correct
    try {
      if (isPqcEnabled) {
        const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
        const hybridEncrypted = encryptedVault as unknown as HybridEncryptedVault;
        decryptPayloadHybrid(hybridEncrypted, pqcSecretKey);
      } else {
        decryptPayload(encryptedVault as EncryptedVault, combinedKeyBuffer);
      }
    } catch (error) {
      console.error("❌ Fraction keys decryption validation failed:", error);
      return res.status(400).json({
        success: false,
        error: "Fraction keys do not match. Make sure all 3 fraction keys are correct.",
      });
    }

    // If we get here, fraction keys are valid
    return res.status(200).json({
      success: true,
      message: "Fraction keys are valid.",
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

    console.error("❌ Failed to validate fraction keys:", error);
    if (error instanceof Error && (error.message.includes("pending") || error.message.includes("Newer version"))) {
      return res.status(202).json({
        success: false,
        error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
        originalError: error.message
      });
    }
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An error occurred while validating fraction keys.",
    });
  }
});
*/

const downloadDocumentSchema = z.object({
  fractionKeys: z.array(z.string().min(1)).min(3),
  securityQuestionAnswers: z
    .array(
      z.object({
        question: z.string().optional(),
        answer: z.string(),
      }),
    )
    .optional(),
  documentIndex: z.number().int().min(0).optional(),
  documentName: z.string().optional(),
  arweaveTxId: z.string().optional(),
});

// Download document from vault
// Using POST instead of GET to avoid URL length limit issues with large fraction keys
vaultRouter.post("/:vaultId/document/:documentIndex", async (req, res, next) => {
  return res.status(410).json({
    success: false,
    error:
      "Backend document download is deprecated. Unlock and decrypt documents on the client instead.",
  });
});

/*
vaultRouter.post("/:vaultId/document/:documentIndex", async (req, res, next) => {
  try {
    const { vaultId, documentIndex } = req.params;
    const parsed = downloadDocumentSchema.parse({
      fractionKeys: req.body.fractionKeys || [],
      securityQuestionAnswers: req.body.securityQuestionAnswers,
      documentIndex: documentIndex ? parseInt(documentIndex, 10) : undefined,
      arweaveTxId: req.body.arweaveTxId,
    });

    if (!vaultId) {
      return res.status(400).json({
        success: false,
        error: "Vault ID is required.",
      });
    }

    const fractionKeys = parsed.fractionKeys;
    if (fractionKeys.length < 3) {
      return res.status(400).json({
        success: false,
        error: "At least 3 fraction keys are required to access documents.",
      });
    }

    const docIndex = parsed.documentIndex;
    if (docIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: "Document index is required.",
      });
    }

    // Fetch encrypted vault payload from blockchain storage
    const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
    const encryptedVault = uploadPayload.encryptedData;

    // Check if vault uses PQC
    const isPqcEnabled = uploadPayload.metadata?.isPqcEnabled === true;

    // Reconstruct master key from fraction keys
    let combinedKeyBuffer: Buffer;
    try {
      combinedKeyBuffer = combineShares(fractionKeys);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid fraction keys. Make sure all 3 fraction keys are correct.",
      });
    }

    // Decrypt payload with appropriate mode (PQC or Classic)
    let decrypted: VaultPayload;
    try {
      if (isPqcEnabled) {
        // PQC Mode: combinedKey is the PQC Secret Key
        console.log(`🔐 Download document: Decrypting PQC vault ${vaultId}...`);
        const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
        const hybridEncrypted = encryptedVault as unknown as HybridEncryptedVault;
        decrypted = decryptPayloadHybrid(hybridEncrypted, pqcSecretKey) as VaultPayload;
      } else {
        // Classic Mode: combinedKey is the AES Key
        console.log(`🔐 Download document: Decrypting classic vault ${vaultId}...`);
        decrypted = decryptPayload(encryptedVault as EncryptedVault, combinedKeyBuffer) as VaultPayload;
      }
    } catch (error) {
      console.error("❌ Download document: decryption failed:", error);
      return res.status(400).json({
        success: false,
        error: "Fraction keys do not match. Make sure all 3 fraction keys are correct.",
      });
    }

    // Verify security questions if provided
    if (parsed.securityQuestionAnswers && parsed.securityQuestionAnswers.length > 0) {
      const storedQuestions = decrypted.securityQuestions || [];
      const providedAnswers = parsed.securityQuestionAnswers;

      const allMatch = providedAnswers.every((provided) => {
        const match = storedQuestions.find(
          (sq) =>
            !provided.question ||
            sq.question === provided.question,
        );
        if (!match) return false;
        return match.answer.trim().toLowerCase() === provided.answer.trim().toLowerCase();
      });

      if (!allMatch) {
        return res.status(401).json({
          success: false,
          error: "Security question answers do not match.",
        });
      }
    }

    // Get document by index
    const documents = decrypted.willDetails?.documents || [];
    if (docIndex < 0 || docIndex >= documents.length) {
      return res.status(404).json({
        success: false,
        error: "Document not found.",
      });
    }

    const document = documents[docIndex];
    
    // If document has no content (backward compatibility), return error
    if (!document.content) {
      return res.status(404).json({
        success: false,
        error: "Document content not available. This document may have been created before the download feature was available.",
      });
    }

    // Decode base64 to buffer
    const fileBuffer = Buffer.from(document.content, "base64");

    // Set headers for download
    res.setHeader("Content-Type", document.type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(document.name)}"`);
    res.setHeader("Content-Length", fileBuffer.length);

    // Send file
    return res.send(fileBuffer);
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

    console.error("❌ Failed to download document:", error);
    if (error instanceof Error && (error.message.includes("pending") || error.message.includes("Newer version"))) {
      return res.status(202).json({
        success: false,
        error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
        originalError: error.message
      });
    }
    next(error);
  }
});
*/
