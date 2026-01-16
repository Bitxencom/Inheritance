// Constants for Vault Creation Wizard

import type { FormState, SecurityQuestion, WizardStep } from "./types";

export const defaultSecurityQuestions: SecurityQuestion[] = Array.from(
  { length: 3 },
  () => ({ question: "", answer: "" }),
);

export const initialFormState: FormState = {
  willDetails: {
    willType: "one-time",
    title: "",
    content: "",
  },
  securityQuestions: defaultSecurityQuestions,
  triggerRelease: {
    triggerType: "manual",
    triggerDate: undefined,
  },
  payment: {
    paymentMethod: "wander",
  },
};

export const steps: readonly WizardStep[] = [
  { 
    key: "willDetails", 
    label: "Vault Details",
    description: "Fill in title and secret content."
  },
  { 
    key: "securityQuestions", 
    label: "Security Questions",
    description: "Set at least 3 security questions."
  },
  { 
    key: "triggerRelease", 
    label: "Release Timing",
    description: "Set when the vault can be opened: manual (anytime) or a specific date."
  },
  { 
    key: "review", 
    label: "Review",
    description: "Review all information before submit."
  },
  { 
    key: "payment", 
    label: "Payment",
    description: "Complete payment to store vault permanently on blockchain storage."
  },
] as const;

