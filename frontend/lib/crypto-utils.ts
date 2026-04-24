/**
 * Common cryptographic and utility functions shared across the bitxen-inheritance project.
 */

/**
 * Normalizes a string (lowercase, trim, NFKC) for comparison.
 */
export function normalizeString(value: string): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").toLowerCase().trim();
}

/**
 * Calculates SHA-256 hash of a buffer or Uint8Array and returns it as a hex string.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", data as BufferSource);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculates SHA-256 hash of a string and returns it as a hex string.
 */
export async function sha256HexFromString(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  return sha256Hex(data);
}

/**
 * Parses Shamir share info (bits and ID) from a fraction key string.
 */
export function parseFractionKeyShareInfo(value: string): { bits: number; id: number } {
  const trimmed = value.trim();
  const bits = parseInt(trimmed.slice(0, 1), 36);
  if (!Number.isFinite(bits) || bits < 3 || bits > 20) {
    throw new Error("Invalid share: bits out of range");
  }
  const max = Math.pow(2, bits) - 1;
  const idLen = max.toString(16).length;
  // Match share format: [bits_base36][id_hex][payload_hex]
  const match = new RegExp(`^([a-kA-K3-9]{1})([a-fA-F0-9]{${idLen}})([a-fA-F0-9]+)$`).exec(trimmed);
  if (!match) {
    throw new Error("Invalid share format");
  }
  const id = parseInt(match[2], 16);
  if (!Number.isFinite(id) || id < 1 || id > max) {
    throw new Error("Invalid share: id out of range");
  }
  return { bits, id };
}

/**
 * Format wallet address for display.
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format BITXEN token amount (18 decimals) as printable string.
 */
export function formatBitxenAmount(amount: bigint | string | number): string {
  const val = typeof amount === "bigint" ? amount : BigInt(amount);
  const decimals = 18;
  const s = val.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  let fraction = s.slice(s.length - decimals);
  // Trim trailing zeros
  fraction = fraction.replace(/0+$/, "");
  if (fraction.length === 0) return whole;
  // Limit to 4 decimals for display
  return `${whole}.${fraction.slice(0, 4)}`;
}

/**
 * Sleeps for a given duration.
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
