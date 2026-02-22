import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

export const sha256HexFromString = (value: string): string => 
  createHash("sha256").update(value, "utf8").digest("hex");

/**
 * Parse fraction key share info
 * Format: [bits(1)][id(hex)][data(hex)]
 */
export const parseFractionKeyShareInfo = (value: string): { bits: number; id: number } => {
  const trimmed = value.trim();
  const bits = parseInt(trimmed.slice(0, 1), 36);
  if (!Number.isFinite(bits) || bits < 3 || bits > 20) {
    throw new Error("Invalid share: bits out of range");
  }
  const max = Math.pow(2, bits) - 1;
  const idLen = max.toString(16).length;
  const match = new RegExp(`^([a-kA-K3-9]{1})([a-fA-F0-9]{${idLen}})([a-fA-F0-9]+)$`).exec(trimmed);
  if (!match) {
    throw new Error("Invalid share format");
  }
  const id = parseInt(match[2], 16);
  if (!Number.isFinite(id) || id < 1 || id > max) {
    throw new Error("Invalid share: id out of range");
  }
  return { bits, id };
};

/**
 * Hash security question answer for validation without decryption
 * Uses SHA-256 with normalization (lowercase, trim)
 */
export const hashSecurityAnswer = (answer: string): string => {
  const normalized = answer.toLowerCase().trim();
  return createHash("sha256").update(normalized).digest("hex");
};

export type SecurityAnswerNormalizationProfile = "none" | "default";

export const normalizeSecurityAnswer = (answer: string, profile: SecurityAnswerNormalizationProfile): string => {
  if (profile === "none") return answer;
  return answer.normalize("NFKC").toLowerCase().trim();
};

export const verifySecurityAnswerHash = (
  answer: string,
  storedHash: string | undefined,
  opts?: { normalizationProfile?: SecurityAnswerNormalizationProfile },
): boolean => {
  if (!storedHash || storedHash.length === 0) return false;

  if (storedHash.startsWith("pbkdf2-sha256$")) {
    const parts = storedHash.split("$");
    const iterations = Number(parts[1] || "");
    const saltBase64 = parts[2] || "";
    const hashHex = parts[3] || "";
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    if (!saltBase64 || !hashHex) return false;

    const salt = Buffer.from(saltBase64, "base64");
    const normalized = normalizeSecurityAnswer(answer, opts?.normalizationProfile || "default");
    const derived = pbkdf2Sync(Buffer.from(normalized, "utf8"), salt, iterations, 32, "sha256");

    return timingSafeEqual(derived, Buffer.from(hashHex, "hex"));
  }

  // Legacy SHA-256
  const normalized = normalizeSecurityAnswer(answer, opts?.normalizationProfile || "default");
  const hashed = createHash("sha256").update(normalized).digest("hex");
  return hashed === storedHash;
};
