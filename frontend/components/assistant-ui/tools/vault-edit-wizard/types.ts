// Types for Vault Edit Wizard

export type SecurityQuestionAnswer = {
  question: string;
  answer: string;
};

export type EditFormState = {
  // Step 1: Vault ID
  vaultId: string;

  // Step 2: Fraction Keys (all 3 are required)
  fractionKeys: {
    key1: string;
    key2: string;
    key3: string;
  };

  // Step 3: Security Questions (for verification)
  securityQuestionAnswers: SecurityQuestionAnswer[];

  // Step 4: New Vault Details
  willDetails: {
    title: string;
    content: string;
    existingDocuments: Array<{
      sourceIndex: number;
      name: string;
      size: number;
      type: string;
    }>;
    newDocuments: File[];
  };

  // Step 5: Edit Security Questions (optional)
  editedSecurityQuestions: SecurityQuestionAnswer[];
  isEditingSecurityQuestions: boolean;

  // Step 6: Storage Selection
  storageType: "arweave" | "bitxenArweave";
  payment: {
    paymentMethod: "wander" | "metamask";
    selectedChain?: string; // For Bitxen: bsc, eth, poly, base, arbitrum
  };
};

export type EditSubmissionResult = {
  success: boolean;
  vaultId: string;
  message: string | null;
  arweaveTxId?: string | null;
  blockchainTxHash?: string | null; // For Bitxen transactions
  blockchainChain?: string | null; // Which chain was used
  storageType?: "arweave" | "bitxenArweave";
};

export type VaultEditWizardProps = {
  variant?: "dialog" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStepChange?: (step?: number) => void;
  onResult?: (
    payload:
      | { status: "success"; data: EditSubmissionResult }
      | { status: "error"; message: string },
  ) => void;
  initialData?: {
    vaultId: string;
    fractionKeys: string[];
    securityQuestionAnswers: { question: string; answer: string }[];
  };
};

export type EditWizardStep = {
  key: string;
  label: string;
  description?: string;
};

export type VaultPayloadForEdit = Record<string, unknown> & {
  willDetails?: Record<string, unknown> & {
    title?: string;
    content?: string;
    willType?: "one-time" | "editable";
    documents?: Array<{ name?: string; size?: number; type?: string; content?: string }>;
  };
  securityQuestions?: Array<{ question: string; answer: string }>;
  triggerRelease?: unknown;
};

export type FractionKeyCommitmentsV1 = {
  scheme: "sha256";
  version: 1;
  byShareId: Record<string, string>;
  createdAt?: string;
};

