"use client";

import { ml_kem768 } from "@noble/post-quantum/ml-kem";

export type EncryptedVaultClient = {
  cipherText: string;
  iv: string;
  checksum: string;
  pqcCipherText?: string;
  alg?: "AES-CBC" | "AES-GCM";
  keyMode?: "pqc" | "envelope";
};

export type EncryptedBytesClient = {
  iv: string;
  checksum: string;
  cipherBytes: Uint8Array;
};

export type PqcKeyPairClient = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type WrappedKeyV1 = {
  schema: "bitxen-wrapped-key-v1";
  v: 1;
  alg: "AES-GCM";
  iv: string;
  checksum: string;
  cipherText: string;
};

export type ObfuscatedArweavePayloadClient = {
  id: string;
  v: 1;
  t: "d";
  m: string;
  d: EncryptedVaultClient;
};

function getCrypto(): Crypto {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return window.crypto;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function generateVaultKey(): Uint8Array {
  const crypto = getCrypto();
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

async function importAesKey(rawKey: Uint8Array, alg: "AES-CBC" | "AES-GCM"): Promise<CryptoKey> {
  const crypto = getCrypto();
  const normalized =
    rawKey.length === 32 ? rawKey : new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(rawKey)));
  const rawKeyBuffer = toArrayBuffer(normalized);
  return crypto.subtle.importKey(
    "raw",
    rawKeyBuffer,
    { name: alg },
    false,
    ["encrypt", "decrypt"],
  );
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const crypto = getCrypto();
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKeyFromVaultIdClient(vaultId: string): Promise<Uint8Array> {
  const crypto = getCrypto();
  const salt = new TextEncoder().encode("wishlist-ai-security-questions-v1");
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(vaultId), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );
  return new Uint8Array(derivedBits);
}

export async function encryptMetadataClient(metadata: Record<string, unknown>, vaultId: string): Promise<string> {
  const crypto = getCrypto();
  const keyBytes = await deriveKeyFromVaultIdClient(vaultId);
  const key = await importAesKey(keyBytes, "AES-GCM");

  const ivBytes = new Uint8Array(12);
  crypto.getRandomValues(ivBytes);

  const aad = new TextEncoder().encode(vaultId);
  const plain = new TextEncoder().encode(JSON.stringify(metadata));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes, additionalData: aad },
    key,
    plain,
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const tagLength = 16;
  if (encryptedBytes.length < tagLength) {
    throw new Error("Invalid AES-GCM ciphertext.");
  }
  const cipherText = encryptedBytes.subarray(0, encryptedBytes.length - tagLength);
  const tag = encryptedBytes.subarray(encryptedBytes.length - tagLength);

  const payload = new Uint8Array(ivBytes.length + tag.length + cipherText.length);
  payload.set(ivBytes, 0);
  payload.set(tag, ivBytes.length);
  payload.set(cipherText, ivBytes.length + tag.length);

  return `v3:${toBase64(payload)}`;
}

export async function prepareArweavePayloadClient(params: {
  vaultId: string;
  encryptedVault: EncryptedVaultClient;
  metadata: Record<string, unknown>;
}): Promise<ObfuscatedArweavePayloadClient> {
  const vaultId = String(params.vaultId || "").trim();
  if (!vaultId) throw new Error("Vault ID is required.");
  const m = await encryptMetadataClient(params.metadata, vaultId);
  return {
    id: vaultId,
    v: 1,
    t: "d",
    m,
    d: params.encryptedVault,
  };
}

export function generatePqcKeyPairClient(): PqcKeyPairClient {
  const keyPair = ml_kem768.keygen();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
}

export function encapsulatePqcClient(recipientPublicKey: Uint8Array): { pqcCipherText: string; sharedSecret: Uint8Array } {
  const result = ml_kem768.encapsulate(recipientPublicKey);
  return { pqcCipherText: toBase64(result.cipherText), sharedSecret: result.sharedSecret };
}

export async function deriveEffectiveAesKeyClient(
  encrypted: EncryptedVaultClient,
  keyMaterial: Uint8Array,
): Promise<Uint8Array> {
  if (typeof encrypted.pqcCipherText === "string" && encrypted.pqcCipherText.length > 0) {
    return ml_kem768.decapsulate(fromBase64(encrypted.pqcCipherText), keyMaterial).slice(0, 32);
  }

  if (keyMaterial.length === 32) return keyMaterial;

  const digest = await getCrypto().subtle.digest("SHA-256", toArrayBuffer(keyMaterial));
  return new Uint8Array(digest);
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof ArrayBuffer ? data : toArrayBuffer(data);
  return sha256(buffer);
}

