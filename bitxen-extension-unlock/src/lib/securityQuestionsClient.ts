/**
 * Security Questions Client
 * 
 * Handles hashing and verification of security question answers.
 * Supports both SHA-256 (bitxen) and PBKDF2-SHA256 (deheritance) formats.
 */

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
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SecurityAnswerNormalizationProfile = "none" | "default";

function normalizeAnswer(answer: string, profile: SecurityAnswerNormalizationProfile): string {
  if (profile === "none") return answer;
  return answer.normalize("NFKC").toLowerCase().trim();
}

/**
 * Hash security answer using simple SHA-256 (bitxen format)
 * 
 * @param answer - The plain text answer
 * @returns Hex string hash
 */
export async function hashSecurityAnswerSHA256(answer: string): Promise<string> {
  const normalized = normalizeAnswer(answer, "default");
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await getCrypto().subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Hash security answer using PBKDF2-SHA256 (deheritance format)
 * 
 * Format: pbkdf2-sha256$iterations$saltBase64$hashHex
 * 
 * @param answer - The plain text answer
 * @param iterations - Number of PBKDF2 iterations (default: 210000)
 * @returns Formatted hash string
 */
export async function hashSecurityAnswerPBKDF2(
  answer: string,
  iterations: number = 210000,
  normalizationProfile: SecurityAnswerNormalizationProfile = "default",
): Promise<string> {
  const normalized = normalizeAnswer(answer, normalizationProfile);
  const encoder = new TextEncoder();
  
  // Generate random salt
  const salt = getCrypto().getRandomValues(new Uint8Array(16));
  
  // Import key material
  const keyMaterial = await getCrypto().subtle.importKey(
    "raw",
    encoder.encode(normalized),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  // Derive key bits
  const derivedBits = await getCrypto().subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  // Format output
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashHex = bufferToHex(derivedBits);
  
  return `pbkdf2-sha256$${iterations}$${saltBase64}$${hashHex}`;
}

/**
 * Verify an answer against a PBKDF2 hash
 * 
 * @param answer - The plain text answer to verify
 * @param storedHash - The stored PBKDF2 hash
 * @returns True if answer matches
 */
export async function verifyAnswerPBKDF2(
  answer: string,
  storedHash: string,
  normalizationProfile: SecurityAnswerNormalizationProfile = "default",
): Promise<boolean> {
  // Parse stored hash
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
    return false;
  }
  
  const iterations = parseInt(parts[1], 10);
  const saltBase64 = parts[2];
  const expectedHash = parts[3];
  
  // Decode salt
  const saltBinary = atob(saltBase64);
  const salt = new Uint8Array(saltBinary.length);
  for (let i = 0; i < saltBinary.length; i++) {
    salt[i] = saltBinary.charCodeAt(i);
  }
  
  // Normalize and hash
  const normalized = normalizeAnswer(answer, normalizationProfile);
  const encoder = new TextEncoder();
  
  const keyMaterial = await getCrypto().subtle.importKey(
    "raw",
    encoder.encode(normalized),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await getCrypto().subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  const actualHash = bufferToHex(derivedBits);
  return actualHash === expectedHash;
}

/**
 * Verify an answer against a stored hash (auto-detect format)
 * 
 * Supports:
 * - PBKDF2-SHA256 format: pbkdf2-sha256$iterations$salt$hash
 * - Simple SHA-256 format: 64-char hex string
 * 
 * @param answer - The plain text answer
 * @param storedHash - The stored hash (any supported format)
 * @returns True if answer matches
 */
export async function verifySecurityAnswer(
  answer: string,
  storedHash: string | undefined,
  opts?: { normalizationProfile?: SecurityAnswerNormalizationProfile },
): Promise<boolean> {
  if (!storedHash || storedHash.length === 0) {
    // No stored hash, skip verification
    return true;
  }

  const normalizationProfile = opts?.normalizationProfile ?? "default";

  // Detect format
  if (storedHash.startsWith("pbkdf2-sha256$")) {
    return verifyAnswerPBKDF2(answer, storedHash, normalizationProfile);
  }
  
  // Assume simple SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizeAnswer(answer, normalizationProfile));
  const hashBuffer = await getCrypto().subtle.digest("SHA-256", data);
  const computedHash = bufferToHex(hashBuffer);
  return computedHash === storedHash;
}

export type SecurityQuestionHashEntry = {
  a?: string;
  answerHash?: string;
  hashes?: string[];
  mode?: "exact" | "normalized" | "broad";
  normalizationProfile?: SecurityAnswerNormalizationProfile;
  profileVersion?: number;
};

const getNormalizationProfileForEntry = (
  entry: SecurityQuestionHashEntry,
): SecurityAnswerNormalizationProfile => {
  if (entry.normalizationProfile === "none" || entry.normalizationProfile === "default") {
    return entry.normalizationProfile;
  }
  if (entry.mode === "exact") return "none";
  return "default";
};

const getHashCandidatesForEntry = (entry: SecurityQuestionHashEntry): string[] => {
  if (Array.isArray(entry.hashes) && entry.hashes.length > 0) {
    return entry.hashes.filter((h): h is string => typeof h === "string" && h.length > 0);
  }
  const single = entry.a || entry.answerHash;
  return typeof single === "string" && single.length > 0 ? [single] : [];
};

export async function verifySecurityAnswerEntry(
  answer: string,
  entry: SecurityQuestionHashEntry | undefined,
): Promise<boolean> {
  if (!entry) return true;
  const candidates = getHashCandidatesForEntry(entry);
  if (candidates.length === 0) return true;
  const normalizationProfile = getNormalizationProfileForEntry(entry);
  for (const candidate of candidates) {
    if (await verifySecurityAnswer(answer, candidate, { normalizationProfile })) return true;
  }
  return false;
}

/**
 * Verify all security question answers
 * 
 * @param answers - Array of { question, answer } objects
 * @param storedHashes - Array of stored hash entries
 * @returns Object with success flag and incorrect indexes
 */
export async function verifyAllSecurityAnswers(
  answers: Array<{ question?: string; answer: string }>,
  storedHashes: Array<SecurityQuestionHashEntry>
): Promise<{ success: boolean; incorrectIndexes: number[] }> {
  const incorrectIndexes: number[] = [];
  
  for (let i = 0; i < answers.length; i++) {
    if (i >= storedHashes.length) {
      incorrectIndexes.push(i);
      continue;
    }
    
    const isValid = await verifySecurityAnswerEntry(answers[i].answer, storedHashes[i]);
    
    if (!isValid) {
      incorrectIndexes.push(i);
    }
  }
  
  return {
    success: incorrectIndexes.length === 0,
    incorrectIndexes,
  };
}
