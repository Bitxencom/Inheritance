"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadBackupButtonProps {
  vaultId: string;
  fractionKeys: string[];
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function DownloadBackupButton({
  vaultId,
  fractionKeys,
  className,
  variant = "outline",
  size = "default",
}: DownloadBackupButtonProps) {

  const handleDownloadBackup = () => {
    if (!fractionKeys || fractionKeys.length === 0) return;

    const timestamp = new Date().toLocaleString();
    const content = `INHERITANCE VAULT BACKUP
Generated on: ${timestamp}

================================================================
VAULT ID
================================================================
${vaultId}

Save this ID. You will need it to identify your inheritance.


================================================================
FRACTION KEYS (${fractionKeys.length} Total)
================================================================
These are the keys required to unlock your inheritance.
Store them securely and separately if possible.

${fractionKeys.map((key, index) => `[Key #${index + 1}]\n${key}\n`).join("\n")}

================================================================
INSTRUCTIONS
================================================================
1. Keep this file in a secure location (e.g., encrypted USB drive).
2. To unlock the vault, you will need the Inheritance ID and a minimum number of these keys (usually 3).
3. Do not share this file with untrusted parties.
`;

    try {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vault-backup-${vaultId.slice(0, 8)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download inheritance backup:", error);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDownloadBackup}
      title="Download Full Backup (ID + Keys)"
    >
      <Download className="mr-2 h-4 w-4" />
      Download Full Backup
    </Button>
  );
}