export async function encryptBytesClient(
  plain: ArrayBuffer | Uint8Array,
  key: Uint8Array,
): Promise<EncryptedBytesClient> {
  const crypto = getCrypto();
  const aesKey = await importAesKey(key, "AES-GCM");
  const ivBytes = new Uint8Array(12);
  crypto.getRandomValues(ivBytes);
  const ivBuffer = toArrayBuffer(ivBytes);

  const plainBuffer = plain instanceof ArrayBuffer ? plain : toArrayBuffer(plain);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    aesKey,
    plainBuffer,
  );

  const checksum = await sha256(cipherBuffer);

  return {
    cipherBytes: new Uint8Array(cipherBuffer),
    iv: toBase64(ivBytes),
    checksum,
  };
}

export async function decryptBytesClient(
  encrypted: { cipherBytes: ArrayBuffer | Uint8Array; iv: string; checksum?: string },
  key: Uint8Array,
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
    cipherBuffer,
  );

  return new Uint8Array(plainBuffer);
}

export async function wrapKeyClient(keyToWrap: Uint8Array, wrappingKey: Uint8Array): Promise<WrappedKeyV1> {
  const wrapped = await encryptBytesClient(keyToWrap, wrappingKey);
  return {
    schema: "bitxen-wrapped-key-v1",
    v: 1,
    alg: "AES-GCM",
    iv: wrapped.iv,
    checksum: wrapped.checksum,
    cipherText: toBase64(wrapped.cipherBytes),
  };
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
    wrappingKey,
  );
}

export async function encryptVaultPayloadClient(
  payload: unknown,
  key: Uint8Array,
): Promise<EncryptedVaultClient> {
  const crypto = getCrypto();
  const aesKey = await importAesKey(key, "AES-GCM");
  const ivBytes = new Uint8Array(12);
  crypto.getRandomValues(ivBytes);
  const ivBuffer = toArrayBuffer(ivBytes);

  const serialized = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(serialized);
  const plainBuffer = toArrayBuffer(plainBytes);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    aesKey,
    plainBuffer,
  );

  const checksum = await sha256(cipherBuffer);

  return {
    cipherText: toBase64(cipherBuffer),
    iv: toBase64(ivBytes),
    checksum,
    alg: "AES-GCM",
  };
}

export async function decryptVaultPayloadClient(
  encrypted: EncryptedVaultClient,
  key: Uint8Array,
): Promise<unknown> {
  const effectiveKey =
    typeof encrypted.pqcCipherText === "string" && encrypted.pqcCipherText.length > 0
      ? ml_kem768.decapsulate(fromBase64(encrypted.pqcCipherText), key).slice(0, 32)
      : key;
  const ivBytes = fromBase64(encrypted.iv);
  const cipherBytes = fromBase64(encrypted.cipherText);
  const cipherBuffer = toArrayBuffer(cipherBytes);

  if (encrypted.checksum && encrypted.checksum.length > 0) {
    const actual = await sha256(cipherBuffer);
    if (actual !== encrypted.checksum) {
      throw new Error("Vault checksum mismatch.");
    }
  }

  const inferredAlg: "AES-CBC" | "AES-GCM" =
    encrypted.alg === "AES-CBC" || encrypted.alg === "AES-GCM"
      ? encrypted.alg
      : ivBytes.length === 12
        ? "AES-GCM"
        : "AES-CBC";

  const aesKey = await importAesKey(effectiveKey, inferredAlg);
  const iv = toArrayBuffer(ivBytes);

  const plainBuffer = await getCrypto().subtle.decrypt(
    { name: inferredAlg, iv },
    aesKey,
    cipherBuffer,
  );

  const decoder = new TextDecoder();
  const json = decoder.decode(plainBuffer);
  return JSON.parse(json) as unknown;
}

export async function decryptVaultPayloadRawKeyClient(
  encrypted: EncryptedVaultClient,
  key: Uint8Array,
): Promise<unknown> {
  const ivBytes = fromBase64(encrypted.iv);
  const cipherBytes = fromBase64(encrypted.cipherText);
  const cipherBuffer = toArrayBuffer(cipherBytes);

  if (encrypted.checksum && encrypted.checksum.length > 0) {
    const actual = await sha256(cipherBuffer);
    if (actual !== encrypted.checksum) {
      throw new Error("Vault checksum mismatch.");
    }
  }

  const inferredAlg: "AES-CBC" | "AES-GCM" =
    encrypted.alg === "AES-CBC" || encrypted.alg === "AES-GCM"
      ? encrypted.alg
      : ivBytes.length === 12
        ? "AES-GCM"
        : "AES-CBC";

  const aesKey = await importAesKey(key, inferredAlg);
  const iv = toArrayBuffer(ivBytes);

  const plainBuffer = await getCrypto().subtle.decrypt(
    { name: inferredAlg, iv },
    aesKey,
    cipherBuffer,
  );

  const decoder = new TextDecoder();
  const json = decoder.decode(plainBuffer);
  return JSON.parse(json) as unknown;
}
