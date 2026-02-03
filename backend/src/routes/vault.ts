import { Router } from "express";
import { z } from "zod";

import { prepareVault, verifySecurityAnswer, encryptMetadata, hashSecurityQuestionAnswers } from "../services/vault-service.js";
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
    paymentMethod: z.enum(["wander"]),
  }),
  enablePqc: z.boolean().optional().default(true),
});

export const vaultRouter = Router();

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

// Endpoint to prepare vault (encrypt only) without upload
// Frontend will receive encrypted payload and upload it via Wander Wallet
vaultRouter.post("/prepare", async (req, res, next) => {
  try {
    // Validate request body
    const parsed = vaultSchema.parse(req.body);
    const result = await prepareVault(parsed);

    return res.status(200).json({
      success: true,
      message: "Vault ready for encryption.",
      details: result,
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
  fractionKeys: z.array(z.string().min(1)).min(1),
  securityQuestionAnswers: z
    .array(
      z.object({
        question: z.string().optional(),
        answer: z.string(),
      }),
    )
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

    // Ensure fractionKeys count meets Shamir threshold
    const fractionKeys = parsed.fractionKeys;
    if (fractionKeys.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Please provide at least 3 Fraction Keys to unlock the vault.",
      });
    }

    // Fetch encrypted vault payload from blockchain storage based on Vault-Id
    const arweaveTxId = req.body.arweaveTxId;
    const uploadPayload = await fetchVaultPayloadById(vaultId, arweaveTxId);
    const encryptedVault = uploadPayload.encryptedData as EncryptedVault;

    // Reconstruct master key from fraction keys (Shamir combine)
    const combinedKeyBuffer = combineShares(fractionKeys);

    // Check if vault uses PQC
    const isPqcEnabled = uploadPayload.metadata?.isPqcEnabled === true;
    let decrypted: VaultPayload;

    if (isPqcEnabled) {
        // PQC Mode: combinedKey is PQC Secret Key
      console.log(`🔐 Unlocking PQC vault ${vaultId}...`);
      try {
        const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
        const hybridEncrypted = encryptedVault as unknown as HybridEncryptedVault;
        decrypted = decryptPayloadHybrid(hybridEncrypted, pqcSecretKey) as VaultPayload;
      } catch (error) {
        console.error("❌ PQC decryption failed:", error);
        return res.status(400).json({
          success: false,
          error: "Decryption failed. Please check your Fraction Keys and try again.",
        });
      }
    } else {
        // Classic Mode: combinedKey is AES Key
      console.log(`🔐 Unlocking classic vault ${vaultId}...`);
      try {
        decrypted = decryptPayload(encryptedVault, combinedKeyBuffer) as VaultPayload;
      } catch (error) {
        console.error("❌ Classic decryption failed:", error);
        return res.status(400).json({
          success: false,
          error: "Unable to unlock. Please verify your Fraction Keys.",
        });
      }
    }

    // (Optional) Verify security questions if provided
    if (parsed.securityQuestionAnswers && parsed.securityQuestionAnswers.length > 0) {
      const providedAnswers = parsed.securityQuestionAnswers;
      const storedHashes = (uploadPayload.metadata?.securityQuestionHashes as Array<{
        a?: string;
        answerHash?: string;
      }>) || [];

      const allMatch =
        storedHashes.length > 0
          ? providedAnswers.every((provided, index) => {
              if (index >= storedHashes.length) return false;
              const storedHash = storedHashes[index].a || storedHashes[index].answerHash;
              return typeof storedHash === "string" && verifySecurityAnswer(provided.answer, storedHash);
            })
          : (() => {
              const storedQuestions = decrypted.securityQuestions || [];
              return providedAnswers.every((provided) => {
                const match = storedQuestions.find(
                  (sq) => !provided.question || sq.question === provided.question,
                );
                if (!match) return false;
                return match.answer.trim().toLowerCase() === provided.answer.trim().toLowerCase();
              });
            })();

      if (!allMatch) {
        return res.status(401).json({
          success: false,
          error: "Incorrect answers to security questions. Please try again.",
        });
      }
    }

    // If all OK, return inheritance content (not the entire sensitive payload)
    // Include document metadata (without content for security) so user knows what documents are available
    return res.status(200).json({
      success: true,
      message: "Access granted. Vault unlocked.",
      vaultContent: decrypted.willDetails?.content ?? null,
      vaultTitle: decrypted.willDetails?.title ?? null,
      trigger: decrypted.triggerRelease ?? null,
      // Return document metadata (name, size, type) without content for security
      documents: decrypted.willDetails?.documents?.map((doc) => ({
        name: doc.name,
        size: doc.size,
        type: doc.type,
        // Don't include content in unlock response for security
        // User can download documents via /document/:documentIndex endpoint if needed
      })) ?? [],
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
  try {
    const parsed = claimSchema.parse(req.body);
    const { vaultId, fractionKeys, securityAnswers, beneficiaryEmail } = parsed;

    console.log(`🔓 Claim request for vault ${vaultId} by ${beneficiaryEmail}`);

    // Fetch vault from blockchain storage
    const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
    const encryptedData = uploadPayload.encryptedData;
    const metadata = uploadPayload.metadata || {};

    // Check if vault uses PQC encryption
    const isPqcEnabled = metadata.isPqcEnabled === true;

    // Verify security questions using stored hashes (obfuscated format)
    const storedHashes = (metadata.securityQuestionHashes as Array<{
      q?: string;           // Obfuscated: encrypted question
      a?: string;           // Obfuscated: answer hash
      question?: string;    // Legacy
      answerHash?: string;  // Legacy
    }>) || [];

    if (storedHashes.length > 0) {
      // Validate by index since questions are encrypted/obfuscated
      const allMatch = securityAnswers.every((provided, index) => {
        if (index >= storedHashes.length) return false;
        
        // Support obfuscated (a) and legacy (answerHash)
        const storedHash = storedHashes[index].a || storedHashes[index].answerHash;
        return typeof storedHash === "string" && verifySecurityAnswer(provided.answer, storedHash);
      });

      if (!allMatch) {
        return res.status(401).json({
          success: false,
          error: "Incorrect answers to security questions. Please try again.",
        });
      }
    }

    let decrypted: VaultPayload;

    if (isPqcEnabled) {
      // PQC Hybrid Mode: fractionKeys contain shares of PQC secret key
      console.log(`🔐 Decrypting vault ${vaultId} using PQC hybrid mode...`);

      try {
        // Combine fraction keys to reconstruct PQC secret key
        const pqcSecretKeyBuffer = combineShares(fractionKeys);
        const pqcSecretKey = new Uint8Array(pqcSecretKeyBuffer);

        // Decrypt using hybrid mode
        const hybridEncrypted = encryptedData as unknown as HybridEncryptedVault;
        decrypted = decryptPayloadHybrid(hybridEncrypted, pqcSecretKey) as VaultPayload;

        console.log(`✅ Vault ${vaultId} decrypted successfully with PQC`);
      } catch (error) {
        console.error("❌ PQC decryption failed:", error);
        return res.status(400).json({
          success: false,
          error: "Decryption failed. Please verify your Fraction Keys.",
        });
      }
    } else {
      // Classic Mode: fractionKeys contain shares of AES master key
      console.log(`🔐 Decrypting vault ${vaultId} using classic mode...`);

      try {
        const masterKey = combineShares(fractionKeys);
        decrypted = decryptPayload(encryptedData as EncryptedVault, masterKey) as VaultPayload;

        console.log(`✅ Vault ${vaultId} decrypted successfully with AES`);
      } catch (error) {
        console.error("❌ Classic decryption failed:", error);
        return res.status(400).json({
          success: false,
          error: "Decryption failed. Please verify your Fraction Keys.",
        });
      }
    }

    // Return decrypted content
    return res.status(200).json({
      success: true,
      message: `Inheritance successfully claimed${isPqcEnabled ? " with Post-Quantum decryption" : ""}.`,
      details: {
        vaultId,
        isPqcEnabled,
        decryptedData: {
          title: decrypted.willDetails?.title ?? null,
          content: decrypted.willDetails?.content ?? null,
          willType: decrypted.willDetails?.willType ?? null,
          documents: decrypted.willDetails?.documents?.map((doc) => ({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            // Include content for claim (different from unlock)
            content: doc.content,
          })) ?? [],
          beneficiaries: decrypted.beneficiaries ?? [],
          triggerRelease: decrypted.triggerRelease ?? null,
        },
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

    console.error("❌ Failed to claim vault:", error);
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
  try {
    const { vaultId } = req.params;
    const parsed = editSchema.parse(req.body);

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
        error: "At least 3 Fraction Keys are needed to edit.",
      });
    }

    // Fetch encrypted vault payload from blockchain storage based on Vault-Id
    const uploadPayload = await fetchVaultPayloadById(vaultId, parsed.arweaveTxId);
    const encryptedVault = uploadPayload.encryptedData;

    // Check if vault uses PQC
    const isPqcEnabled = uploadPayload.metadata?.isPqcEnabled === true;
    const pqcPublicKeyBase64 = uploadPayload.metadata?.pqcPublicKey as string | undefined;

    // Reconstruct master key from fraction keys (Shamir combine)
    let combinedKeyBuffer: Buffer;
    try {
      combinedKeyBuffer = combineShares(fractionKeys);
    } catch (error) {
      console.error("❌ Edit: fraction keys combine failed:", error);
      return res.status(400).json({
        success: false,
        error: "Invalid Fraction Keys. Please check and try again.",
      });
    }

    // Decrypt old payload
    let decrypted: VaultPayload;
    try {
      if (isPqcEnabled) {
        // PQC Mode: combinedKey is the PQC Secret Key
        console.log(`🔐 Edit: Decrypting PQC vault ${vaultId}...`);
        const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
        const hybridEncrypted = encryptedVault as unknown as HybridEncryptedVault;
        decrypted = decryptPayloadHybrid(hybridEncrypted, pqcSecretKey) as VaultPayload;
      } else {
        // Classic Mode: combinedKey is the AES Key
        console.log(`🔐 Edit: Decrypting classic vault ${vaultId}...`);
        decrypted = decryptPayload(encryptedVault as EncryptedVault, combinedKeyBuffer) as VaultPayload;
      }
    } catch (error) {
      console.error("❌ Edit: decryption failed:", error);
      return res.status(400).json({
        success: false,
        error: "Invalid Fraction Keys. Please check and try again.",
      });
    }

    // Validation: only vaults with willType "editable" can be edited
    if (decrypted.willDetails?.willType === "one-time") {
      return res.status(403).json({
        success: false,
        error: "This vault is Final (One-time) and cannot be edited.",
      });
    }

    // Ensure willType is "editable" (for additional security)
    if (decrypted.willDetails?.willType !== "editable") {
      return res.status(400).json({
        success: false,
        error: "Vault cannot be edited. Make sure vault was created with 'Editable' type.",
      });
    }

    // Create new payload with updated willDetails
    // If securityQuestions are provided, update them as well
    const updatedSecurityQuestions = parsed.securityQuestions
      ? parsed.securityQuestions
      : decrypted.securityQuestions;

    const updatedPayload: VaultPayload = {
      ...decrypted,
      // Update security questions if new ones are provided
      securityQuestions: updatedSecurityQuestions,
      willDetails: {
        ...decrypted.willDetails,
        title: parsed.willDetails.title,
        content: parsed.willDetails.content,
        // Keep willType as "editable"
        willType: "editable",
            // Update documents if provided, otherwise keep old documents
            // Ensure all documents have content (for backward compatibility, set empty string if not present)
            documents: (parsed.willDetails.documents ?? decrypted.willDetails?.documents ?? []).map(
              (doc) => ({
                ...doc,
                content: doc.content || "",
              }),
            ),
      },
    };

    // Re-encrypt with appropriate key
    let newEncryptedVault: EncryptedVault | HybridEncryptedVault;
    if (isPqcEnabled && pqcPublicKeyBase64) {
      // PQC Mode: re-encrypt using public key from metadata
      console.log(`🔐 Edit: Re-encrypting vault ${vaultId} with PQC...`);
      const pqcPublicKey = base64ToKey(pqcPublicKeyBase64);
      newEncryptedVault = {
        ...encryptPayloadHybrid(updatedPayload, pqcPublicKey),
        isPqcEnabled: true,
      } as HybridEncryptedVault;
    } else {
      // Classic Mode: re-encrypt with the same master key
      console.log(`🔐 Edit: Re-encrypting vault ${vaultId} with classic AES...`);
      newEncryptedVault = encryptPayload(updatedPayload, combinedKeyBuffer);
    }

    // Prepare obfuscated blockchain storage payload (for frontend to dispatch)
    // Format: { id, v, t, m, d } - looks like generic document storage
    
    // If new security questions are provided, hash them; otherwise keep the old hashes
    const securityQuestionHashes = parsed.securityQuestions
      ? hashSecurityQuestionAnswers(parsed.securityQuestions, vaultId)
      : uploadPayload.metadata?.securityQuestionHashes || [];

    const metadata = {
      trigger: updatedPayload.triggerRelease,
      beneficiaryCount: updatedPayload.beneficiaries.length,
      // Use new security question hashes if provided, otherwise keep existing
      securityQuestionHashes,
      // Keep willType in metadata so it can be accessed without decryption
      willType: updatedPayload.willDetails?.willType || "editable",
      // Keep PQC metadata
      isPqcEnabled,
      ...(isPqcEnabled && pqcPublicKeyBase64 ? { pqcPublicKey: pqcPublicKeyBase64 } : {}),
    };

    const arweavePayload = {
      id: vaultId,                              // vault ID
      v: 1,                                      // version
      t: "d",                                    // type: document
      m: encryptMetadata(metadata, vaultId),     // encrypted metadata
      d: newEncryptedVault,                      // encrypted data
    };

    return res.status(200).json({
      success: true,
      message: "Vault updated and ready for upload.",
      details: {
        vaultId,
        arweavePayload,
      },
      // Explicit flag for frontend to know it should dispatch
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

    console.error("❌ Failed to edit vault:", error);
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
  try {
    const { vaultId } = req.params;
    const parsed = previewSchema.parse(req.body);

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
        error: "At least 3 fraction keys are required to view inheritance content.",
      });
    }

    const uploadPayload = await fetchVaultPayloadById(vaultId);
    const encryptedVault = uploadPayload.encryptedData;

    // Check if vault uses PQC
    const isPqcEnabled = uploadPayload.metadata?.isPqcEnabled === true;

    let combinedKeyBuffer: Buffer;
    try {
      combinedKeyBuffer = combineShares(fractionKeys);
    } catch (error) {
      // Error from combineShares usually because fraction keys are invalid
      return res.status(400).json({
        success: false,
        error: "Invalid fraction keys. Make sure all 3 fraction keys are correct.",
      });
    }

    let decrypted: VaultPayload;
    try {
      if (isPqcEnabled) {
        // PQC Mode: combinedKey is the PQC Secret Key
        console.log(`🔐 Preview PQC vault ${vaultId}...`);
        const pqcSecretKey = new Uint8Array(combinedKeyBuffer);
        const hybridEncrypted = encryptedVault as unknown as HybridEncryptedVault;
        decrypted = decryptPayloadHybrid(hybridEncrypted, pqcSecretKey) as VaultPayload;
      } else {
        // Classic Mode: combinedKey is the AES Key
        console.log(`🔐 Preview classic vault ${vaultId}...`);
        decrypted = decryptPayload(encryptedVault as EncryptedVault, combinedKeyBuffer) as VaultPayload;
      }
    } catch (error) {
      // Error from decryptPayload usually because master key is wrong (fraction keys wrong)
      console.error("❌ Preview decryption failed:", error);
      return res.status(400).json({
        success: false,
        error: "Fraction keys do not match. Make sure all 3 fraction keys are correct.",
      });
    }

    // Verify security questions if provided
    if (parsed.securityQuestionAnswers && parsed.securityQuestionAnswers.length > 0) {
      const providedAnswers = parsed.securityQuestionAnswers;
      const storedHashes = (uploadPayload.metadata?.securityQuestionHashes as Array<{
        a?: string;
        answerHash?: string;
      }>) || [];

      const allMatch =
        storedHashes.length > 0
          ? providedAnswers.every((provided, index) => {
              if (index >= storedHashes.length) return false;
              const storedHash = storedHashes[index].a || storedHashes[index].answerHash;
              return typeof storedHash === "string" && verifySecurityAnswer(provided.answer, storedHash);
            })
          : (() => {
              const storedQuestions = decrypted.securityQuestions || [];
              return providedAnswers.every((provided) => {
                const match = storedQuestions.find(
                  (sq) => !provided.question || sq.question === provided.question,
                );
                if (!match) return false;
                return match.answer.trim().toLowerCase() === provided.answer.trim().toLowerCase();
              });
            })();

      if (!allMatch) {
        return res.status(401).json({
          success: false,
          error: "Security question answers do not match.",
        });
      }
    }

    // Validation: only vaults with willType "editable" can be edited
    if (decrypted.willDetails?.willType === "one-time") {
      return res.status(403).json({
        success: false,
        error: "Vault with 'One-time (final)' type cannot be edited. Only vaults with 'Editable' type can be changed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vault content retrieved.",
      willDetails: {
        title: decrypted.willDetails?.title ?? "",
        content: decrypted.willDetails?.content ?? "",
        willType: decrypted.willDetails?.willType ?? "editable",
        documents: decrypted.willDetails?.documents ?? [],
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

    console.error("❌ Failed to get inheritance preview:", error);
    
    // Make sure error message is clear for frontend
    if (error instanceof Error) {
      if (error.message.includes("pending") || error.message.includes("Newer version")) {
        return res.status(202).json({
          success: false,
          error: "The dispatched inheritance/vault is still being processed. This can take about 20 minutes.",
          originalError: error.message
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message || "An error occurred while getting inheritance preview.",
      });
    }
    
    next(error);
  }
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

    return res.status(200).json({
      success: true,
      securityQuestions,
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
  securityQuestionAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .min(1, "At least one security question answer is required"),
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

    // Fetch vault payload from blockchain storage
    const uploadPayload = await fetchVaultPayloadById(vaultId);

    // Get answer hashes from metadata (obfuscated format)
    const storedHashes = (uploadPayload.metadata?.securityQuestionHashes as Array<{
      q?: string;             // Obfuscated: encrypted question
      a?: string;             // Obfuscated: answer hash
      question?: string;      // Legacy: plain text question
      answerHash?: string;    // Legacy: answer hash
    }>) || [];

    // If no hashes stored (old vault), return special error
    if (storedHashes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "This vault does not support separate validation. Answers will be validated when opening the vault.",
        fallbackRequired: true,
      });
    }

    // Import hash function
    // Validate each answer
    const providedAnswers = parsed.securityQuestionAnswers;
    
    // Validate by order (index) and collect incorrect/correct indexes
    const incorrectIndexes: number[] = [];
    const correctIndexes: number[] = [];
    providedAnswers.forEach((provided, index) => {
      if (index >= storedHashes.length) {
        incorrectIndexes.push(index);
        return;
      }
      
      // Support obfuscated (a) and legacy (answerHash)
      const storedHash = storedHashes[index].a || storedHashes[index].answerHash;
      if (typeof storedHash !== "string" || !verifySecurityAnswer(provided.answer, storedHash)) {
        incorrectIndexes.push(index);
      } else {
        correctIndexes.push(index);
      }
    });

    if (incorrectIndexes.length > 0) {
      return res.status(401).json({
        success: false,
        error: "Security question answers do not match.",
        incorrectIndexes,
        correctIndexes,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Security question answers are valid.",
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
      const providedAnswers = parsed.securityQuestionAnswers;
      const storedHashes = (uploadPayload.metadata?.securityQuestionHashes as Array<{
        a?: string;
        answerHash?: string;
      }>) || [];

      const allMatch =
        storedHashes.length > 0
          ? providedAnswers.every((provided, index) => {
              if (index >= storedHashes.length) return false;
              const storedHash = storedHashes[index].a || storedHashes[index].answerHash;
              return typeof storedHash === "string" && verifySecurityAnswer(provided.answer, storedHash);
            })
          : (() => {
              const storedQuestions = decrypted.securityQuestions || [];
              return providedAnswers.every((provided) => {
                const match = storedQuestions.find(
                  (sq) => !provided.question || sq.question === provided.question,
                );
                if (!match) return false;
                return match.answer.trim().toLowerCase() === provided.answer.trim().toLowerCase();
              });
            })();

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
