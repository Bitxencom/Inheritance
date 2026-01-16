// Shared vault components
export { InheritanceIdField } from "./InheritanceIdField";
export { SecurityQuestionsField } from "./SecurityQuestionsField";
export { FractionKeysField } from "./FractionKeysField";

// Shared vault helper functions
export {
  validateSecurityQuestionsApi,
  getLocalVaultErrorMessage,
  generateSecurityQuestionFieldErrors,
  type SecurityQuestionAnswer,
  type ValidateSecurityQuestionsParams,
  type ValidateSecurityQuestionsResult,
  type LocalVaultErrorResult,
} from "./vault-helpers";
