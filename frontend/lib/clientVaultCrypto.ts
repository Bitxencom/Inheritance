"use client";

import { ml_kem768 } from "@noble/post-quantum/ml-kem";

export type EncryptedVaultClient = {
  cipherText: string;
  iv: string;
  checksum: string;
  pqcCipherText?: string;
  alg?: "AES-CBC" | "AES-GCM";
};

export type EncryptedBytesClient = {
  iv: string;
  checksum: string;
  cipherBytes: Uint8Array;
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

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof ArrayBuffer ? data : toArrayBuffer(data);
  return sha256(buffer);
}

export async function encryptBytesClient(
  plain: ArrayBuffer | Uint8Array,
  key: Uint8Array,
): Promise<EncryptedBytesClient> {
  const crypto = getCrypto();
  const aesKey = await importAesKey(key, "AES-CBC");
  const ivBytes = new Uint8Array(16);
  crypto.getRandomValues(ivBytes);
  const ivBuffer = toArrayBuffer(ivBytes);

  const plainBuffer = plain instanceof ArrayBuffer ? plain : toArrayBuffer(plain);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ivBuffer },
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

export async function encryptVaultPayloadClient(
  payload: unknown,
  key: Uint8Array,
): Promise<EncryptedVaultClient> {
  const crypto = getCrypto();
  const aesKey = await importAesKey(key, "AES-CBC");
  const ivBytes = new Uint8Array(16);
  crypto.getRandomValues(ivBytes);
  const ivBuffer = toArrayBuffer(ivBytes);

  const serialized = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(serialized);
  const plainBuffer = toArrayBuffer(plainBytes);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ivBuffer },
    aesKey,
    plainBuffer,
  );

  const checksum = await sha256(cipherBuffer);

  return {
    cipherText: toBase64(cipherBuffer),
    iv: toBase64(ivBytes),
    checksum,
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
