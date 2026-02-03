/**
 * Unit tests for PQC (Post-Quantum Cryptography) service
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  generatePqcKeyPair,
  encapsulate,
  decapsulate,
  serializeKeyPair,
  deserializeKeyPair,
  keyToBase64,
  base64ToKey,
} from "./pqc.js";
import {
  encryptPayloadHybrid,
  decryptPayloadHybrid,
  decryptPayload,
} from "./aes.js";

describe("PQC Service - ML-KEM-768", () => {
  describe("Key Generation", () => {
    it("should generate valid ML-KEM-768 key pair", () => {
      const keyPair = generatePqcKeyPair();

      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);

      // ML-KEM-768 key sizes
      // Public key: 1184 bytes, Secret key: 2400 bytes
      expect(keyPair.publicKey.length).toBe(1184);
      expect(keyPair.secretKey.length).toBe(2400);
    });

    it("should generate different key pairs on each call", () => {
      const keyPair1 = generatePqcKeyPair();
      const keyPair2 = generatePqcKeyPair();

      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toEqual(keyPair2.secretKey);
    });
  });

  describe("Encapsulation / Decapsulation", () => {
    it("should encapsulate and decapsulate to same shared secret", () => {
      const keyPair = generatePqcKeyPair();

      // Encapsulate with public key
      const { cipherText, sharedSecret: encapSecret } = encapsulate(keyPair.publicKey);

      // Decapsulate with secret key
      const decapSecret = decapsulate(cipherText, keyPair.secretKey);

      // Shared secrets must be the same
      expect(Buffer.from(encapSecret)).toEqual(Buffer.from(decapSecret));
    });

    it("should produce different ciphertexts for same public key", () => {
      const keyPair = generatePqcKeyPair();

      const result1 = encapsulate(keyPair.publicKey);
      const result2 = encapsulate(keyPair.publicKey);

      // Ciphertext is different (due to randomness)
      expect(result1.cipherText).not.toEqual(result2.cipherText);

      // But both shared secrets are still valid when decapsulated
      const decap1 = decapsulate(result1.cipherText, keyPair.secretKey);
      const decap2 = decapsulate(result2.cipherText, keyPair.secretKey);

      expect(Buffer.from(result1.sharedSecret)).toEqual(Buffer.from(decap1));
      expect(Buffer.from(result2.sharedSecret)).toEqual(Buffer.from(decap2));
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize key pair correctly", () => {
      const original = generatePqcKeyPair();
      const serialized = serializeKeyPair(original);
      const deserialized = deserializeKeyPair(serialized);

      expect(Buffer.from(deserialized.publicKey)).toEqual(Buffer.from(original.publicKey));
      expect(Buffer.from(deserialized.secretKey)).toEqual(Buffer.from(original.secretKey));
    });

    it("should convert key to base64 and back", () => {
      const keyPair = generatePqcKeyPair();
      const base64 = keyToBase64(keyPair.publicKey);
      const restored = base64ToKey(base64);

      expect(Buffer.from(restored)).toEqual(Buffer.from(keyPair.publicKey));
    });
  });
});

describe("Hybrid Encryption - AES-256 + ML-KEM", () => {
  it("should encrypt and decrypt payload using hybrid mode", () => {
    const keyPair = generatePqcKeyPair();
    const testPayload = {
      message: "This is my digital inheritance",
      beneficiary: "John Doe",
      assets: ["Rumah", "Mobil", "Rekening Bank"],
    };

    // Encrypt with public key
    const encrypted = encryptPayloadHybrid(testPayload, keyPair.publicKey);

    expect(encrypted.cipherText).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.checksum).toBeDefined();
    expect(encrypted.pqcCipherText).toBeDefined();

    // Decrypt with secret key
    const decrypted = decryptPayloadHybrid(encrypted, keyPair.secretKey);

    expect(decrypted).toEqual(testPayload);
  });

  it("should fail to decrypt with wrong secret key", () => {
    const keyPair1 = generatePqcKeyPair();
    const keyPair2 = generatePqcKeyPair();

    const testPayload = { secret: "Top secret data" };

    // Encrypt with public key 1
    const encrypted = encryptPayloadHybrid(testPayload, keyPair1.publicKey);

    // Try to decrypt with secret key 2 - should fail or produce wrong result
    expect(() => {
      decryptPayloadHybrid(encrypted, keyPair2.secretKey);
    }).toThrow();
  });

  it("should handle large payloads", () => {
    const keyPair = generatePqcKeyPair();
    const largePayload = {
      data: "x".repeat(100000), // 100KB of data
      nested: {
        level1: {
          level2: {
            level3: Array.from({ length: 1000 }, (_, i) => i),
          },
        },
      },
    };

    const encrypted = encryptPayloadHybrid(largePayload, keyPair.publicKey);
    const decrypted = decryptPayloadHybrid(encrypted, keyPair.secretKey);

    expect(decrypted).toEqual(largePayload);
  });
});

describe("Classic Decrypt - AES-GCM compatibility", () => {
  it("should decrypt AES-GCM payload when IV is 12 bytes", () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const payload = { message: "hello", n: 1 };

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plain = Buffer.from(JSON.stringify(payload), "utf8");
    const cipherText = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const packed = Buffer.concat([cipherText, authTag]);

    const decrypted = decryptPayload(
      {
        cipherText: packed.toString("base64"),
        iv: iv.toString("base64"),
        checksum: "unused",
      },
      key,
    );

    expect(decrypted).toEqual(payload);
  });

  it("should fail to decrypt AES-GCM payload with wrong key", () => {
    const key = crypto.randomBytes(32);
    const wrongKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const payload = { secret: "nope" };

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plain = Buffer.from(JSON.stringify(payload), "utf8");
    const cipherText = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const packed = Buffer.concat([cipherText, authTag]);

    expect(() => {
      decryptPayload(
        {
          cipherText: packed.toString("base64"),
          iv: iv.toString("base64"),
          checksum: "unused",
        },
        wrongKey,
      );
    }).toThrow();
  });
});
