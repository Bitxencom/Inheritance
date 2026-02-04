import { createHash, randomUUID, pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "crypto";

import { appEnv } from "../config/env.js";
import {
  encryptPayload,
  encryptPayloadHybrid,
  generateAesKey,
  HybridEncryptedVault,
} from "./crypto/aes.js";
import { splitKey } from "./crypto/shamir.js";
import {
  generatePqcKeyPair,
  serializeKeyPair,
} from "./crypto/pqc.js";
// import { uploadVaultPayload } from "./storage/arweave.js";
import {
  BeneficiaryInput,
  EncryptedVault,
  VaultCreationResult,
  VaultPayload,
  SerializedPqcKeyPair,
  ObfuscatedPayload,
} from "../types/vault.js";

const randomVaultId = () => randomUUID();

/**
 * Hash security question answer for validation without decryption
 * Uses SHA-256 with normalization (lowercase, trim)
 */
export const hashSecurityAnswer = (answer: string): string => {
  const normalized = answer.toLowerCase().trim();
  return createHash("sha256").update(normalized).digest("hex");
};

/**
 * Derive encryption key from vaultId using PBKDF2
 * Uses fixed salt so key can be re-derived with the same vaultId
 */
const deriveKeyFromVaultId = (vaultId: string): Buffer => {
  const salt = "wishlist-ai-security-questions-v1"; // Fixed salt for deterministic derivation
  return pbkdf2Sync(vaultId, salt, 100000, 32, "sha256");
};

/**
 * Encrypt a single question using vaultId
 */
const encryptQuestion = (question: string, vaultId: string): string => {
  const key = deriveKeyFromVaultId(vaultId);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(question, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, encrypted]).toString("base64");
};

/**
 * Decrypt a single question using vaultId
 */
export const decryptQuestion = (encryptedData: string, vaultId: string): string => {
  const key = deriveKeyFromVaultId(vaultId);
  const buffer = Buffer.from(encryptedData, "base64");
  const iv = buffer.subarray(0, 16);
  const encrypted = buffer.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

/**
 * Encrypt entire metadata object using vaultId
 * To hide sensitive metadata on blockchain storage
 */
export const encryptMetadata = (metadata: Record<string, unknown>, vaultId: string): string => {
  const key = deriveKeyFromVaultId(vaultId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(vaultId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(metadata), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `v3:${payload}`;
};

/**
 * Decrypt metadata object using vaultId
 */
export const decryptMetadata = (encryptedData: string, vaultId: string): Record<string, unknown> => {
  const key = deriveKeyFromVaultId(vaultId);
  if (encryptedData.startsWith("v3:")) {
    const raw = Buffer.from(encryptedData.slice("v3:".length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(vaultId, "utf8"));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  }

  if (encryptedData.startsWith("v2:")) {
    throw new Error("Unsupported metadata encryption version.");
  }

  const buffer = Buffer.from(encryptedData, "base64");
  const iv = buffer.subarray(0, 16);
  const encrypted = buffer.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
};

/**
 * Hash all security question answers and encrypt questions
 * New format: { encryptedQuestion, answerHash }
 */
export const hashSecurityQuestionAnswers = (
  securityQuestions: Array<{ question: string; answer: string }>,
  vaultId: string
): Array<{ q: string; a: string }> => {
  return securityQuestions.map((sq) => ({
    q: encryptQuestion(sq.question, vaultId),  // obfuscated key
    a: hashSecurityAnswer(sq.answer),           // obfuscated key
  }));
};

const distributeKeys = (
  beneficiaries: BeneficiaryInput[],
  keys: string[],
) => {
  if (beneficiaries.length === 0) {
    return [];
  }

  return beneficiaries.map((beneficiary, index) => {
    const key = keys[index % keys.length];
    return {
      beneficiary,
      key,
    };
  });
};

/**
 * Prepare vault for frontend dispatch to blockchain storage
 * Encrypts data but does NOT upload - returns payload for frontend to dispatch via Wander Wallet
 */
export interface PreparedVaultResult {
  vaultId: string;
  fractionKeys: string[];
  fractionKeyAssignments: Array<{ beneficiary: BeneficiaryInput; key: string }>;
  arweavePayload: {
    vaultId: string;
    encryptedData: EncryptedVault | HybridEncryptedVault;
    metadata: Record<string, unknown>;
  };
  encryptedVault: EncryptedVault | HybridEncryptedVault;
  pqcKeyPair?: SerializedPqcKeyPair;
}

export const prepareVault = async (
  payload: VaultPayload,
): Promise<PreparedVaultResult> => {
  const vaultId = randomVaultId();

  // Determine encryption mode
  const usePqc = payload.enablePqc === true;
  
  let encryptedVault: EncryptedVault | HybridEncryptedVault;
  let fractionKeys: string[];
  let pqcKeyPairSerialized: SerializedPqcKeyPair | undefined;

  if (usePqc) {
    // === PQC HYBRID MODE ===
    const pqcKeyPair = generatePqcKeyPair();
    pqcKeyPairSerialized = serializeKeyPair(pqcKeyPair);
    const hybridEncrypted = encryptPayloadHybrid(payload, pqcKeyPair.publicKey);
    encryptedVault = {
      ...hybridEncrypted,
      isPqcEnabled: true,
    } as HybridEncryptedVault;

    const secretKeyBuffer = Buffer.from(pqcKeyPairSerialized.secretKey, "base64");
    fractionKeys = splitKey(secretKeyBuffer, {
      totalShares: appEnv.shamirTotalShares,
      threshold: appEnv.shamirThreshold,
    });

    console.log(`🔐 Vault ${vaultId} prepared with PQC hybrid encryption (ML-KEM-768 + AES-256)`);
  } else {
    // === CLASSIC MODE ===
    const key = generateAesKey();
    encryptedVault = encryptPayload(payload, key);
    fractionKeys = splitKey(key, {
      totalShares: appEnv.shamirTotalShares,
      threshold: appEnv.shamirThreshold,
    });

    console.log(`🔐 Vault ${vaultId} prepared with classic encryption (AES-256 + Shamir)`);
  }

  const fractionKeyAssignments = distributeKeys(payload.beneficiaries, fractionKeys);

  // Hash answers and encrypt security questions
  // Obfuscated format: { q, a }
  const securityQuestionHashes = payload.securityQuestions
    ? hashSecurityQuestionAnswers(payload.securityQuestions, vaultId)
    : [];

  const metadata = {
    trigger: payload.triggerRelease,
    beneficiaryCount: payload.beneficiaries.length,
    securityQuestionHashes,
    willType: payload.willDetails?.willType || "one-time",
    isPqcEnabled: usePqc,
    encryptionVersion: "v1-backend",
    ...(usePqc && pqcKeyPairSerialized ? { pqcPublicKey: pqcKeyPairSerialized.publicKey } : {}),
  };

  // Prepare obfuscated Arweave payload (for frontend to dispatch)
  // Format: { id, v, t, m, d } - looks like generic document storage
  const arweavePayload = {
    id: vaultId,                              // vault ID
    v: 1,                                      // version
    t: "d",                                    // type: document
    m: encryptMetadata(metadata, vaultId),     // encrypted metadata
    d: encryptedVault,                         // encrypted data
  };

  return {
    vaultId,
    fractionKeys,
    fractionKeyAssignments,
    arweavePayload: arweavePayload as any,
    encryptedVault,
    ...(usePqc && pqcKeyPairSerialized ? { pqcKeyPair: pqcKeyPairSerialized } : {}),
  };
};
