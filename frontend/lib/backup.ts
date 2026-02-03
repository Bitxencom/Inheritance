export interface BackupData {
  vaultId: string;
  fractionKeys: string[];
}

export function parseBackupFile(content: string): BackupData {
  const normalized = (content ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) {
    throw new Error("Invalid backup file: Empty content.");
  }

  if (
    normalized.length < 300 &&
    !normalized.includes("\n") &&
    (normalized.includes("/") || normalized.includes("\\")) &&
    /vault-backup-.*\.txt/i.test(normalized)
  ) {
    throw new Error(
      "Invalid backup file: It looks like a file path, not file contents. Please upload the .txt backup file.",
    );
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "vaultId" in parsed &&
      "fractionKeys" in parsed
    ) {
      const vaultId =
        typeof (parsed as { vaultId?: unknown }).vaultId === "string"
          ? (parsed as { vaultId: string }).vaultId.trim()
          : "";
      const fractionKeysRaw = (parsed as { fractionKeys?: unknown }).fractionKeys;
      const fractionKeys = Array.isArray(fractionKeysRaw)
        ? fractionKeysRaw.filter((k): k is string => typeof k === "string").map((k) => k.trim())
        : [];

      if (vaultId && fractionKeys.length >= 3) {
        return { vaultId, fractionKeys };
      }
    }
  } catch {
  }

  const uuidMatch = normalized.match(
    /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/,
  );
  const vaultId =
    normalized.match(/VAULT ID[\s\S]*?\n=+\s*\n([0-9a-fA-F-]{32,})/i)?.[1]?.trim() ||
    uuidMatch?.[0]?.trim() ||
    "";

  if (!vaultId) {
    throw new Error("Invalid backup file: Vault ID not found.");
  }

  // Extract Fraction Keys
  const fractionKeyMatches = [
    ...normalized.matchAll(/\[Key #\d+\]\s*\n([0-9a-fA-F]+)\s*\n/g),
  ];

  const parsedKeysFromSections = fractionKeyMatches.map((match) => match[1].trim());

  const fallbackHexMatches = [...normalized.matchAll(/\b[0-9a-fA-F]{40,}\b/g)].map((m) =>
    m[0].trim(),
  );

  const candidates = (parsedKeysFromSections.length > 0 ? parsedKeysFromSections : fallbackHexMatches)
    .filter((k) => /^[0-9a-fA-F]+$/.test(k))
    .filter((k) => k.length >= 40);

  const seen = new Set<string>();
  const fractionKeys = candidates.filter((k) => {
    const normalizedKey = k.toLowerCase();
    if (seen.has(normalizedKey)) return false;
    seen.add(normalizedKey);
    return true;
  });

  if (fractionKeys.length < 3) {
    throw new Error("Invalid backup file: No fraction keys found.");
  }

  return {
    vaultId,
    fractionKeys,
  };
}
