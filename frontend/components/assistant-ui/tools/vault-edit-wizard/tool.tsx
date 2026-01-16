import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useCallback, useState } from "react";

import { InfoBox } from "@/components/shared/vault";
import { updateVaultTxId, getArweaveExplorerUrl } from "@/lib/vault-storage";

import { VaultEditWizard } from "./wizard";
import type { EditSubmissionResult } from "./types";

export const VaultEditWizardTool: ToolCallMessagePartComponent<{
  reason?: string;
  metadata?: Record<string, unknown>;
}> = ({ args }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [submissionResult, setSubmissionResult] =
    useState<EditSubmissionResult | null>(null);

  const handleWizardResult = useCallback(
    (
      result:
        | { status: "success"; data: EditSubmissionResult }
        | { status: "error"; message: string },
    ) => {
      if (result.status === "success") {
        if (result.data.arweaveTxId) {
          updateVaultTxId(result.data.vaultId, result.data.arweaveTxId);
        }
        // Result is handled inside the wizard's success step
        // We keep it open to show the success message in the wizard
        // setIsOpen(false); 
      }
    },
    [],
  );

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(
        (args as {
          reason?: string | number | boolean;
        }).reason ?? "",
      ).trim()
      : "";



  return (
    <div className="aui-vault-edit-wizard-tool mt-3 w-full">
      <VaultEditWizard
        variant="inline"
        open={isOpen}
        onOpenChange={setIsOpen}
        onResult={handleWizardResult}
      />
    </div>
  );
};


