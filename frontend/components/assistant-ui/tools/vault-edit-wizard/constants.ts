import type { EditFormState, EditWizardStep } from "./types";

export const initialEditFormState: EditFormState = {
  vaultId: "",
  fractionKeys: {
    key1: "",
    key2: "",
    key3: "",
  },
  securityQuestionAnswers: [],
  willDetails: {
    title: "",
    content: "",
    existingDocuments: [],
    newDocuments: [],
  },
  // New: Security questions editing
  editedSecurityQuestions: [],
  isEditingSecurityQuestions: false,
  // Storage selection
  storageType: "arweave",
  payment: {
    paymentMethod: "wander",
    selectedChain: undefined,
  },
};

export const editSteps: readonly EditWizardStep[] = [
  {
    key: "vaultId",
    label: "Inheritance ID",
    description: "Enter the Inheritance ID to edit"
  },
  {
    key: "securityQuestion",
    label: "Security Questions",
    description: "Answer security questions"
  },
  {
    key: "fractionKeys",
    label: "Key Verification",
    description: "Enter fraction keys"
  },
  {
    key: "willDetails",
    label: "Update Content",
    description: "Update vault content"
  },
  {
    key: "editSecurityQuestions",
    label: "Edit Security Questions",
    description: "Modify security questions (optional)"
  },
  {
    key: "confirm",
    label: "Confirm Changes",
    description: "Review and confirm changes"
  },
  {
    key: "storageSelection",
    label: "Storage",
    description: "Choose where to store your updated vault"
  },
  {
    key: "payment",
    label: "Payment",
    description: "Complete the upload process"
  },
  {
    key: "success",
    label: "Success",
    description: "Update successful"
  }
] as const;
