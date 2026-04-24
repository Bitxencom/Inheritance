/**
 * Client-side Vault Cryptography
 *
 * Handles AES and Post-Quantum decryption of vault payloads.
 * Supports both AES-CBC (bitxen legacy) and AES-GCM (deheritance).
 */

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import * as tlock from "tlock-js";
import { HttpChainClient, HttpCachingChain } from "drand-client";
// Side-effect: ensure Buffer polyfill is available for tlock-js in browser
import "buffer";
import type { EncryptedVault } from "./types";

const QUICKNET_URL = "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_CHAIN_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_PUBLIC_KEY = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";

export type WrappedKeyV1 = {
  schema: "bitxen-wrapped-key-v1";
  v: 1;
  alg: "AES-GCM";
  iv: string;
  checksum: string;
  cipherText: string;
};

/**
 * Get browser crypto API
 */
function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== "undefined") {
    return globalThis.crypto;
  }
  throw new Error("Web Crypto API not available");
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Uint8Array to ArrayBuffer
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Ensure we return a proper ArrayBuffer (not SharedArrayBuffer)
  const copy = new Uint8Array(bytes);
  return copy.buffer as ArrayBuffer;
}

/**
 * Calculate SHA-256 hash of ArrayBuffer
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await getCrypto().subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Import AES key for decryption
 */
async function importAesKey(
  keyBytes: Uint8Array,
  algorithm: "AES-CBC" | "AES-GCM"
): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: algorithm, length: 256 },
    false,
    ["decrypt"]
  );
}

/**
 * Decrypt using AES-CBC
 */
async function decryptAesCbc(
  cipherBuffer: ArrayBuffer,
  keyBytes: Uint8Array,
  iv: ArrayBuffer
): Promise<ArrayBuffer> {
  const aesKey = await importAesKey(keyBytes, "AES-CBC");
  return getCrypto().subtle.decrypt({ name: "AES-CBC", iv }, aesKey, cipherBuffer);
}

/**
 * Decrypt using AES-GCM  
 */
async function decryptAesGcm(
  cipherBuffer: ArrayBuffer,
  keyBytes: Uint8Array,
  iv: ArrayBuffer
): Promise<ArrayBuffer> {
  const aesKey = await importAesKey(keyBytes, "AES-GCM");
  return getCrypto().subtle.decrypt({ name: "AES-GCM", iv }, aesKey, cipherBuffer);
}

export async function deriveEffectiveAesKeyClient(
  encrypted: EncryptedVault,
  keyMaterial: Uint8Array
): Promise<Uint8Array> {
  if (typeof encrypted.pqcCipherText === "string" && encrypted.pqcCipherText.length > 0) {
    if (keyMaterial.length !== 2400) {
      throw new Error("Incorrect or mismatched Fraction Keys");
    }
    const pqcCipherText = fromBase64(encrypted.pqcCipherText);
    try {
      return ml_kem768.decapsulate(pqcCipherText, keyMaterial).slice(0, 32);
    } catch {
      throw new Error("Incorrect or mismatched Fraction Keys");
    }
  }

  if (keyMaterial.length === 32) return keyMaterial;

  const digest = await getCrypto().subtle.digest("SHA-256", toArrayBuffer(keyMaterial));
  return new Uint8Array(digest);
}

export async function decryptBytesClient(
  encrypted: { cipherBytes: ArrayBuffer | Uint8Array; iv: string; checksum?: string },
  key: Uint8Array
): Promise<Uint8Array> {
  const ivBytes = fromBase64(encrypted.iv);
  const inferredAlg: "AES-CBC" | "AES-GCM" = ivBytes.length === 12 ? "AES-GCM" : "AES-CBC";
  const aesKey = await importAesKey(key, inferredAlg);
  const iv = toArrayBuffer(ivBytes);
  const cipherBytes =
    encrypted.cipherBytes instanceof ArrayBuffer ? new Uint8Array(encrypted.cipherBytes) : encrypted.cipherBytes;
  const cipherBuffer = toArrayBuffer(cipherBytes);

  if (encrypted.checksum) {
    const actual = await sha256(cipherBuffer);
    if (actual !== encrypted.checksum) {
      throw new Error("Attachment checksum mismatch.");
    }
  }

  const plainBuffer = await getCrypto().subtle.decrypt(
    { name: inferredAlg, iv },
    aesKey,
    cipherBuffer
  );

  return new Uint8Array(plainBuffer);
}

