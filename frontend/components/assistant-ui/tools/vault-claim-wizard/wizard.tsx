"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, FileText, Check, Copy, Download } from "lucide-react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Stepper } from "@/components/shared/stepper";
import { getVaultById } from "@/lib/vault-storage";
import {
  InheritanceIdField,
  SecurityQuestionsField,
  FractionKeysField,
  validateSecurityQuestionsApi,
  getLocalVaultErrorMessage,
  generateSecurityQuestionFieldErrors,
} from "@/components/assistant-ui/tools/shared";

import type { ClaimFormState, ClaimSubmissionResult, VaultClaimWizardProps } from "./types";
import { initialClaimFormState, claimSteps } from "./constants";

export function VaultClaimWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
  initialData,
}: VaultClaimWizardProps) {
  const isDialog = variant === "dialog";
  const [formState, setFormState] = useState<ClaimFormState>(initialClaimFormState);

  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<string[]>([]);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [isSecurityAnswersVerified, setIsSecurityAnswersVerified] = useState(false);
  const [validSecurityAnswerIndexes, setValidSecurityAnswerIndexes] = useState<number[]>([]);
  const [isFractionKeysVerified, setIsFractionKeysVerified] = useState(false);
  const [triggerRelease, setTriggerRelease] = useState<{
    triggerType: "date" | "death" | "manual";
    triggerDate?: string;
  } | null>(null);
  const [unlockedDocuments, setUnlockedDocuments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [vaultTitle, setVaultTitle] = useState<string | null>(null);

  // State for version tracking
  const [newerVersionAvailable, setNewerVersionAvailable] = useState(false);
  const [latestTxId, setLatestTxId] = useState<string | null>(null);
  const [hasPendingEdit, setHasPendingEdit] = useState(false);

  // Ref to track active fetch abort controller to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  const resetWizard = useCallback(() => {
    setFormState(initialClaimFormState);
    setCurrentStep(0);
    setStepError(null);
    setIsWarning(false);
    setFieldErrors({});
    setIsSubmitting(false);
    setIsVerifying(false);
    setSecurityQuestions([]);
    setVerificationSuccess(false);
    setIsSecurityAnswersVerified(false);
    setTriggerRelease(null);
    setUnlockedDocuments([]);
    setVaultTitle(null);
    setNewerVersionAvailable(false);
    setLatestTxId(null);
    setHasPendingEdit(false);
  }, []);

  // Initialize with backup data if available
  useEffect(() => {
    if (initialData && open) {
      setFormState((prev) => ({
        ...prev,
        vaultId: initialData.vaultId,
        fractionKeys: {
          key1: initialData.fractionKeys[0] || "",
          key2: initialData.fractionKeys[1] || "",
          key3: initialData.fractionKeys[2] || "",
        },
        securityQuestionAnswers: initialData.securityQuestionAnswers,
      }));
      setVerificationSuccess(true);
      setIsSecurityAnswersVerified(true);
      setIsFractionKeysVerified(true);
      const unlockStepIndex = claimSteps.findIndex((s) => s.key === "unlock");
      console.log("VaultClaimWizard: setting step to", unlockStepIndex);
      if (unlockStepIndex !== -1) {
        setCurrentStep(unlockStepIndex);
      }
    }
  }, [initialData, open]);

  useEffect(() => {
    if (isDialog && !open) {
      resetWizard();
    }
  }, [isDialog, open, resetWizard]);

  useEffect(() => {
    return () => {
      resetWizard();
    };
  }, [resetWizard]);

  const handleVaultIdChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      vaultId: value,
    }));
    // Clear error when user starts typing
    if (fieldErrors.vaultId) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.vaultId;
        return newErrors;
      });
    }
    // Reset verification state every time Inheritance ID changes
    setSecurityQuestions([]);
    setFormState((prev) => ({
      ...prev,
      securityQuestionAnswers: [],
    }));
    setVerificationSuccess(false);
    setTriggerRelease(null);
    setStepError(null);
  };

  // Auto-validate removed - validation only happens when user clicks the button
  // This prevents bugs in production where validation triggers unexpectedly

  const handleSecurityAnswerChange = (index: number, answer: string) => {
    setFormState((prev) => ({
      ...prev,
      securityQuestionAnswers: prev.securityQuestionAnswers.map((sq, i) =>
        i === index ? { ...sq, answer } : sq,
      ),
    }));
    // Clear error when user starts typing
    const errorKey = `securityQuestionAnswers.${index}.answer`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    // Clear stepError if exists (from previous unlock error)
    if (stepError) {
      setStepError(null);
    }
    // Reset security answers verification when user changes answer
    if (isSecurityAnswersVerified) {
      setIsSecurityAnswersVerified(false);
    }
  };

  const handleFractionKeyChange = (fractionKey: keyof ClaimFormState["fractionKeys"], value: string) => {
    setFormState((prev) => ({
      ...prev,
      fractionKeys: {
        ...prev.fractionKeys,
        [fractionKey]: value,
      },
    }));
    // Clear error when user starts typing
    const errorKey = `fractionKeys.${fractionKey}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    // Clear stepError if exists (from previous unlock error)
    if (stepError) {
      setStepError(null);
    }
    // Reset fraction keys validation when user changes value
    if (isFractionKeysVerified) {
      setIsFractionKeysVerified(false);
    }
  };



  const validateStep = (index: number): string | null => {
    const errors: Record<string, string> = {};

    switch (claimSteps[index].key) {
      case "vaultId": {
        if (!formState.vaultId.trim()) {
          errors.vaultId = "Please enter your Inheritance ID.";
        }
        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "verification": {
        if (securityQuestions.length === 0) {
          return "We couldn't find any security questions. Please double-check your Inheritance ID.";
        }
        if (formState.securityQuestionAnswers.length !== securityQuestions.length) {
          return "There was a problem loading the security questions. Please verify your Inheritance ID.";
        }
        formState.securityQuestionAnswers.forEach((sq, idx) => {
          if (!sq.answer.trim()) {
            errors[`securityQuestionAnswers.${idx}.answer`] = "Please provide an answer.";
          }
        });
        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "fractionKeys": {
        const { key1, key2, key3 } = formState.fractionKeys;
        if (!key1.trim()) {
          errors["fractionKeys.key1"] = "Please enter Fraction Key #1.";
        }
        if (!key2.trim()) {
          errors["fractionKeys.key2"] = "Please enter Fraction Key #2.";
        }
        if (!key3.trim()) {
          errors["fractionKeys.key3"] = "Please enter Fraction Key #3.";
        }

        // Validation: all fraction keys must be unique
        const fractionKeysArray = [key1.trim(), key2.trim(), key3.trim()];
        const duplicates = new Map<string, number[]>();

        fractionKeysArray.forEach((key) => {
          if (key) {
            const indices = fractionKeysArray
              .map((k, i) => k === key ? i : -1)
              .filter(i => i !== -1);
            if (indices.length > 1) {
              duplicates.set(key, indices);
            }
          }
        });

        // If duplicates exist, add error for all duplicate fraction keys
        if (duplicates.size > 0) {
          duplicates.forEach((indices) => {
            indices.forEach((idx) => {
              const keyName = `fractionKeys.key${idx + 1}`;
              if (!errors[keyName]) {
                errors[keyName] = "Each Fraction Key must be unique. Please ensure you haven't entered the same key twice.";
              }
            });
          });
        }

        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      default:
        return null;
    }
  };

  const loadSecurityQuestions = async (): Promise<boolean> => {
    // Cancel any previous pending request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsVerifying(true);
    setStepError(null);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if aborted before starting attempt
        if (abortController.signal.aborted) {
          return false;
        }

        console.log(`🔍 [claim-wizard] loadSecurityQuestions attempt ${attempt}/${maxRetries}`);

        // Retrieve local vault data to get fallback TxID
        const localVault = getVaultById(formState.vaultId);
        const arweaveTxId = localVault?.arweaveTxId;

        const response = await fetch("/api/vault/claim/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vaultId: formState.vaultId.trim(),
            arweaveTxId,
          }),
          signal: abortController.signal,
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return false;
        }

        // Handle empty response body gracefully
        const responseText = await response.text();

        // Check again after reading text (abort could happen during read)
        if (abortController.signal.aborted) {
          return false;
        }

        let data;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          console.error("Failed to parse response:", responseText);
          throw new Error("Server returned an invalid response. Please try again.");
        }

        // Success case
        if (response.ok && data.success) {
          console.log(`✅ [claim-wizard] Success on attempt ${attempt}`);

          // Set security questions from response
          if (data.securityQuestions && Array.isArray(data.securityQuestions)) {
            setSecurityQuestions(data.securityQuestions);
            setFormState((prev) => ({
              ...prev,
              securityQuestionAnswers: data.securityQuestions.map((q: string) => ({
                question: q,
                answer: "",
              })),
            }));

            // Save trigger release from response
            if (data.trigger) {
              setTriggerRelease(data.trigger);

              // Check for release date to fail early if needed
              const { triggerType, triggerDate } = data.trigger;
              if (triggerType === "date" && triggerDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const releaseDate = new Date(triggerDate);
                releaseDate.setHours(0, 0, 0, 0);

                if (today < releaseDate) {
                  const formattedDate = releaseDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
                  const message = `This inheritance isn't ready to be opened just yet. It is scheduled to become available on ${formattedDate}.`;
                  setStepError(message);
                  setIsWarning(true);
                  setIsVerifying(false);
                  return false;
                }
              }
            }

            // Check if there's a newer version available
            if (data.latestTxId) {
              setLatestTxId(data.latestTxId);
              const localVaultCheck = getVaultById(formState.vaultId);
              if (localVaultCheck && localVaultCheck.arweaveTxId && localVaultCheck.arweaveTxId !== data.latestTxId) {
                console.log(`⚠️ Newer version detected for vault ${formState.vaultId}`);
                setNewerVersionAvailable(true);
                if (localVaultCheck.status === "pending") {
                  setHasPendingEdit(true);
                } else {
                  setHasPendingEdit(false);
                }
              } else {
                setNewerVersionAvailable(false);
                setHasPendingEdit(false);
              }
            }

            setVerificationSuccess(true);
            setIsVerifying(false);
            if (abortControllerRef.current === abortController) {
              abortControllerRef.current = null;
            }
            return true;
          } else {
            throw new Error("Security questions not found.");
          }
        }

        // For any error, retry (cold-start can manifest as various error codes including 400)
        console.log(`⚠️ [claim-wizard] Error ${response.status} on attempt ${attempt}, will retry...`);
        lastError = new Error(data?.error || `Server error (${response.status})`);

        // Wait before retry (exponential backoff: 1s, 2s, 3s)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error) {
        // If request was aborted, don't show error
        if (error instanceof Error && error.name === "AbortError") {
          return false;
        }

        console.error(`❌ [claim-wizard] Error on attempt ${attempt}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        // For non-retryable errors (validation errors), break immediately
        if (lastError.message.includes("Inheritance ID") ||
          lastError.message.includes("not found") ||
          lastError.message.includes("invalid")) {
          break;
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries exhausted - show last error
    const originalMessage = lastError?.message || "An error occurred while loading security questions.";

    // Use shared helper to get user-friendly error message based on local vault status
    const { message, isWarning } = getLocalVaultErrorMessage(
      formState.vaultId,
      originalMessage
    );
    setIsWarning(isWarning);
    setStepError(message);
    setIsVerifying(false);

    // Clear the ref if this is the current controller
    if (abortControllerRef.current === abortController) {
      abortControllerRef.current = null;
    }

    return false;
  };

  const validateTriggerRelease = (): string | null => {
    if (!triggerRelease) {
      // If trigger release doesn't exist, allow unlock (backward compatibility)
      return null;
    }

    const { triggerType, triggerDate } = triggerRelease;

    // If triggerType is "manual", always allow unlock
    if (triggerType === "manual") {
      return null;
    }

    // If triggerType is "date", check if date has arrived
    if (triggerType === "date") {
      if (!triggerDate) {
        return "This inheritance is set to open on a specific date, but we can't verify the date. Please contact support if this persists.";
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const releaseDate = new Date(triggerDate);
      releaseDate.setHours(0, 0, 0, 0);

      if (today < releaseDate) {
        const formattedDate = releaseDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `This inheritance isn't ready to be opened just yet. It is scheduled to become available on ${formattedDate}.`;
      }
    }

    // If triggerType is "death", death certificate verification is required
    // For now, we just show information
    if (triggerType === "death") {
      return "This inheritance requires death certificate verification before it can be opened. Please ensure the verification process is complete.";
    }

    return null;
  };

  const detectErrorType = (errorMessage: string): "fractionKeys" | "securityQuestions" | "other" => {
    const lowerMessage = errorMessage.toLowerCase();

    // Detect fraction keys related errors
    if (
      lowerMessage.includes("invalid fraction") ||
      lowerMessage.includes("number of bits") ||
      lowerMessage.includes("invalid key length") ||
      lowerMessage.includes("key length") ||
      lowerMessage.includes("fraction") ||
      lowerMessage.includes("key") ||
      lowerMessage.includes("minimal 3 key") ||
      lowerMessage.includes("fraction keys") ||
      lowerMessage.includes("invalid key")
    ) {
      return "fractionKeys";
    }

    // Detect security questions related errors
    if (
      lowerMessage.includes("security question") ||
      lowerMessage.includes("answer") && lowerMessage.includes("incorrect")
    ) {
      return "securityQuestions";
    }

    return "other";
  };

  const submitClaim = async () => {
    setIsSubmitting(true);
    setStepError(null);
    setFieldErrors({});

    // Validate trigger release before unlock
    const triggerError = validateTriggerRelease();
    if (triggerError) {
      setStepError(triggerError);
      setIsSubmitting(false);
      return;
    }

    try {
      const localVault = getVaultById(formState.vaultId);
      const arweaveTxId = localVault?.arweaveTxId;

      const response = await fetch("/api/vault/claim/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId: formState.vaultId.trim(),
          securityQuestionAnswers: formState.securityQuestionAnswers,
          fractionKeys: formState.fractionKeys,
          arweaveTxId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        let errorMessage = data?.error || "We couldn't open the inheritance. Please check that all fraction keys are correct.";
        const errorType = detectErrorType(errorMessage);

        // Replace "Invalid key length" error message with more user-friendly one
        if (errorMessage.toLowerCase().includes("invalid key length")) {
          errorMessage = "One or more Fraction Keys appear to be incorrect.";
        }

        // Navigate to appropriate step based on error type
        if (errorType === "fractionKeys") {
          const fractionKeysStepIndex = claimSteps.findIndex((step) => step.key === "fractionKeys");
          if (fractionKeysStepIndex !== -1) {
            setCurrentStep(fractionKeysStepIndex);
            setStepError(errorMessage);
            setIsSubmitting(false);
            return;
          }
        } else if (errorType === "securityQuestions") {
          const verificationStepIndex = claimSteps.findIndex((step) => step.key === "verification");
          if (verificationStepIndex !== -1) {
            setCurrentStep(verificationStepIndex);
            setStepError(errorMessage);
            setIsSubmitting(false);
            return;
          }
        }

        // If can't determine step, stay at unlock step and show error
        throw new Error(errorMessage);
      }

      const resultData: ClaimSubmissionResult = {
        success: true,
        vaultId: formState.vaultId,
        vaultContent: data.vaultContent || null,
        vaultTitle: data.vaultTitle || null,
        documents: data.documents || [],
        message: data.message || "Inheritance successfully opened.",
      };

      // Save result to state for display
      setFormState((prev) => ({
        ...prev,
        unlocked: true,
        vaultContent: resultData.vaultContent,
        error: null,
      }));
      setUnlockedDocuments(resultData.documents || []);
      setVaultTitle(resultData.vaultTitle || null);

      // Move to success step to show content
      const successStepIndex = claimSteps.findIndex((step) => step.key === "success");
      if (successStepIndex !== -1) {
        setCurrentStep(successStepIndex);
      }

      // Notify parent/result handler but keep dialog open
      onResult?.({
        status: "success",
        data: resultData,
      });
      // onOpenChange?.(false); // Do not close automatically
    } catch (error) {
      console.error("Failed to unlock vault:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while trying to open the inheritance.";
      setStepError(message);
      onResult?.({
        status: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const downloadDocument = async (documentIndex: number) => {
    try {
      // Build request body with fraction keys and security answers
      // Adapted from old-project: using fractionKeys instead of shardKeys to match current backend/state
      const fractionKeysArray = [
        formState.fractionKeys.key1,
        formState.fractionKeys.key2,
        formState.fractionKeys.key3,
      ];

      // Need arweaveTxId for backend to find the correct data version
      const localVault = getVaultById(formState.vaultId);
      const arweaveTxId = localVault?.arweaveTxId;

      const url = `/api/vault/${formState.vaultId}/document/${documentIndex}`;

      // Use POST to avoid URL length limit issues with large keys
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fractionKeys: fractionKeysArray,
          securityQuestionAnswers: formState.securityQuestionAnswers,
          arweaveTxId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document.");
      }

      // Get filename from header or use name from document
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = unlockedDocuments[documentIndex]?.name || "document";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ""));
        }
      }

      // Convert response to blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download document:", error);
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while downloading the document.";
      setStepError(message);
    }
  };

  const handleDownload = () => {
    const content = `INHERITANCE DETAILS
================================================================
Inheritance ID: ${formState.vaultId}
================================================================

TITLE
----------------------------------------------------------------
${vaultTitle || "No Title"}

CONTENT
----------------------------------------------------------------
${formState.vaultContent || "No Content"}

================================================================
`;

    try {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vault-content-${formState.vaultId.slice(0, 8)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download inheritance:", error);
    }
  };

  const validateSecurityQuestions = async (): Promise<boolean> => {
    setIsVerifying(true);
    setStepError(null);

    try {
      const localVault = getVaultById(formState.vaultId);
      const arweaveTxId = localVault?.arweaveTxId;

      const result = await validateSecurityQuestionsApi({
        vaultId: formState.vaultId.trim(),
        securityQuestionAnswers: formState.securityQuestionAnswers,
        arweaveTxId,
      });

      if (!result.success) {
        const errorMessage = result.error || "Security question answers do not match.";

        // Store correct indexes for green border display
        if (result.correctIndexes && result.correctIndexes.length > 0) {
          setValidSecurityAnswerIndexes(result.correctIndexes);
        }

        if (errorMessage === "Security question answers do not match.") {
          const errors = generateSecurityQuestionFieldErrors(
            formState.securityQuestionAnswers.length,
            errorMessage,
            result.incorrectIndexes
          );
          setFieldErrors(errors);
          // Do not setStepError to avoid duplicate
        } else {
          setStepError(errorMessage);
        }
        return false;
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while validating your security answers.";
      setStepError(message);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const [isVerifyingFractionKeys, setIsVerifyingFractionKeys] = useState(false);

  const validateFractionKeys = async (): Promise<boolean> => {
    setIsVerifyingFractionKeys(true);
    setIsVerifying(true);
    setStepError(null);

    try {
      const localVault = getVaultById(formState.vaultId);
      const arweaveTxId = localVault?.arweaveTxId;

      const response = await fetch("/api/vault/verify-fraction-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId: formState.vaultId.trim(),
          fractionKeys: formState.fractionKeys,
          arweaveTxId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data?.error || "The fraction keys provided are invalid. Please check them and try again.",
        );
      }

      setIsFractionKeysVerified(true);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while validating the fraction keys.";
      setStepError(message);
      setIsFractionKeysVerified(false);
      return false;
    } finally {
      setIsVerifyingFractionKeys(false);
      setIsVerifying(false);
    }
  };

  const handleNext = async () => {
    setStepError(null);
    setFieldErrors({});
    const error = validateStep(currentStep);
    if (error) {
      if (error !== "FIELD_ERROR") {
        setStepError(error);
      }
      return;
    }

    // If still at Inheritance ID step, also check & load security questions
    // Skip if already verified (e.g., user came back from step 2)
    if (claimSteps[currentStep].key === "vaultId") {
      if (!verificationSuccess) {
        const ok = await loadSecurityQuestions();
        if (!ok) {
          // Do not move step if Inheritance ID is invalid / questions failed to load
          return;
        }
      }
    }

    // Validate security question answers before moving to next step
    // Skip if already verified (e.g., user came back from step 3)
    if (claimSteps[currentStep].key === "verification") {
      if (!isSecurityAnswersVerified) {
        const ok = await validateSecurityQuestions();
        if (!ok) {
          // Don't move step if answers are invalid
          return;
        }
        setIsSecurityAnswersVerified(true);
      }
    }

    // Validate fraction keys before moving to unlock step
    // Skip if already verified (e.g., user came back from step 4)
    if (claimSteps[currentStep].key === "fractionKeys") {
      if (!isFractionKeysVerified) {
        const ok = await validateFractionKeys();
        if (!ok) {
          // Don't move step if fraction keys are invalid
          return;
        }
      }
    }

    if (claimSteps[currentStep].key === "unlock") {
      await submitClaim();
      return;
    }

    if (claimSteps[currentStep].key === "success") {
      onOpenChange?.(false);
      return;
    }



    setCurrentStep((prev) => Math.min(prev + 1, claimSteps.length - 1));
  };

  const handlePrev = () => {
    setStepError(null);
    setFieldErrors({});
    // Don't reset validation states when navigating back - user may want to review verified fields
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  // Reset function to clear form and start over (used when user wants to change verified ID)
  const handleReset = () => {
    setFormState(initialClaimFormState);
    setCurrentStep(0);
    setStepError(null);
    setIsWarning(false);
    setFieldErrors({});
    setSecurityQuestions([]);
    setVerificationSuccess(false);
    setIsFractionKeysVerified(false);
    setTriggerRelease(null);
    setIsSecurityAnswersVerified(false);
    setNewerVersionAvailable(false);
    setLatestTxId(null);
    setHasPendingEdit(false);
  };

  const renderStepContent = () => {
    switch (claimSteps[currentStep].key) {
      case "vaultId":
        return (
          <div className="space-y-4">
            <InheritanceIdField
              description="Enter the Inheritance ID you received from the inheritance owner."
              value={formState.vaultId}
              onChange={handleVaultIdChange}
              isVerified={verificationSuccess}
              isLoading={isVerifying || isSubmitting}
              error={fieldErrors.vaultId}
              onReset={() => {
                handleReset();
              }}
            />
          </div>
        );

      case "verification":
        // Convert fieldErrors to SecurityQuestionsField format
        const securityErrors: Record<number, string> = {};
        formState.securityQuestionAnswers.forEach((_, index) => {
          const errorKey = `securityQuestionAnswers.${index}.answer`;
          if (fieldErrors[errorKey]) {
            securityErrors[index] = fieldErrors[errorKey];
          }
        });

        return (
          <div className="space-y-4">


            <SecurityQuestionsField
              questions={formState.securityQuestionAnswers}
              onAnswerChange={handleSecurityAnswerChange}
              isVerified={isSecurityAnswersVerified}
              isLoading={isVerifying || isSubmitting}
              errors={securityErrors}
              validIndexes={validSecurityAnswerIndexes}
              onEnterPress={handleNext}
            />
          </div>
        );

      case "fractionKeys":
        return (
          <FractionKeysField
            keys={formState.fractionKeys}
            onKeyChange={handleFractionKeyChange}
            isVerified={isFractionKeysVerified}
            isLoading={isVerifying || isSubmitting || isVerifyingFractionKeys}
            errors={fieldErrors}
            onEnterPress={handleNext}
          />
        );

      case "unlock":
        const getTriggerMessage = () => {
          if (!triggerRelease) {
            return {
              type: "info" as const,
              title: "Ready to open inheritance",
              message: "Click the \"Open Inheritance\" button to access the inheritance content.",
            };
          }

          const { triggerType, triggerDate } = triggerRelease;

          if (triggerType === "manual") {
            return {
              type: "info" as const,
              title: "Ready to open inheritance",
              message: "Inheritance can be opened at any time. Click the \"Open Inheritance\" button to access the inheritance content.",
            };
          }

          if (triggerType === "date" && triggerDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const releaseDate = new Date(triggerDate);
            releaseDate.setHours(0, 0, 0, 0);
            const formattedDate = releaseDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            if (today >= releaseDate) {
              return {
                type: "success" as const,
                title: "Inheritance ready to open",
                message: `Opening date has arrived (${formattedDate}). Click the \"Open Inheritance\" button to access the inheritance content.`,
              };
            } else {
              return {
                type: "warning" as const,
                title: "Inheritance cannot be opened yet",
                message: `Inheritance will be open on ${formattedDate}. Please return on that date.`,
              };
            }
          }

          if (triggerType === "death") {
            return {
              type: "warning" as const,
              title: "Death certificate verification required",
              message: "Inheritance is configured to open after death certificate verification. Ensure you have completed the verification process before opening the inheritance.",
            };
          }

          return {
            type: "info" as const,
            title: "Ready to open inheritance",
            message: "Click the \"Open Inheritance\" button to access the inheritance content.",
          };
        };

        const triggerMsg = getTriggerMessage();
        const borderColor =
          triggerMsg.type === "success"
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
            : triggerMsg.type === "warning"
              ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950"
              : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950";
        const textColor =
          triggerMsg.type === "success"
            ? "text-green-700 dark:text-green-300"
            : triggerMsg.type === "warning"
              ? "text-amber-700 dark:text-amber-300"
              : "text-amber-700 dark:text-amber-300";

        return (
          <div className="space-y-4">
            <div className={`rounded-lg border px-4 py-3 text-sm ${borderColor}`}>
              <p className={`font-medium ${textColor}`}>
                {triggerMsg.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {triggerMsg.message}
              </p>
            </div>

            {triggerRelease && (
              <div className="rounded-lg border px-4 py-3">
                <p className="text-sm font-medium">Trigger Release</p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {triggerRelease.triggerType === "manual"
                      ? "By request - Can be opened at any time"
                      : triggerRelease.triggerType === "date" && triggerRelease.triggerDate
                        ? `Specific Date - ${new Date(triggerRelease.triggerDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}`
                        : triggerRelease.triggerType === "death"
                          ? "After Death Certificate - Death certificate verification required"
                          : "Unknown"}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">Inheritance ID</p>
              <p className="mt-1 font-mono text-sm break-all">{formState.vaultId}</p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">Security Questions</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {formState.securityQuestionAnswers.map((sq, index) => (
                  <li key={index}>{sq.question}</li>
                ))}
              </ul>
            </div>
          </div>
        );

      case "success":
        return (
          <div className="space-y-6">
            <AlertMessage
              variant="success"
              customHeader="Inheritance Opened Successfully"
              showHeader
              message="You now have access to the inheritance content."
              showIcon
            />

            {/* Download Action Section */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
              <div>
                <p className="font-medium text-sm">Download Inheritance</p>
                <p className="text-xs text-muted-foreground">Download all inheritance details</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2 bg-background hover:bg-accent">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="space-y-4">
              {/* Inheritance ID */}
              <div className="rounded-lg border px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">Inheritance ID</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm break-all">{formState.vaultId}</p>
                </div>
              </div>

              {/* Title */}
              {vaultTitle && (
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                  <p className="font-medium text-sm">{vaultTitle}</p>
                </div>
              )}

              {/* Content */}
              {formState.vaultContent && (
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Content</p>
                  <div className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded-md border">
                    {formState.vaultContent}
                  </div>
                </div>
              )}

            </div>

            {/* Documents */}
            {unlockedDocuments.length > 0 && (
              <div className="rounded-lg border px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground mb-3">Documents ({unlockedDocuments.length})</p>
                <div className="grid gap-2">
                  {unlockedDocuments.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(doc.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-background shrink-0"
                        onClick={() => downloadDocument(i)}
                        title="Download Document"
                        disabled={isSubmitting}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const buttonContent = (() => {
    if (isSubmitting) {
      return "Opening Inheritance...";
    }

    if (isVerifying || isVerifyingFractionKeys) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Checking...
        </div>
      );
    }

    switch (claimSteps[currentStep].key) {
      case "vaultId":
        if (verificationSuccess) {
          return "Next";
        }
        return (
          <div className="flex items-center gap-2">
            <Search className="size-4" />
            Search
          </div>
        );

      case "verification":
        return isSecurityAnswersVerified ? "Next" : "Verify";

      case "fractionKeys":
        return isFractionKeysVerified ? "Next" : "Verify";

      case "unlock":
        return "Open Inheritance";



      case "success":
        return "Close";

      default:
        return "Next";
    }
  })();

  const content = (
    <div className="space-y-6">
      {/* Progress Steps - Responsive */}
      <div className={initialData || claimSteps[currentStep].key === "success" ? "hidden" : ""}>
        <Stepper steps={claimSteps} currentStep={currentStep} />
      </div>

      {/* Warning regarding pending edit - visible on all steps after Vault ID (Step 1) */}
      {hasPendingEdit && currentStep > 0 && (
        <div className="rounded-lg border border-danger-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="font-medium text-red-700 dark:text-red-300">
            ⏳ Previous Edit Still Processing
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            There is a pending edit that hasn&apos;t been confirmed on the blockchain yet.
            The content shown is from the <strong>previous confirmed version</strong>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The latest changes will appear once the pending transaction is confirmed (about 20 minutes).
          </p>
        </div>
      )}
      {newerVersionAvailable && !hasPendingEdit && currentStep > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="font-medium text-red-700 dark:text-red-300">
            ⚠️ Updated Version Detected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The blockchain has a newer version of this inheritance (TxID: {latestTxId?.substring(0, 8)}...).
            However, your browser is still seeing the older version. This usually resolves automatically in a few minutes.
          </p>
        </div>
      )}

      {/* Step Content */}
      {/* <div className="min-h-[300px]">{renderStepContent()}</div> */}
      <div>{renderStepContent()}</div>

      {/* Error/Warning Message */}
      <AlertMessage
        message={stepError}
        variant={isWarning ? "warning" : "error"}
        showIcon
      />

      {/* Navigation Buttons */}
      <div className={cn("flex gap-3 justify-end")}>
        {/* Show Reset button on Step 1 if ID already verified (user came back from step 2) */}
        {currentStep !== 0 && !initialData && claimSteps[currentStep].key !== "success" && (
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0 || isSubmitting}
          >
            Previous
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={Boolean(
            isSubmitting ||
            isVerifying ||
            isVerifyingFractionKeys ||
            (claimSteps[currentStep].key === "unlock" &&
              triggerRelease &&
              triggerRelease.triggerType === "date" &&
              triggerRelease.triggerDate &&
              new Date() < new Date(triggerRelease.triggerDate))
          )}
        >
          {buttonContent}
        </Button>
      </div>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inheritance Claim - Open Inheritance</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="hidden" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="aui-vault-claim-wizard-root w-full rounded-xl border border-border bg-background p-6">
      <h3 className="mb-6 text-lg font-semibold">Inheritance Claim - Open Inheritance</h3>
      {content}
    </div>
  );
}

