export type BeneficiaryInput = {
  fullName: string;
  email: string;
  dateOfBirth: string;
  relationship: string;
  /** Optional: PQC public key for this beneficiary (Base64 encoded) */
  pqcPublicKey?: string;
};

export type VaultPayload = {
  willDetails: {
    willType: "one-time" | "editable";
    title: string;
    content: string;
    documents: { name: string; size: number; type: string; content: string }[]; // content sebagai base64
  };
  securityQuestions: {
    question: string;
    answer: string;
  }[];
  beneficiaries: BeneficiaryInput[];
  triggerRelease: {
    triggerType: "date" | "death" | "manual";
    triggerDate?: string;
  };
  payment: {
    paymentMethod: "wander";
  };
  /** Enable PQC hybrid encryption (ML-KEM + AES) */
  enablePqc?: boolean;
};

export type EncryptedVault = {
  cipherText: string;
  iv: string;
  checksum: string;
};

/**
 * Hybrid Encrypted Vault with PQC protection
 * Extends EncryptedVault with ML-KEM ciphertext
 */
export type HybridEncryptedVault = EncryptedVault & {
  /** ML-KEM ciphertext containing encapsulated key (Base64 encoded) */
  pqcCipherText: string;
  /** Indicates this vault uses PQC hybrid encryption */
  isPqcEnabled: true;
};

/**
 * PQC Key Pair (serialized as Base64 strings)
 */
export type SerializedPqcKeyPair = {
  publicKey: string;
  secretKey: string;
};

/**
 * Obfuscated format for Arweave storage
 */
export type ObfuscatedPayload = {
  id: string;   // vaultId
  v: number;    // version
  t: string;    // type: "d" = document
  m: string;    // encrypted metadata (base64)
  d: unknown;   // encrypted data
};

export type VaultCreationResult = {
  vaultId: string;
  rawShares: string[];
  shares: { beneficiary: BeneficiaryInput; share: string }[];
  arweaveTxId?: string; // Optional because prepareVault doesn't return txId
  arweavePayload?: ObfuscatedPayload; // Payload ready for dispatch
  encryptedVault: EncryptedVault | HybridEncryptedVault;
  /** PQC key pair generated for this vault (if PQC enabled) */
  pqcKeyPair?: SerializedPqcKeyPair;
};