export async function unwrapKeyClient(wrapped: WrappedKeyV1, wrappingKey: Uint8Array): Promise<Uint8Array> {
  if (wrapped.schema !== "bitxen-wrapped-key-v1" || wrapped.v !== 1) {
    throw new Error("Unsupported wrapped key format.");
  }
  const cipherBytes = fromBase64(wrapped.cipherText);
  return await decryptBytesClient(
    {
      cipherBytes,
      iv: wrapped.iv,
      checksum: wrapped.checksum,
    },
    wrappingKey
  );
}

/**
 * Decrypt vault payload with auto-detection of encryption scheme
 * 
 * Supports:
 * - AES-CBC (bitxen legacy) - IV 16 bytes
 * - AES-GCM (deheritance) - IV 12 bytes
 * - ML-KEM-768 + AES (PQC hybrid)
 * 
 * @param encrypted - Encrypted vault data from Arweave
 * @param key - Master key (combined from fraction keys or PQC secret key)
 * @returns Decrypted vault content
 */
export async function decryptVaultPayloadClient(
  encrypted: EncryptedVault,
  key: Uint8Array
): Promise<unknown> {
  // Step 1: Determine effective key
  // If PQC ciphertext exists, decapsulate to get AES key
  let effectiveKey = key;
  
  if (
    typeof encrypted.pqcCipherText === "string" &&
    encrypted.pqcCipherText.length > 0
  ) {
    if (key.length !== 2400) {
      throw new Error(
        "Incorrect or mismatched Fraction Keys"
      );
    }
    const pqcCipherText = fromBase64(encrypted.pqcCipherText);
    try {
      const sharedSecret = ml_kem768.decapsulate(pqcCipherText, key);
      effectiveKey = sharedSecret.slice(0, 32);
    } catch {
      throw new Error(
        "Incorrect or mismatched Fraction Keys"
      );
    }
  }

  // Step 2: Parse IV and ciphertext
  const ivBytes = fromBase64(encrypted.iv);
  const cipherBytes = fromBase64(encrypted.cipherText);
  const cipherBuffer = toArrayBuffer(cipherBytes);

  // Step 3: Verify checksum if present
  if (encrypted.checksum && encrypted.checksum.length > 0) {
    const actualChecksum = await sha256(cipherBuffer);
    if (actualChecksum !== encrypted.checksum) {
      throw new Error("Vault checksum mismatch. Data may be corrupted.");
    }
  }

  // Step 4: Auto-detect algorithm based on IV length or explicit flag
  const inferredAlg: "AES-CBC" | "AES-GCM" =
    encrypted.alg === "AES-CBC" || encrypted.alg === "AES-GCM"
      ? encrypted.alg
      : ivBytes.length === 12
        ? "AES-GCM"
        : "AES-CBC";

  // Step 5: Decrypt
  const iv = toArrayBuffer(ivBytes);
  let plainBuffer: ArrayBuffer;

  try {
    if (inferredAlg === "AES-GCM") {
      plainBuffer = await decryptAesGcm(cipherBuffer, effectiveKey, iv);
    } else {
      plainBuffer = await decryptAesCbc(cipherBuffer, effectiveKey, iv);
    }
  } catch (error) {
    // Try the other algorithm as fallback
    try {
      const fallbackAlg = inferredAlg === "AES-GCM" ? "AES-CBC" : "AES-GCM";
      if (fallbackAlg === "AES-GCM") {
        plainBuffer = await decryptAesGcm(cipherBuffer, effectiveKey, iv);
      } else {
        plainBuffer = await decryptAesCbc(cipherBuffer, effectiveKey, iv);
      }
    } catch {
      throw new Error(
        "Decryption failed. Please verify your fraction keys are correct."
      );
    }
  }

  // Step 6: Parse JSON
  const decoder = new TextDecoder();
  const json = decoder.decode(plainBuffer);
  
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Failed to parse decrypted vault content.");
  }
}

