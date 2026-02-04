import secrets from "secrets.js-grempe";

const TOTAL_SHARES = 5;
const THRESHOLD = 3;

function bytesToHex(data: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < data.length; i += 1) {
    hex += data[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function splitKeyClient(key: Uint8Array): string[] {
  const hexKey = bytesToHex(key);
  return secrets.share(hexKey, TOTAL_SHARES, THRESHOLD);
}

export function combineSharesClient(shares: string[]): Uint8Array {
  const hex = secrets.combine(shares);
  return hexToBytes(hex);
}

