/**
 * Post-Quantum Cryptography Service
 *
 * This module provides functions for Key Encapsulation Mechanism (KEM)
 * using ML-KEM (Kyber) according to NIST FIPS 203 standard.
 *
 * ML-KEM is used to secure AES key exchange from quantum computer threats.
 * Strategy: Hybrid Encryption - AES-256 for data, ML-KEM to protect AES key.
 */
import { ml_kem768 } from "@noble/post-quantum/ml-kem";

/**
 * ML-KEM-768 Key Pair
 * - publicKey: Used to encapsulate (wrap) the key
 * - secretKey: Used to decapsulate (unwrap) the key
 */
export type PqcKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

/**
 * Result from encapsulation process
 * - cipherText: Encrypted data sent to recipient
 * - sharedSecret: Shared secret key used for AES encryption
 */
export type EncapsulationResult = {
  cipherText: Uint8Array;
  sharedSecret: Uint8Array;
};

/**
 * Generate ML-KEM-768 key pair (PQC Key Pair)
 *
 * @returns PqcKeyPair - { publicKey, secretKey }
 */
export const generatePqcKeyPair = (): PqcKeyPair => {
  const keyPair = ml_kem768.keygen();
  return {
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  };
};

/**
 * Encapsulation: Wrap secret key using recipient's public key
 *
 * This process produces:
 * - cipherText: Sent to recipient along with encrypted data
 * - sharedSecret: Used as key for AES encryption
 *
 * @param recipientPublicKey - Recipient's ML-KEM public key
 * @returns EncapsulationResult - { cipherText, sharedSecret }
 */
export const encapsulate = (
  recipientPublicKey: Uint8Array,
): EncapsulationResult => {
  const result = ml_kem768.encapsulate(recipientPublicKey);
  return {
    cipherText: result.cipherText,
    sharedSecret: result.sharedSecret,
  };
};

/**
 * Decapsulation: Extract secret key using recipient's secret key
 *
 * This process extracts sharedSecret from cipherText using secretKey.
 * The resulting sharedSecret will be the same as the one used during encapsulation.
 *
 * @param cipherText - Ciphertext from encapsulation process
 * @param recipientSecretKey - Recipient's ML-KEM secret key
 * @returns Uint8Array - Shared secret for AES decryption
 */
export const decapsulate = (
  cipherText: Uint8Array,
  recipientSecretKey: Uint8Array,
): Uint8Array => {
  return ml_kem768.decapsulate(cipherText, recipientSecretKey);
};

/**
 * Serialize key to Base64 format for storage/transfer
 */
export const keyToBase64 = (key: Uint8Array): string => {
  return Buffer.from(key).toString("base64");
};

/**
 * Deserialize key from Base64 format
 */
export const base64ToKey = (base64: string): Uint8Array => {
  return new Uint8Array(Buffer.from(base64, "base64"));
};

/**
 * Serialize key pair to JSON-friendly format for storage
 */
export const serializeKeyPair = (
  keyPair: PqcKeyPair,
): { publicKey: string; secretKey: string } => {
  return {
    publicKey: keyToBase64(keyPair.publicKey),
    secretKey: keyToBase64(keyPair.secretKey),
  };
};

/**
 * Deserialize key pair from JSON format
 */
export const deserializeKeyPair = (serialized: {
  publicKey: string;
  secretKey: string;
}): PqcKeyPair => {
  return {
    publicKey: base64ToKey(serialized.publicKey),
    secretKey: base64ToKey(serialized.secretKey),
  };
};