export async function decryptVaultPayloadRawKeyClient(
  encrypted: EncryptedVault,
  key: Uint8Array
): Promise<unknown> {
  const ivBytes = fromBase64(encrypted.iv);
  const cipherBytes = fromBase64(encrypted.cipherText);
  const cipherBuffer = toArrayBuffer(cipherBytes);

  if (encrypted.checksum && encrypted.checksum.length > 0) {
    const actualChecksum = await sha256(cipherBuffer);
    if (actualChecksum !== encrypted.checksum) {
      throw new Error("Vault checksum mismatch. Data may be corrupted.");
    }
  }

  const inferredAlg: "AES-CBC" | "AES-GCM" =
    encrypted.alg === "AES-CBC" || encrypted.alg === "AES-GCM"
      ? encrypted.alg
      : ivBytes.length === 12
        ? "AES-GCM"
        : "AES-CBC";

  const iv = toArrayBuffer(ivBytes);
  let plainBuffer: ArrayBuffer;

  try {
    if (inferredAlg === "AES-GCM") {
      plainBuffer = await decryptAesGcm(cipherBuffer, key, iv);
    } else {
      plainBuffer = await decryptAesCbc(cipherBuffer, key, iv);
    }
  } catch {
    throw new Error("Decryption failed. Please verify your fraction keys are correct.");
  }

  const decoder = new TextDecoder();
  const json = decoder.decode(plainBuffer);

  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Failed to parse decrypted vault content.");
  }
}

/**
 * Derive a key from vault ID using PBKDF2
 * Used for metadata encryption/decryption
 */
