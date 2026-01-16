export interface BackupData {
  vaultId: string;
  fractionKeys: string[];
}

export function parseBackupFile(content: string): BackupData {
  // Extract Vault ID
  const vaultIdMatch = content.match(/VAULT ID\s*\n=+\s*\n([a-fA-F0-9-]+)/);
  if (!vaultIdMatch) {
    throw new Error("Invalid backup file: Vault ID not found.");
  }
  const vaultId = vaultIdMatch[1].trim();

  // Extract Fraction Keys
  const fractionKeyMatches = [...content.matchAll(/\[Key #\d+\]\s*\n([0-9a-fA-F]+)\s*\n/g)];
  if (fractionKeyMatches.length === 0) {
    throw new Error("Invalid backup file: No fraction keys found.");
  }

  const fractionKeys = fractionKeyMatches.map(match => match[1].trim());

  return {
    vaultId,
    fractionKeys,
  };
}
