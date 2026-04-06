"use client";

function getCrypto(): Crypto {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return window.crypto;
}

const PBKDF2_ITERATIONS = 210_000;

export async function hashSecurityAnswerClient(answer: string): Promise<string> {
  const crypto = getCrypto();
  const normalized = answer.normalize("NFKC").toLowerCase().trim();

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256,
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let binary = "";
  for (let i = 0; i < salt.length; i++) binary += String.fromCharCode(salt[i]);
  const saltBase64 = btoa(binary);

  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${saltBase64}$${hashHex}`;
}