export async function deriveKeyFromVaultId(vaultId: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await getCrypto().subtle.importKey(
    "raw",
    encoder.encode(vaultId),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Salt must match bitxen-inheritance backend: "wishlist-ai-security-questions-v1"
  const salt = encoder.encode("wishlist-ai-security-questions-v1");
  const derivedBits = await getCrypto().subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Decrypt encrypted metadata using vault ID derived key
 * Supports multiple formats:
 * - v3: Base64(IV:12 + AuthTag:16 + CipherText) with AAD=vaultId
 * - Legacy: Base64(IV:16 + CipherText) AES-CBC or iv:ciphertext format
 */
export async function decryptMetadata(
  encryptedMetadata: string,
  vaultId: string
): Promise<Record<string, unknown>> {
  const key = await deriveKeyFromVaultId(vaultId);
  
  // Handle v3 format: v3:Base64(iv:12 + authTag:16 + cipherText)
  if (encryptedMetadata.startsWith("v3:")) {
    const raw = fromBase64(encryptedMetadata.slice(3)); // Remove "v3:" prefix
    const iv = raw.slice(0, 12);
    const authTag = raw.slice(12, 28);
    const cipherText = raw.slice(28);
    
    // Web Crypto API expects authTag appended to ciphertext for AES-GCM
    const cipherWithTag = new Uint8Array(cipherText.length + authTag.length);
    cipherWithTag.set(cipherText);
    cipherWithTag.set(authTag, cipherText.length);
    
    const aesKey = await importAesKey(key, "AES-GCM");
    const aadBuffer = new TextEncoder().encode(vaultId);
    
    const plainBuffer = await getCrypto().subtle.decrypt(
      { 
        name: "AES-GCM", 
        iv: toArrayBuffer(iv),
        additionalData: aadBuffer
      },
      aesKey,
      toArrayBuffer(cipherWithTag)
    );
    
    return JSON.parse(new TextDecoder().decode(plainBuffer));
  }
  
  // Handle legacy iv:ciphertext format (both base64)
  const parts = encryptedMetadata.split(":");
  if (parts.length === 2) {
    const iv = fromBase64(parts[0]);
    const cipherText = fromBase64(parts[1]);
    
    const aesKey = await importAesKey(key, "AES-GCM");
    const plainBuffer = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(cipherText)
    );
    
    return JSON.parse(new TextDecoder().decode(plainBuffer));
  }
  
  // Handle very old legacy format: Base64(IV:16 + CipherText) AES-CBC
  const buffer = fromBase64(encryptedMetadata);
  const iv = buffer.slice(0, 16);
  const cipherText = buffer.slice(16);
  
  const aesKey = await importAesKey(key, "AES-CBC");
  const plainBuffer = await getCrypto().subtle.decrypt(
    { name: "AES-CBC", iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(cipherText)
  );
  
  return JSON.parse(new TextDecoder().decode(plainBuffer));
}

/**
 * Derive unlock key from fraction keys combined key + releaseEntropy from blockchain.
 * This is required for "envelope" keyMode vaults (Bitxen3 contract).
 * 
 * The unlock key is derived using PBKDF2 with:
 * - input: shareKey (combined fraction keys → effective AES key)
 * - salt: releaseEntropy + ":" + chainId + ":" + contractAddress
 * 
 * This must match the derivation in bitxen-inheritance/frontend/lib/clientVaultCrypto.ts
 */
export async function deriveUnlockKey(
  shareKey: Uint8Array,
  releaseEntropy: string,
  context: { contractAddress: string; chainId: number }
): Promise<Uint8Array> {
  const contextString = `${context.chainId}:${context.contractAddress}`;
  const saltRaw = releaseEntropy + ":" + contextString;
  const salt = new TextEncoder().encode(saltRaw);

  const baseKey = await getCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(shareKey),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await getCrypto().subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Decrypt a single security question using vault ID derived key
 * Format: Base64(IV:16 + CipherText) with AES-256-CBC
 */
export async function decryptSecurityQuestion(
  encryptedQuestion: string,
  vaultId: string
): Promise<string> {
  try {
    // Security questions are encrypted as: Base64(IV:16 + CipherText) with AES-CBC
    const buffer = fromBase64(encryptedQuestion);
    
    if (buffer.length < 17) {
      // Too short to be encrypted, return as-is
      return encryptedQuestion;
    }
    
    const iv = buffer.slice(0, 16);
    const cipherText = buffer.slice(16);
    
    const key = await deriveKeyFromVaultId(vaultId);
    const aesKey = await importAesKey(key, "AES-CBC");

    const plainBuffer = await getCrypto().subtle.decrypt(
      { name: "AES-CBC", iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(cipherText)
    );

    return new TextDecoder().decode(plainBuffer);
  } catch {
    // Decryption failed, return original (might be plain text)
    return encryptedQuestion;
  }
}

/**
 * Recovers a payload from a Drand-sealed record (time-lock decryption).
 * Used when a vault has `sealedContractSecret` in metadata — the secret
 * is time-locked via Drand and can only be recovered after the target ronde.
 */
export async function recoverWithDrand(sealedRecord: string): Promise<Uint8Array> {
  const chainClient = new HttpChainClient(new HttpCachingChain(QUICKNET_URL), {
    disableBeaconVerification: false,
    noCache: false,
    chainVerificationParams: {
      chainHash: QUICKNET_CHAIN_HASH,
      publicKey: QUICKNET_PUBLIC_KEY,
    },
  });

  const recovered = await tlock.timelockDecrypt(sealedRecord, chainClient);
  // tlock-js returns a Buffer; normalise to plain Uint8Array
  return new Uint8Array(recovered);
}
