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
  payment: {
    paymentMethod: "wander",
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
    key: "payment", 
    label: "Pay & Store",
    description: "Pay with Arweave to store your updated vault"
  },
  {
    key: "success",
    label: "Success",
    description: "Update successful"
  }
] as const;
