/**
 * Shamir Secret Sharing Client
 * 
 * Pure browser implementation compatible with secrets.js-grempe format.
 * Uses GF(2^bits) field arithmetic matching secrets.js-grempe's algorithm.
 */

// Configuration defaults (can be changed by first share parsed)
let configBits = 8;
let configMaxShares = 255;

// Precomputed tables for GF(2^bits)
let logTable: number[] = [];
let expTable: number[] = [];

// Primitive polynomials for GF(2^bits) fields (from secrets.js-grempe)
const PRIMITIVE_POLYNOMIALS: (number | null)[] = [
  null, null, 1, 3, 3, 5, 3, 3, 29, 17, 9, 5, 83, 27, 43, 3, 45, 9, 39, 39, 9
];

/**
 * Initialize GF(2^bits) tables
 */
function initTables(bits: number): void {
  if (bits < 3 || bits > 20) {
    throw new Error(`Bits must be 3-20, got ${bits}`);
  }
  
  configBits = bits;
  configMaxShares = Math.pow(2, bits) - 1;
  
  const primitive = PRIMITIVE_POLYNOMIALS[bits];
  if (primitive === null || primitive === undefined) {
    throw new Error(`No primitive polynomial for ${bits} bits`);
  }
  
  const size = Math.pow(2, bits);
  logTable = new Array(size);
  expTable = new Array(512);
  
  let x = 1;
  for (let i = 0; i < configMaxShares; i++) {
    expTable[i] = x;
    logTable[x] = i;
    x = x << 1;
    if (x >= size) {
      x ^= primitive;
      x &= configMaxShares;
    }
  }
  
  // Extend exp table for easy modulo
  for (let i = configMaxShares; i < 512; i++) {
    expTable[i] = expTable[i - configMaxShares];
  }
}

// Initialize with default 8 bits
initTables(8);

/**
 * Lagrange interpolation at point 'at'
 */
function lagrange(at: number, x: number[], y: number[]): number {
  let result = 0;
  
  for (let i = 0; i < x.length; i++) {
    if (y[i] === 0) continue;
    
    let log_prod = logTable[y[i]];
    
    for (let j = 0; j < x.length; j++) {
      if (i === j) continue;
      
      if (at === x[j]) {
        log_prod = -1;
        break;
      }
      
      // log_prod += log(at ^ x[j]) - log(x[i] ^ x[j])
      log_prod = (log_prod + logTable[at ^ x[j]] - logTable[x[i] ^ x[j]] + configMaxShares) % configMaxShares;
    }
    
    if (log_prod !== -1) {
      result = result ^ expTable[log_prod];
    }
  }
  
  return result;
}

/**
 * Convert hex to binary string
 */
function hex2bin(hex: string): string {
  let bin = "";
  for (let i = hex.length - 1; i >= 0; i--) {
    const n = parseInt(hex[i], 16);
    if (isNaN(n)) throw new Error("Invalid hex character");
    bin = n.toString(2).padStart(4, "0") + bin;
  }
  return bin;
}

/**
 * Convert binary string to hex
 */
function bin2hex(bin: string): string {
  let hex = "";
  // Pad to multiple of 4
  while (bin.length % 4 !== 0) {
    bin = "0" + bin;
  }
  for (let i = bin.length; i >= 4; i -= 4) {
    const n = parseInt(bin.slice(i - 4, i), 2);
    if (isNaN(n)) throw new Error("Invalid binary character");
    hex = n.toString(16) + hex;
  }
  return hex;
}

/**
 * Pad string to the left
 */
function padLeft(str: string, bits?: number): string {
  bits = bits || configBits;
  const missing = str.length % bits;
  return missing ? "0".repeat(bits - missing) + str : str;
}

/**
 * Split binary string into array of integers based on bits
 */
function splitNumStringToIntArray(bin: string, padLength?: number): number[] {
  const result: number[] = [];
  let str = bin;
  
  if (padLength) {
    str = padLeft(str, padLength);
  }
  
  let i = str.length;
  for (; i > configBits; i -= configBits) {
    result.push(parseInt(str.slice(i - configBits, i), 2));
  }
  result.push(parseInt(str.slice(0, i), 2));
  
  return result;
}

/**
 * Parse a share in secrets.js-grempe format
 */
