// Types for Vault Creation Wizard

// Re-export vault storage types
export type { PendingVault, PendingVaultStatus } from "@/lib/vault-storage";

export type SecurityQuestion = {
  question: string;
  answer: string;
};

export type FormState = {
  willDetails: {
    willType: "one-time" | "editable";
    title: string;
    content: string;
    documents: File[];
  };
  securityQuestions: SecurityQuestion[];
  triggerRelease: {
    triggerType: "date" | "manual";
    triggerDate?: string;
  };
  storageType: "arweave" | "bitxenArweave";
  payment: {
    paymentMethod: "wander" | "metamask";
    selectedChain?: string; // For Bitxen: bsc, eth, poly, base, arbitrum
  };
};

export type SubmissionResult = {
  vaultId: string | null;
  arweaveTxId: string | null;
  blockchainTxHash?: string | null; // For Bitxen transactions
  blockchainChain?: string | null; // Which chain was used
  message: string | null;
  fractionKeys: string[];
  willType?: "one-time" | "editable";
  storageType?: "arweave" | "bitxenArweave";
  createdAt?: string;
  confirmedAt?: string;
  title?: string;
  triggerType?: "date" | "manual";
  triggerDate?: string;
};

export type VaultCreationWizardProps = {
  variant?: "dialog" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStepChange?: (step?: number) => void;
  onResult?: (
    payload:
      | { status: "success"; data: SubmissionResult }
      | { status: "error"; message: string },
  ) => void;
};

export type WizardStep = {
  key: string;
  label: string;
  description?: string;
};
