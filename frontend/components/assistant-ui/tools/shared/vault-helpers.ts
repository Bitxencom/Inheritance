import { getVaultById } from "@/lib/vault-storage";

/**
 * Types for security question validation
 */
export interface SecurityQuestionAnswer {
  question: string;
  answer: string;
}

export interface ValidateSecurityQuestionsParams {
  vaultId: string;
  securityQuestionAnswers: SecurityQuestionAnswer[];
  arweaveTxId?: string;
}

export interface ValidateSecurityQuestionsResult {
  success: boolean;
  fallbackRequired?: boolean;
  error?: string;
  incorrectIndexes?: number[];
  correctIndexes?: number[];
}

/**
 * Validate security questions against the API
 * This is a shared function used by both VaultClaimWizard and VaultEditWizard
 */
export async function validateSecurityQuestionsApi(
  params: ValidateSecurityQuestionsParams
): Promise<ValidateSecurityQuestionsResult> {
  const response = await fetch("/api/vault/verify-security-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vaultId: params.vaultId,
      securityQuestionAnswers: params.securityQuestionAnswers,
      arweaveTxId: params.arweaveTxId,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    // If inheritance doesn't support separate validation (fallbackRequired),
    // just continue and validation will be done during unlock/preview
    if (data.fallbackRequired) {
      console.log(
        "Legacy inheritance does not support separate validation, will be validated during unlock/preview"
      );
      return { success: true, fallbackRequired: true };
    }

    return {
      success: false,
      error: data?.error || "Security question answers do not match.",
      incorrectIndexes: data?.incorrectIndexes || [],
      correctIndexes: data?.correctIndexes || [],
    };
  }

  return { success: true };
}

/**
 * Types for local vault error message helper
 */
export interface LocalVaultErrorResult {
  message: string;
  isWarning: boolean;
}

/**
 * Get user-friendly error message based on local vault status
 * Used when vault is not found in blockchain storage but exists locally
 */
export function getLocalVaultErrorMessage(
  vaultId: string,
  originalMessage: string
): LocalVaultErrorResult {
  // Only process if original message contains "not found"
  if (!originalMessage.toLowerCase().includes("not found")) {
    return {
      message: originalMessage,
      isWarning: false,
    };
  }

  const localVault = getVaultById(vaultId);

  if (!localVault) {
    return {
      message: originalMessage,
      isWarning: false,
    };
  }

  const createdDate = new Date(localVault.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  switch (localVault.status) {
    case "pending":
      return {
        message: `This inheritance was created on ${createdDate} and is currently being secured on blockchain storage. Please check back in a few moments.`,
        isWarning: true,
      };
    case "error":
      return {
        message: `We encountered an issue uploading this inheritance to blockchain storage. You may need to create a new inheritance.`,
        isWarning: false,
      };
    case "confirmed":
      return {
        message: `Your inheritance is confirmed, but it hasn't appeared on blockchain storage yet due to a potential settlement delay. Please try again in a few minutes.`,
        isWarning: true,
      };
    default:
      return {
        message: originalMessage,
        isWarning: false,
      };
  }
}

/**
 * Generate field errors for security question mismatches
 * If incorrectIndexes is provided, only highlight those specific fields.
 * Otherwise, fall back to highlighting all fields (legacy behavior).
 */
export function generateSecurityQuestionFieldErrors(
  answersCount: number,
  errorMessage: string,
  incorrectIndexes?: number[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // If we have specific incorrect indexes, only highlight those
  if (incorrectIndexes && incorrectIndexes.length > 0) {
    for (const index of incorrectIndexes) {
      if (index >= 0 && index < answersCount) {
        errors[`securityQuestionAnswers.${index}.answer`] = errorMessage;
      }
    }
  } else {
    // Fallback: highlight all fields (legacy behavior for old vaults)
    for (let i = 0; i < answersCount; i++) {
      errors[`securityQuestionAnswers.${i}.answer`] = errorMessage;
    }
  }
  
  return errors;
}