function parseShare(share: string): { bits: number; id: number; data: string } {
  const trimmed = share.trim();
  
  // First character encodes bits in base36
  const bitsChar = trimmed.charAt(0);
  const bits = parseInt(bitsChar, 36);
  
  if (bits < 3 || bits > 20) {
    throw new Error(`Invalid share: bits must be 3-20, got ${bits}`);
  }
  
  // Calculate max shares and ID length
  const maxShares = Math.pow(2, bits) - 1;
  const idLen = maxShares.toString(16).length;
  
  // Extract ID and data
  const idHex = trimmed.slice(1, 1 + idLen);
  const id = parseInt(idHex, 16);
  const data = trimmed.slice(1 + idLen);
  
  if (id < 1 || id > maxShares) {
    throw new Error(`Invalid share: id must be 1-${maxShares}, got ${id}`);
  }
  
  return { bits, id, data };
}

export function getFractionKeyShareInfo(key: string): { bits: number; id: number } | null {
  if (typeof key !== "string") return null;
  try {
    const { bits, id } = parseShare(key.trim());
    return { bits, id };
  } catch {
    return null;
  }
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  if (clean.length % 2 !== 0) {
    // Pad if odd length
    return hexToBytes("0" + clean);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Combine fraction keys to recover the original key
 * 
 * Compatible with secrets.js-grempe format
 * 
 * @param shares - Array of fraction key strings (minimum 3)
 * @returns Combined key as Uint8Array
 */
export function combineSharesClient(shares: string[]): Uint8Array {
  if (shares.length < 3) {
    throw new Error("At least 3 fraction keys are required");
  }
  
  let result = "";
  let setBits: number | undefined;
  const x: number[] = [];
  const y: number[][] = [];
  
  for (let i = 0; i < shares.length; i++) {
    const share = parseShare(shares[i]);
    
    // All shares must have same bits
    if (setBits === undefined) {
      setBits = share.bits;
    } else if (share.bits !== setBits) {
      throw new Error("Mismatched shares: Different bit settings.");
    }
    
    // Re-init if bits changed
    if (configBits !== setBits) {
      initTables(setBits);
    }
    
    // Skip duplicate IDs
    if (x.indexOf(share.id) === -1) {
      x.push(share.id);
      
      // Split share data into integer array
      const splitShare = splitNumStringToIntArray(hex2bin(share.data));
      
      // Rotate/zip shares together
      for (let j = 0; j < splitShare.length; j++) {
        y[j] = y[j] || [];
        y[j][x.length - 1] = splitShare[j];
      }
    }
  }
  
  // Reconstruct secret using Lagrange interpolation
  for (let i = 0; i < y.length; i++) {
    result = padLeft(lagrange(0, x, y[i]).toString(2)) + result;
  }
  
  // Remove the leading '1' marker that was added during sharing
  const hex = bin2hex(result.slice(result.indexOf("1") + 1));
  
  return hexToBytes(hex);
}

/**
 * Normalize fraction keys from various formats
 */
export function normalizeFractionKeysClient(
  input: Record<string, string> | string[]
): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((k) => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim());
  }

  const keys: string[] = [];
  const keyPatterns = [
    /^key(\d+)$/i,
    /^shard(\d+)$/i,
    /^share(\d+)$/i,
    /^fractionKey(\d+)$/i,
    /^\d+$/,
  ];

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim().length > 0) {
      const matches = keyPatterns.some((pattern) => pattern.test(key));
      if (matches || Object.keys(input).length <= 5) {
        keys.push(value.trim());
      }
    }
  }

  return keys.sort((a, b) => {
    const numA = parseInt(a.slice(0, 3), 16) || 0;
    const numB = parseInt(b.slice(0, 3), 16) || 0;
    return numA - numB;
  });
}

/**
 * Validate a fraction key format
 * Expected length: 4835 or 4805 characters for ML-KEM-768 keys
 */
export function isValidFractionKey(key: string): boolean {
  if (typeof key !== "string" || key.trim().length === 0) {
    return false;
  }
  
  const trimmed = key.trim();
  
  // Validate minimum length to avoid short/invalid shares
  if (trimmed.length < 100) {
    return false;
  }
  
  // Must be valid hex with leading bits char (0-9, a-k for bits 3-20)
  if (!/^[0-9a-kA-K][0-9a-fA-F]+$/.test(trimmed)) {
    return false;
  }
  
  try {
    parseShare(trimmed);
    return true;
  } catch {
    return false;
  }
}
