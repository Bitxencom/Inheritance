/**
 * Type definitions for Deheritance Unlock Extension
 */

/**
 * Encrypted vault structure from Arweave
 */
export type EncryptedVault = {
  cipherText: string;
  iv: string;
  checksum: string;
  pqcCipherText?: string;
  alg?: "AES-CBC" | "AES-GCM";
  keyMode?: "pqc" | "envelope";
};

export type ScoreTier = "low" | "medium" | "high";

export type UnlockPolicy = {
  policyVersion: number;
  requiredCorrect: number;
  minPoints: number;
};

/**
 * Security question hash format (supports both legacy and new format)
 */
export type SecurityQuestionHash = {
  // New obfuscated format
  q?: string;        // Encrypted question
  a?: string;        // Answer hash
  hashes?: string[];
  mode?: "exact" | "normalized" | "broad";
  normalizationProfile?: "none" | "default";
  profileVersion?: number;
  scoreTier?: ScoreTier;
  points?: 10 | 20 | 30;
  policyVersion?: number;

  // Legacy format
  question?: string;
  answerHash?: string;
  encryptedQuestion?: string;
};

/**
 * Vault metadata from Arweave
 */
export type VaultMetadata = {
  trigger?: {
    triggerType: "date" | "death" | "manual";
    triggerDate?: string;
  };
  beneficiaryCount?: number;
  securityQuestionHashes?: SecurityQuestionHash[];
  securityQuestions?: string[];  // Very old legacy format
  unlockPolicy?: UnlockPolicy;
  willType?: "one-time" | "editable";
  isPqcEnabled?: boolean;
  pqcPublicKey?: string;
  fractionKeyCommitments?: {
    scheme: "sha256";
    version: 1;
    byShareId: Record<string, string>;
    createdAt?: string;
  };
  encryptionVersion?: "v1-backend" | "v2-client" | "v3-envelope";
  contractEncryptedKey?: string;
  encryptedKey?: string;
  wrappedKey?: string;
  envelope?: {
    encryptedKey?: string;
  };
  blockchainChain?: string;
  contractAddress?: string;
  contractDataId?: string;
  /** Drand time-locked contract secret. Present when vault uses date-trigger + Drand. */
  sealedContractSecret?: string;
  /** Drand ronde number for the time-lock. */
  triggerRonde?: number;
};

/**
 * Raw payload stored on Arweave
 */
export type ArweaveVaultPayload = {
  id: string;           // Vault ID
  v?: number;           // Version
  t?: string;           // Type ("d" = document)
  m?: string;           // Encrypted metadata
  d?: EncryptedVault;   // Encrypted data

  // Legacy format fields
  vaultId?: string;
  encryptedData?: EncryptedVault;
  metadata?: VaultMetadata & {
    encryptedMetadata?: string;
  };
};

/**
 * Decrypted vault content
 */
export type DecryptedVaultContent = {
  willDetails?: {
    title?: string;
    content?: string;
    willType?: "one-time" | "editable";
    documents?: Array<{
      name: string;
      size: number;
      type: string;
      content?: string;  // Base64 encoded
    }>;
  };
  securityQuestions?: Array<{
    question: string;
    answer: string;
  }>;
  triggerRelease?: {
    triggerType: "date" | "death" | "manual";
    triggerDate?: string;
  };
  beneficiaries?: Array<{
    fullName: string;
    email: string;
    relationship?: string;
  }>;
};

/**
 * Result of unlock operation
 */
export type UnlockResult = {
  success: boolean;
  content?: DecryptedVaultContent;
  metadata?: VaultMetadata;
  error?: string;
};

/**
 * Fraction keys input (can be object or array)
 */
export type FractionKeysInput = {
  key1?: string;
  key2?: string;
  key3?: string;
  key4?: string;
  key5?: string;
} | string[];
