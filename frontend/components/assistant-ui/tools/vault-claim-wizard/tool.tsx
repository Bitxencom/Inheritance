import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useState } from "react";

import { VaultClaimWizard } from "./wizard";

export const VaultClaimWizardTool: ToolCallMessagePartComponent<{
  reason?: string;
  metadata?: Record<string, unknown>;
}> = ({ args }) => {
  const [isOpen, setIsOpen] = useState(true);

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(
        (args as {
          reason?: string | number | boolean;
        }).reason ?? "",
      ).trim()
      : "";

  // Wizard is closed - show completion message
  if (!isOpen) {
    return (
      <div className="aui-vault-claim-wizard-tool-completed mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
        <p className="font-medium text-green-700 dark:text-green-300">
          The inheritance claim process has been completed.
        </p>
        {reason && (
          <p className="mt-1 text-muted-foreground">{reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="aui-vault-claim-wizard-tool mt-3 w-full">
      <VaultClaimWizard
        variant="inline"
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </div>
  );
};
