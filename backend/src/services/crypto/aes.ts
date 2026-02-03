import crypto from "crypto";

import { EncryptedVault } from "../../types/vault.js";
import {
  encapsulate,
  decapsulate,
  keyToBase64,
  base64ToKey,
} from "./pqc.js";

export type EncryptionResult = EncryptedVault & {
  key: Buffer;
};

/**
 * Hybrid encryption result (AES + PQC)
 * - All fields from EncryptedVault (cipherText, iv, checksum)
 * - pqcCipherText: ML-KEM ciphertext that wraps the AES key
 */
export type HybridEncryptedVault = EncryptedVault & {
  pqcCipherText: string; // Base64-encoded ML-KEM ciphertext
};

export const generateAesKey = (): Buffer => {
  return crypto.randomBytes(32); // 256-bit
};

const normalizeAes256Key = (key: Buffer): Buffer => {
  if (key.length === 32) return key;
  return crypto.createHash("sha256").update(key).digest();
};

export const encryptPayload = (
  payload: object,
  key: Buffer,
): EncryptedVault => {
  const iv = crypto.randomBytes(16); // 128-bit block size
  const cipher = crypto.createCipheriv("aes-256-cbc", normalizeAes256Key(key), iv);
  const serialized = JSON.stringify(payload);
  const cipherText = Buffer.concat([
    cipher.update(serialized, "utf8"),
    cipher.final(),
  ]);

  const checksum = crypto
    .createHash("sha256")
    .update(cipherText)
    .digest("hex");

  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    checksum,
  };
};

export const decryptPayload = (
  encrypted: EncryptedVault,
  key: Buffer,
): Record<string, unknown> => {
  const iv = Buffer.from(encrypted.iv, "base64");
  const cipherBuffer = Buffer.from(encrypted.cipherText, "base64");
  const encryptedWithAlg = encrypted as EncryptedVault & {
    alg?: "AES-CBC" | "AES-GCM";
  };

  const inferredAlg: "AES-CBC" | "AES-GCM" =
    encryptedWithAlg.alg === "AES-CBC" || encryptedWithAlg.alg === "AES-GCM"
      ? encryptedWithAlg.alg
      : iv.length === 12
        ? "AES-GCM"
        : "AES-CBC";

  const normalizedKey = normalizeAes256Key(key);

  const plain =
    inferredAlg === "AES-GCM"
      ? (() => {
          if (cipherBuffer.length < 16) {
            throw new Error("Invalid AES-GCM payload: missing auth tag.");
          }
          const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
          const cipherTextOnly = cipherBuffer.subarray(0, cipherBuffer.length - 16);
          const decipher = crypto.createDecipheriv("aes-256-gcm", normalizedKey, iv);
          decipher.setAuthTag(authTag);
          return Buffer.concat([decipher.update(cipherTextOnly), decipher.final()]);
        })()
      : (() => {
          const decipher = crypto.createDecipheriv("aes-256-cbc", normalizedKey, iv);
          return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
        })();

  return JSON.parse(plain.toString("utf8"));
};

/**
 * Hybrid Encryption: AES-256 + ML-KEM (Kyber)
 *
 * Process:
 * 1. Encapsulate using recipient's PQC public key → produces sharedSecret + cipherText
 * 2. Use sharedSecret as AES key for payload encryption
 * 3. Return AES encrypted data + PQC cipherText
 *
 * @param payload - Data to encrypt
 * @param recipientPqcPublicKey - Recipient's ML-KEM public key (Uint8Array)
 * @returns HybridEncryptedVault - Encrypted data with PQC metadata
 */
export const encryptPayloadHybrid = (
  payload: object,
  recipientPqcPublicKey: Uint8Array,
): HybridEncryptedVault => {
  // Step 1: Encapsulate using PQC public key
  const { cipherText: pqcCipherText, sharedSecret } = encapsulate(recipientPqcPublicKey);

  // Step 2: Use sharedSecret (32 bytes) as AES key
  const aesKey = Buffer.from(sharedSecret.slice(0, 32));

  // Step 3: Encrypt payload with AES
  const encryptedVault = encryptPayload(payload, aesKey);

  // Step 4: Return result with PQC ciphertext
  return {
    ...encryptedVault,
    pqcCipherText: keyToBase64(pqcCipherText),
  };
};

/**
 * Hybrid Decryption: ML-KEM (Kyber) + AES-256
 *
 * Process:
 * 1. Decapsulate PQC ciphertext using secret key → produces sharedSecret
 * 2. Use sharedSecret as AES key for payload decryption
 *
 * @param encrypted - Hybrid encrypted data (HybridEncryptedVault)
 * @param recipientPqcSecretKey - Recipient's ML-KEM secret key (Uint8Array)
 * @returns Record<string, unknown> - Decrypted data
 */
export const decryptPayloadHybrid = (
  encrypted: HybridEncryptedVault,
  recipientPqcSecretKey: Uint8Array,
): Record<string, unknown> => {
  // Step 1: Decapsulate to get sharedSecret
  const pqcCipherText = base64ToKey(encrypted.pqcCipherText);
  const sharedSecret = decapsulate(pqcCipherText, recipientPqcSecretKey);

  // Step 2: Use sharedSecret as AES key
  const aesKey = Buffer.from(sharedSecret.slice(0, 32));

  // Step 3: Decrypt payload
  return decryptPayload(encrypted, aesKey);
};
