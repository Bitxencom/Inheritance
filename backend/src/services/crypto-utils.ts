import { createHash, pbkdf2, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);

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

const PBKDF2_ITERATIONS = 210_000;

/**
 * Hash security question answer using PBKDF2-SHA256 (async, non-blocking).
 * Format: "pbkdf2-sha256$<iterations>$<saltBase64>$<hashHex>"
 * Backward-compatible: verifySecurityAnswerHash() still accepts legacy SHA-256 hashes.
 */
export const hashSecurityAnswer = async (answer: string): Promise<string> => {
  const normalized = answer.normalize("NFKC").toLowerCase().trim();
  const salt = randomBytes(16);
  const derived = await pbkdf2Async(Buffer.from(normalized, "utf8"), salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${salt.toString("base64")}$${derived.toString("hex")}`;
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
