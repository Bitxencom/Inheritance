"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { getVaultById } from "@/lib/vault-storage";
import {
  validateSecurityQuestionsApi,
  getLocalVaultErrorMessage,
  generateSecurityQuestionFieldErrors,
} from "@/components/assistant-ui/tools/shared";
import { combineSharesClient } from "@/lib/shamirClient";
import {
  deriveEffectiveAesKeyClient,
  decryptVaultPayloadClient,
  decryptVaultPayloadRawKeyClient,
  unwrapKeyClient,
  deriveUnlockKey,
  recoverWithDrand,
  type EncryptedVaultClient,
} from "@/lib/clientVaultCrypto";
import {
  getChainKeyFromNumericChainId,
  getNetworkIdFromChainKey,
  CHAIN_CONFIG,
  type ChainId,
} from "@/lib/chains";
import {
  readBitxenDataRecord,
  finalizeRelease,
} from "@/lib/metamaskWallet";
import {
  discoverBitxenChainInfo,
  discoverBitxenEncryptedKeyForVault,
  tryLoadHybridEncryptedVault,
  extractWrappedKeyRawFromMetadata,
  parseWrappedKeyV1,
  verifyFractionKeyCommitmentsIfPresent,
} from "@/lib/bitxen-discovery";

import type { ClaimFormState, ClaimSubmissionResult, VaultClaimWizardProps } from "../types";
import { initialClaimFormState, claimSteps } from "../constants";

export type UnlockResponseLike = {
  success?: boolean;
  encryptedVault?: unknown;
  decryptedVault?: unknown;
  metadata?: unknown;
  legacy?: unknown;
  message?: unknown;
  error?: unknown;
  releaseEntropy?: string;
  contractDataId?: string;
  contractAddress?: string;
  chainId?: number;
};

export function useVaultClaim({
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
  const [unlockProgress, setUnlockProgress] = useState<string>("");
  const [unlockStep, setUnlockStep] = useState<string>("");
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
  const [unlockedDecryptedDocuments, setUnlockedDecryptedDocuments] = useState<
    Array<{
      name: string;
      size: number;
      type: string;
      content?: string;
      attachment?: { txId?: string; iv?: string; checksum?: string };
    }>
  >([]);
  const [vaultTitle, setVaultTitle] = useState<string | null>(null);
  const [combinedKeyForAttachments, setCombinedKeyForAttachments] = useState<Uint8Array | null>(null);

  // State for version tracking
  const [newerVersionAvailable, setNewerVersionAvailable] = useState(false);
  const [latestTxId, setLatestTxId] = useState<string | null>(null);
  const [hasPendingEdit, setHasPendingEdit] = useState(false);
  const [isVerifyingFractionKeys, setIsVerifyingFractionKeys] = useState(false);

  // Derived states
  const isReleaseDatePassed = !!(() => {
    if (triggerRelease?.triggerType !== "date" || !triggerRelease?.triggerDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const releaseDate = new Date(triggerRelease.triggerDate);
    releaseDate.setHours(0, 0, 0, 0);
    return today >= releaseDate;
  })();

  const isReadyToUnlock = !triggerRelease ||
    triggerRelease.triggerType === "manual" ||
    isReleaseDatePassed;

  // For Release Date
  const [releaseEntropy, setReleaseEntropy] = useState<string | null>(null);
  const [requiresFinalization, setRequiresFinalization] = useState(false);
  const [finalizeInfo, setFinalizeInfo] = useState<{
    chainId: ChainId;
    contractDataId: string;
    contractAddress?: string;
  } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const normalizeProgressText = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const cleaned = trimmed.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    return cleaned.length > 0 ? cleaned : trimmed;
  };

  const cleanedUnlockProgress = normalizeProgressText(unlockProgress);
  const cleanedUnlockStep = normalizeProgressText(unlockStep);
  const progressTitle = cleanedUnlockProgress || "Opening Inheritance...";
  const progressSubtitle = cleanedUnlockStep || progressTitle;

  // Ref to track active fetch abort controller to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  const showFullLoading = (isSubmitting || isVerifying || isVerifyingFractionKeys) && claimSteps[currentStep].key === "unlock";

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
    setUnlockedDecryptedDocuments([]);
    setVaultTitle(null);
    setCombinedKeyForAttachments(null);
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
      const localVault = getVaultById(initialData.vaultId);
      const isHybrid = localVault?.storageType === "bitxenArweave" ||
        (typeof localVault?.contractDataId === "string" && localVault.contractDataId.startsWith("0x"));

      const targetStepKey = "unlock";
      const targetStepIndex = claimSteps.findIndex((s) => s.key === targetStepKey);

      console.log("VaultClaimWizard: initialData landing at", targetStepKey, targetStepIndex);
      if (targetStepIndex !== -1) {
        setCurrentStep(targetStepIndex);
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
    setCombinedKeyForAttachments(null);
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

            // EARLY BLOCKCHAIN CHECK: Verify release status before proceeding
            // This prevents asking for security questions if the vault is definitely locked by time
            try {
              const apiLatestTxId = data.latestTxId;
              const arweaveTxIdHint =
                localVault?.arweaveTxId ??
                (typeof apiLatestTxId === "string" && apiLatestTxId.trim().length > 0
                  ? apiLatestTxId.trim()
                  : null);

              const discovered = await discoverBitxenChainInfo({
                vaultId: formState.vaultId,
                arweaveTxId: arweaveTxIdHint,
              });

              if (discovered) {
                const record = await readBitxenDataRecord({
                  chainId: discovered.chainKey,
                  contractDataId: discovered.contractDataId,
                  ...(discovered.contractAddress ? { contractAddress: discovered.contractAddress } : {}),
                });

                if (record && !record.isReleased) {
                  const nowSec = BigInt(Math.floor(Date.now() / 1000));
                  // Check if time has passed
                  if (typeof record.releaseDate === "bigint" && record.releaseDate > BigInt(0)) {
                    if (nowSec < record.releaseDate) {
                      const releaseDateMs = Number(record.releaseDate) * 1000;
                      const releaseText = Number.isFinite(releaseDateMs)
                        ? new Date(releaseDateMs).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                        : null;

                      const message = `This inheritance is not released yet. It is scheduled to become available on ${releaseText ?? record.releaseDate.toString()}.`;

                      setStepError(message);
                      setIsWarning(true);
                      setIsVerifying(false);
                      return false;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Early blockchain release check failed (non-fatal):", e);
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
    setUnlockProgress("");
    setUnlockStep("");
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

      const fractionKeysArray = [
        formState.fractionKeys.key1,
        formState.fractionKeys.key2,
        formState.fractionKeys.key3,
      ]
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      const normalizedVaultId = formState.vaultId.trim();

      if (fractionKeysArray.length < 3) {
        setStepError("Please provide at least 3 Fraction Keys to open the inheritance.");
        setIsSubmitting(false);
        return;
      }

      let combinedKey: Uint8Array;
      try {
        // DEBUG: Log fraction keys untuk troubleshooting edited vault
        console.log('🔑 Debug Fraction Keys:', {
          inputKeys: fractionKeysArray.map((key, index) => ({
            index: index + 1,
            length: key.length,
            prefix: key.substring(0, 8) + '...',
            isValid: key.trim().length > 0
          })),
          vaultId: normalizedVaultId
        });

        combinedKey = combineSharesClient(fractionKeysArray);
        console.log('✅ Fraction keys combined successfully');
      } catch (combineError) {
        console.error('❌ Fraction key combination failed:', combineError);
        throw new Error("Fraction keys do not match. Make sure all 3 fraction keys are correct.");
      }

      let data: UnlockResponseLike | null = null;
      let hybridContractEncryptedKey: string | null = null;

      setUnlockProgress("🔐 Contacting unlock service...");
      setUnlockStep("Validating access and preparing encrypted vault...");

      const response = await fetch("/api/vault/claim/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId: normalizedVaultId,
          securityQuestionAnswers: formState.securityQuestionAnswers,
          fractionKeys: [
            formState.fractionKeys.key1,
            formState.fractionKeys.key2,
            formState.fractionKeys.key3,
          ].map((k) => k.trim()),
          arweaveTxId,
        }),
      });

      data = (await response.json().catch(() => ({}))) as UnlockResponseLike;

      if (!response.ok || !data?.success) {
        let errorMessage =
          (typeof data?.error === "string" ? data.error : null) ||
          "We couldn't open the inheritance. Please check that all fraction keys are correct.";

        if (errorMessage.toLowerCase().includes("invalid key length")) {
          errorMessage = "One or more Fraction Keys appear to be incorrect.";
        }

        const lower = errorMessage.toLowerCase();
        const isNotFoundOnChain =
          lower.includes("not found on blockchain storage") ||
          lower.includes("not found") && lower.includes("blockchain");
        const isMissingTxId =
          lower.includes("arweave tx") && lower.includes("missing") ||
          lower.includes("missing arweave");

        if (isNotFoundOnChain || isMissingTxId) {
          const hybrid = await tryLoadHybridEncryptedVault({
            vaultId: normalizedVaultId,
            onProgress: (step, details) => {
              setUnlockProgress(step);
              setUnlockStep(details || step);
            },
          });
          if (hybrid) {
            data = {
              success: true,
              encryptedVault: hybrid.encryptedVault,
              metadata: hybrid.metadata,
              message: "Inheritance successfully opened.",
              releaseEntropy: hybrid.releaseEntropy,
              contractDataId: hybrid.dataId,
              contractAddress: hybrid.contractAddress,
              chainId: hybrid.chainId ? getNetworkIdFromChainKey(hybrid.chainId) : undefined,
            };
            hybridContractEncryptedKey = hybrid.contractEncryptedKey;
          } else {
            throw new Error(errorMessage);
          }
        } else {
          const errorType = detectErrorType(errorMessage);

          if (errorType === "fractionKeys") {
            const fractionKeysStepIndex = claimSteps.findIndex(
              (step) => step.key === "fractionKeys",
            );
            if (fractionKeysStepIndex !== -1) {
              setCurrentStep(fractionKeysStepIndex);
              setStepError(errorMessage);
              setIsSubmitting(false);
              return;
            }
          } else if (errorType === "securityQuestions") {
            const verificationStepIndex = claimSteps.findIndex(
              (step) => step.key === "verification",
            );
            if (verificationStepIndex !== -1) {
              setCurrentStep(verificationStepIndex);
              setStepError(errorMessage);
              setIsSubmitting(false);
              return;
            }
          }

          throw new Error(errorMessage);
        }
      }

      if (!data) {
        throw new Error("Unable to unlock vault.");
      }

      try {
        setUnlockProgress("🔎 Verifying fraction keys...");
        setUnlockStep("Checking commitments and integrity...");
        await verifyFractionKeyCommitmentsIfPresent({
          metadata: data?.metadata,
          fractionKeys: fractionKeysArray,
        });
      } catch (error) {
        const fractionKeysStepIndex = claimSteps.findIndex((step) => step.key === "fractionKeys");
        if (fractionKeysStepIndex !== -1) {
          setCurrentStep(fractionKeysStepIndex);
        }
        throw error;
      }

      // Determine whether we need to verify release status on-chain.
      // We check blockchain whenever:
      //   1. The encrypted vault uses "envelope" keyMode (always needs releaseEntropy), OR
      //   2. localVault indicates this is a bitxenArweave vault (localStorage hint, best-effort)
      // This must NOT depend solely on localStorage so that unlock works from any browser.
      const encryptedVaultKeyModeHint =
        ((data as Record<string, unknown>).encryptedVault as Record<string, unknown> | undefined)?.keyMode;
      const shouldCheckReleaseOnChain =
        encryptedVaultKeyModeHint === "envelope" ||
        localVault?.storageType === "bitxenArweave" ||
        (typeof localVault?.contractDataId === "string" && localVault.contractDataId.startsWith("0x"));

      if (shouldCheckReleaseOnChain) {
        setUnlockProgress("🔗 Checking release status (blockchain)...");
        setUnlockStep("Verifying release date on-chain...");

        // Collect contractDataId + chainKey from all available sources, in priority order:
        // 1. localVault (localStorage — present only in the original browser)
        // 2. data returned by the API (e.g. from tryLoadHybridEncryptedVault)
        // 3. Arweave discovery (works from any browser, no localStorage needed)
        let record: Awaited<ReturnType<typeof readBitxenDataRecord>> | null = null;
        let resolvedChainKey: ChainId | null = null;
        let resolvedContractDataId: string | null = null;
        let resolvedContractAddress: string | null = null;

        // Source 1: localVault
        if (
          typeof localVault?.blockchainChain === "string" &&
          typeof localVault?.contractDataId === "string" &&
          localVault.contractDataId.startsWith("0x")
        ) {
          resolvedChainKey = localVault.blockchainChain as ChainId;
          resolvedContractDataId = localVault.contractDataId;
          resolvedContractAddress =
            typeof localVault.contractAddress === "string" && localVault.contractAddress.trim().length > 0
              ? localVault.contractAddress.trim()
              : null;
        }

        // Source 2: data from API (e.g. hybrid vault path already resolved chain info)
        {
          const apiContractDataId = (data as Record<string, unknown>).contractDataId;
          const apiChainId = (data as Record<string, unknown>).chainId;
          const apiContractAddress = (data as Record<string, unknown>).contractAddress;
          const apiMetadata = (data as Record<string, unknown>).metadata as Record<string, unknown> | undefined;

          if (!resolvedContractDataId && typeof apiContractDataId === "string" && apiContractDataId.startsWith("0x")) {
            resolvedContractDataId = apiContractDataId;
          }
          if (!resolvedContractAddress && typeof apiContractAddress === "string" && apiContractAddress.trim().length > 0) {
            resolvedContractAddress = apiContractAddress.trim();
          }
          // Resolve chainKey from numeric chainId (always, regardless of contractDataId)
          if (!resolvedChainKey && apiChainId !== undefined && apiChainId !== null) {
            const numericChainId = Number(apiChainId);
            if (!Number.isNaN(numericChainId)) {
              resolvedChainKey = getChainKeyFromNumericChainId(numericChainId) ?? null;
            }
          }
          // Also try from metadata.blockchainChain (returned by backend after decrypting metadata)
          if (!resolvedChainKey && typeof apiMetadata?.blockchainChain === "string" && apiMetadata.blockchainChain.trim().length > 0) {
            resolvedChainKey = apiMetadata.blockchainChain.trim() as ChainId;
          }
          if (!resolvedContractAddress && typeof apiMetadata?.contractAddress === "string" && /^0x[a-fA-F0-9]{40}$/.test(apiMetadata.contractAddress.trim())) {
            resolvedContractAddress = apiMetadata.contractAddress.trim();
          }
        }

        // Source 3: Arweave discovery (no localStorage required).
        // Fetches vault payload from Arweave and decrypts metadata using vaultId as key.
        // vaultId is always known (from form input), so this works from any browser.
        if (!resolvedContractDataId || !resolvedChainKey) {
          setUnlockStep("Searching for vault on blockchain...");
          // Use arweaveTxId from: localVault → API response (latestTxId) → null
          // data.latestTxId is returned by the unlock API and works in any browser (no localStorage needed)
          const apiLatestTxId = (data as Record<string, unknown>).latestTxId;
          const arweaveTxIdHint =
            localVault?.arweaveTxId ??
            (typeof apiLatestTxId === "string" && apiLatestTxId.trim().length > 0
              ? apiLatestTxId.trim()
              : null);
          const discovered = await discoverBitxenChainInfo({
            vaultId: normalizedVaultId,
            arweaveTxId: arweaveTxIdHint,
            chainKeyHint: resolvedChainKey,
          }).catch(() => null);
          if (discovered) {
            if (!resolvedContractDataId && discovered.contractDataId) {
              resolvedContractDataId = discovered.contractDataId;
            }
            if (!resolvedChainKey && discovered.chainKey) {
              resolvedChainKey = discovered.chainKey;
            }
            if (!resolvedContractAddress && discovered.contractAddress) {
              resolvedContractAddress = discovered.contractAddress || null;
            }
          }
        }


        // Fallback contractAddress from CHAIN_CONFIG if still missing
        if (!resolvedContractAddress && resolvedChainKey) {
          resolvedContractAddress = CHAIN_CONFIG[resolvedChainKey]?.contractAddress ?? null;
        }

        const apiMetadata = (data as Record<string, unknown>).metadata as Record<string, unknown> | undefined;

        if (!resolvedChainKey || !resolvedContractDataId) {
          // If we can't find blockchain info, check if this is definitely supposed to be a hybrid vault.
          // If it has blockchainChain in metadata or local storage says it's hybrid, then it's an error.
          const isExpectedHybrid =
            localVault?.storageType === "bitxenArweave" ||
            (typeof localVault?.contractDataId === "string" && localVault.contractDataId.startsWith("0x")) ||
            (typeof apiMetadata?.blockchainChain === "string" && apiMetadata.blockchainChain.trim().length > 0);

          if (isExpectedHybrid) {
            console.warn("Missing blockchain info for expected hybrid vault. Bypassing release check (may be a pending envelope vault).", {
              resolvedChainKey,
              resolvedContractDataId,
              resolvedContractAddress,
            });
            // Proceed without blocking, allow unlock process to continue with metadata bypass
          } else {
            // Likely an Arweave-only vault created with 'envelope' mode (v3).
            // We proceed without blockchain check.
            console.log("No blockchain info found; proceeding as Arweave-only vault.");
          }
        }

        if (resolvedChainKey && resolvedContractDataId) {
          record = await readBitxenDataRecord({
            chainId: resolvedChainKey,
            contractDataId: resolvedContractDataId,
            ...(resolvedContractAddress ? { contractAddress: resolvedContractAddress } : {}),
          }).catch((e) => {
            console.error("Failed to read Bitxen data record:", e);
            return null;
          });

          if (!record) {
            throw new Error("Unable to verify release status on blockchain (read failed).");
          }

          const nowSec = BigInt(Math.floor(Date.now() / 1000));
          const isTimePassed =
            typeof record.releaseDate === "bigint" &&
            record.releaseDate > BigInt(0) &&
            nowSec >= record.releaseDate;

          if (!record.isReleased) {
            if (isTimePassed && !releaseEntropy) {
              setFinalizeInfo({
                chainId: resolvedChainKey,
                contractDataId: resolvedContractDataId,
                ...(resolvedContractAddress ? { contractAddress: resolvedContractAddress } : {}),
              });
              setRequiresFinalization(true);
              const stepIdx = claimSteps.findIndex((s) => s.key === "unlock");
              if (stepIdx !== -1) {
                setCurrentStep(stepIdx);
              }
              setIsSubmitting(false);
              return;
            }

            // Re-check after potential finalization
            if (!record.isReleased) {
              if (typeof record.releaseDate === "bigint" && record.releaseDate > BigInt(0)) {
                const releaseDateMs = Number(record.releaseDate) * 1000;
                const releaseText = Number.isFinite(releaseDateMs)
                  ? new Date(releaseDateMs)
                    .toLocaleString("en-US", {
                      hour12: true,
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                    .replace(",", "")
                  : null;
                throw new Error(
                  `This inheritance is not released yet. Release date: ${releaseText ?? record.releaseDate.toString()
                  }.`
                );
              }
              throw new Error("This inheritance is not released yet.");
            }
          }

          // Inject on-chain releaseEntropy + contract info into `data` so that
          // deriveUnlockKey is called correctly during client-side decryption.
          const onChainEntropy =
            typeof record.releaseEntropy === "string" && record.releaseEntropy !== "0x" + "0".repeat(64)
              ? record.releaseEntropy
              : null;

          // if (onChainEntropy) {
          if (releaseEntropy || onChainEntropy) {
            data = {
              ...data,
              releaseEntropy: releaseEntropy || onChainEntropy,
              contractDataId: resolvedContractDataId ?? (data as Record<string, unknown>).contractDataId,
              contractAddress:
                resolvedContractAddress ?? (data as Record<string, unknown>).contractAddress,
              chainId: resolvedChainKey
                ? getNetworkIdFromChainKey(resolvedChainKey)
                : (data as Record<string, unknown>).chainId,
            } as typeof data;
          }
        }
      }

      let vaultContent: string | null = null;
      let vaultTitle: string | null = null;

      let decrypted: {
        willDetails?: {
          content?: string;
          title?: string;
          documents?: Array<{
            name: string;
            size: number;
            type: string;
            content?: string;
            attachment?: { txId?: string; iv?: string; checksum?: string };
          }>;
        };
      };

      if (data.decryptedVault) {
        setUnlockProgress("✅ Vault decrypted (server)");
        setUnlockStep("Preparing your documents...");
        decrypted = data.decryptedVault as typeof decrypted;
        setCombinedKeyForAttachments(combinedKey);
      } else {
        if (!data.encryptedVault) {
          throw new Error("Unable to unlock vault. Encrypted payload is missing.");
        }
        setUnlockProgress("🔓 Decrypting vault (client-side)...");
        setUnlockStep("Processing encrypted payload...");
        const encryptedVaultForDecrypt = data.encryptedVault as EncryptedVaultClient;
        const attachmentKey = await deriveEffectiveAesKeyClient(encryptedVaultForDecrypt, combinedKey);
        setCombinedKeyForAttachments(attachmentKey);

        // DEBUG: Log key information for troubleshooting edited vault attachment decryption
        console.log('🔑 Debug Keys:', {
          attachmentKey: Array.from(attachmentKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
          combinedKey: Array.from(combinedKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
          keyMode: encryptedVaultForDecrypt.keyMode,
          vaultVersion: (data.metadata as any)?.triggerRonde ? `ronde-${(data.metadata as any).triggerRonde}` : 'legacy'
        });
        try {
          console.log('here')
          if (encryptedVaultForDecrypt.keyMode === "envelope") {
            let wrappedKeyRaw = hybridContractEncryptedKey;
            if (typeof wrappedKeyRaw !== "string" || wrappedKeyRaw.trim().length === 0) {
              const fromMetadata = extractWrappedKeyRawFromMetadata(data.metadata);
              if (fromMetadata) {
                wrappedKeyRaw = fromMetadata;
              }
            }
            if (typeof wrappedKeyRaw !== "string" || wrappedKeyRaw.trim().length === 0) {
              const discovered = await discoverBitxenEncryptedKeyForVault(normalizedVaultId);
              if (discovered) {
                wrappedKeyRaw = discovered.contractEncryptedKey;
              }
            }
            if (typeof wrappedKeyRaw !== "string" || wrappedKeyRaw.trim().length === 0) {
              throw new Error("Encrypted key not found (contract/metadata).");
            }
            const wrappedKey = parseWrappedKeyV1(JSON.parse(wrappedKeyRaw) as unknown);

            let vaultKey = attachmentKey; // Default to combinedKey (legacy)

            // Drand Time-Lock: If metadata has sealedContractSecret, we must recover it first.
            const sealedSecret = (data.metadata as Record<string, any>)?.sealedContractSecret;
            if (sealedSecret) {
              setUnlockStep("Recovering secret from Drand Time-Lock...");
              try {
                const recoveredBytes = await recoverWithDrand(sealedSecret);
                // The secret was sealed as a UTF-8 string in use-vault-creation.ts
                const recoveredSecret = new TextDecoder().decode(recoveredBytes);
                data.releaseEntropy = recoveredSecret;
              } catch (e) {
                console.error("Drand recovery failed:", e);
                throw new Error("Failed to recover time-locked secret. It may not be ready yet or there was a network error.");
              }
            }
            console.log('sealedSecret', sealedSecret)

            // Bitxen3: If we have releaseEntropy, we MUST derive the UnlockKey
            if (data.releaseEntropy && data.contractDataId && data.contractAddress && data.chainId) {
              setUnlockStep("Deriving unlock key from release entropy...");

              // DEBUG: Log key derivation inputs for edited vault troubleshooting
              console.log('🔑 Debug Key Derivation:', {
                attachmentKey: Array.from(attachmentKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
                combinedKey: Array.from(combinedKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
                releaseEntropy: data.releaseEntropy,
                contractAddress: data.contractAddress,
                chainId: data.chainId
              });

              // Try with attachmentKey first (current logic)
              try {
                vaultKey = await deriveUnlockKey(
                  attachmentKey,
                  data.releaseEntropy,
                  {
                    contractAddress: data.contractAddress,
                    chainId: Number(data.chainId),
                  }
                );
                console.log('✅ Vault key derived with attachmentKey');
              } catch (attachmentKeyError) {
                console.warn('⚠️ AttachmentKey failed, trying combinedKey fallback:', attachmentKeyError);

                // Fallback: Try with combinedKey (like edit wizard uses)
                try {
                  vaultKey = await deriveUnlockKey(
                    combinedKey,
                    data.releaseEntropy,
                    {
                      contractAddress: data.contractAddress,
                      chainId: Number(data.chainId),
                    }
                  );
                  console.log('✅ Vault key derived with combinedKey fallback');
                } catch (combinedKeyError) {
                  console.error('❌ Both key derivations failed:', { attachmentKeyError, combinedKeyError });
                  throw new Error(`Failed to derive vault key. The vault may have been edited with incompatible key derivation. Please try with the original fraction keys.`);
                }
              }
            }

            // Try to unwrap with derived vault key
            let payloadKey: Uint8Array;
            try {
              console.log('🔓 Trying to unwrap with vaultKey (attachmentKey-derived)');
              payloadKey = await unwrapKeyClient(wrappedKey, vaultKey);
              console.log('✅ Payload key unwrapped with vaultKey');
            } catch (unwrapError) {
              console.warn('⚠️ Unwrap with vaultKey failed, trying combinedKey fallback:', unwrapError);

              // Fallback: Try with combinedKey (for edited vault wrapped key consistency)
              try {
                if (!data.releaseEntropy) {
                  throw new Error('Release entropy is required for fallback key derivation');
                }
                const fallbackVaultKey = await deriveUnlockKey(
                  combinedKey,
                  data.releaseEntropy,
                  {
                    contractAddress: data.contractAddress || '',
                    chainId: Number(data.chainId || 0),
                  }
                );
                console.log('🔓 Trying to unwrap with fallbackVaultKey (combinedKey-derived)');
                payloadKey = await unwrapKeyClient(wrappedKey, fallbackVaultKey);
                console.log('✅ Payload key unwrapped with fallbackVaultKey');
              } catch (fallbackError) {
                console.error('❌ Both unwrap attempts failed:', { unwrapError, fallbackError });
                throw new Error(`Failed to decrypt vault payload. The vault may have been edited with incompatible key wrapping. Please try with the original fraction keys.`);
              }
            }
            decrypted = (await decryptVaultPayloadRawKeyClient(
              encryptedVaultForDecrypt,
              payloadKey,
            )) as typeof decrypted;
          } else {
            decrypted = (await decryptVaultPayloadClient(
              encryptedVaultForDecrypt,
              combinedKey,
            )) as typeof decrypted;
          }
        } catch (e) {
          console.error("[DEBUG] Decryption error (real):", e);
          console.log("[DEBUG] keyMode:", encryptedVaultForDecrypt.keyMode);
          console.log("[DEBUG] data.releaseEntropy:", data.releaseEntropy);
          console.log("[DEBUG] data.contractDataId:", data.contractDataId);
          console.log("[DEBUG] data.contractAddress:", data.contractAddress);
          console.log("[DEBUG] data.chainId:", data.chainId);
          if (e instanceof Error) {
            const msg = e.message.toLowerCase();
            if (msg.includes("encrypted key") || msg.includes("unsupported encrypted key") || msg.includes("invalid encrypted key")) {
              throw e;
            }
          }
          throw new Error("Fraction keys do not match. Make sure all 3 fraction keys are correct.");
        }
      }

      vaultContent = decrypted.willDetails?.content ?? null;
      vaultTitle = decrypted.willDetails?.title ?? null;
      const decryptedDocuments = decrypted.willDetails?.documents ?? [];
      const missingAttachments = decryptedDocuments
        .map((doc, index) => ({
          index,
          name: (doc as { name?: string } | undefined)?.name || `document-${index + 1}`,
          hasContent:
            typeof (doc as { content?: unknown } | undefined)?.content === "string" &&
            ((doc as { content?: string } | undefined)?.content || "").trim().length > 0,
          hasAttachment:
            typeof (doc as { attachment?: { txId?: unknown; iv?: unknown } } | undefined)?.attachment?.txId ===
            "string" &&
            typeof (doc as { attachment?: { txId?: unknown; iv?: unknown } } | undefined)?.attachment?.iv ===
            "string",
        }))
        .filter((item) => !item.hasContent && !item.hasAttachment);

      if (missingAttachments.length > 0) {
        const names = missingAttachments.slice(0, 3).map((item) => item.name).join(", ");
        const suffix =
          missingAttachments.length > 3 ? ` (+${missingAttachments.length - 3} more)` : "";
        setStepError(
          `Some attachments were stored without content and cannot be downloaded: ${names}${suffix}.`,
        );
      }

      const resultData: ClaimSubmissionResult = {
        success: true,
        vaultId: formState.vaultId,
        vaultContent,
        vaultTitle,
        documents: decryptedDocuments.map((doc) => ({
          name: doc.name,
          size: doc.size,
          type: doc.type,
        })),
        message: typeof data.message === "string" ? data.message : "Inheritance successfully opened.",
      };

      // Save result to state for display
      setFormState((prev) => ({
        ...prev,
        unlocked: true,
        vaultContent: resultData.vaultContent,
        error: null,
      }));
      setUnlockedDecryptedDocuments(decryptedDocuments);
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

  const base64ToBlob = (content: string, mimeType: string): Blob => {
    const base64 = content.startsWith("data:")
      ? (content.split(",")[1] || "")
      : (content.includes(",") ? (content.split(",")[1] || "") : content);

    if (!base64) {
      throw new Error("This document has no content available for download.");
    }

    const byteArrays: BlobPart[] = [];
    const sliceSize = 4 * 1024 * 1024;

    for (let offset = 0; offset < base64.length; offset += sliceSize) {
      const slice = base64.slice(offset, offset + sliceSize);
      const binary = atob(slice);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      byteArrays.push(bytes);
    }

    return new Blob(byteArrays, { type: mimeType || "application/octet-stream" });
  };

  const downloadDocument = async (documentIndex: number) => {
    try {
      const doc = unlockedDecryptedDocuments[documentIndex];
      if (!doc) {
        throw new Error("Document not found.");
      }

      const filename = doc.name || `document-${documentIndex + 1}`;
      let blob: Blob | null = null;

      if (typeof doc.content === "string" && doc.content.trim().length > 0) {
        blob = base64ToBlob(doc.content, doc.type || "application/octet-stream");
      } else if (doc.attachment && typeof doc.attachment.txId === "string" && typeof doc.attachment.iv === "string") {
        if (!combinedKeyForAttachments) {
          throw new Error("Unable to download: encryption key is not available.");
        }
        const response = await fetch(`https://arweave.net/${doc.attachment.txId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch attachment from blockchain storage.");
        }
        const cipherBuffer = await response.arrayBuffer();

        // DEBUG: Log attachment decryption info
        console.log('🔍 Debug Attachment:', {
          docName: doc.name,
          hasTxId: !!doc.attachment?.txId,
          hasIv: !!doc.attachment?.iv,
          hasChecksum: !!doc.attachment?.checksum,
          attachmentKeyAvailable: !!combinedKeyForAttachments,
          cipherBufferSize: cipherBuffer.byteLength
        });

        const { decryptBytesClient } = await import("@/lib/clientVaultCrypto");

        try {
          const plainBytes = await decryptBytesClient(
            {
              cipherBytes: cipherBuffer,
              iv: doc.attachment.iv,
              checksum: typeof doc.attachment.checksum === "string" ? doc.attachment.checksum : undefined,
            },
            combinedKeyForAttachments,
          );
          console.log('✅ Attachment decrypted successfully');
          const plainBuffer = plainBytes.buffer.slice(
            plainBytes.byteOffset,
            plainBytes.byteOffset + plainBytes.byteLength,
          ) as ArrayBuffer;
          blob = new Blob([plainBuffer], { type: doc.type || "application/octet-stream" });
        } catch (decryptError) {
          console.error('❌ Attachment decryption failed:', decryptError);
          const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown decryption error';
          throw new Error(`Attachment decryption failed: ${errorMessage}`);
        }
      }

      if (!blob) {
        throw new Error("This document has no content available for download.");
      }

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

  const validateFractionKeys = async (): Promise<boolean> => {
    setIsVerifyingFractionKeys(true);
    setIsVerifying(true);
    setStepError(null);

    try {
      const fractionKeysArray = [
        formState.fractionKeys.key1,
        formState.fractionKeys.key2,
        formState.fractionKeys.key3,
      ].map((k) => k.trim());

      const uniqueFractionKeys = new Set(fractionKeysArray);
      if (uniqueFractionKeys.size !== 3) {
        throw new Error("Fraction Keys must be unique. Duplicates are not allowed.");
      }

      try {
        combineSharesClient(fractionKeysArray);
      } catch {
        throw new Error("Invalid fraction keys. Make sure all 3 fraction keys are correct.");
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

    // Validate fraction keys before moving forward
    if (claimSteps[currentStep].key === "fractionKeys") {
      if (!isFractionKeysVerified) {
        const ok = await validateFractionKeys();
        if (!ok) return;
      }
    }

    if (claimSteps[currentStep].key === "success") {
      onOpenChange?.(false);
      return;
    }

    const nextStepIndex = currentStep + 1;
    if (nextStepIndex < claimSteps.length) {
      if (claimSteps[currentStep].key === "unlock") {
        if (requiresFinalization) {
          await handleFinalize();
        } else {
          await submitClaim();
        }
        return;
      }

      setCurrentStep(nextStepIndex);
    }
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
    setRequiresFinalization(false);
    setFinalizeInfo(null);
    setIsFinalizing(false);
    setReleaseEntropy(null);
  };

  const handleFinalize = async () => {
    if (!finalizeInfo) return;
    setIsFinalizing(true);
    setStepError(null);
    try {
      const entropy = await finalizeRelease(finalizeInfo);
      setReleaseEntropy(entropy);
      setRequiresFinalization(false);
      // Wait a bit and then retry submitClaim automatically
      setTimeout(() => {
        submitClaim();
      }, 500);
    } catch (e) {
      console.error("Manual finalization failed:", e);
      setStepError(e instanceof Error ? e.message : "Finalization failed.");
    } finally {
      setIsFinalizing(false);
    }
  };

  return {
    formState, currentStep, stepError, isWarning, fieldErrors, isSubmitting, isVerifying,
    isVerifyingFractionKeys,
    unlockProgress, unlockStep, securityQuestions, verificationSuccess, isSecurityAnswersVerified,
    validSecurityAnswerIndexes, isFractionKeysVerified, triggerRelease, unlockedDocuments,
    unlockedDecryptedDocuments, vaultTitle, newerVersionAvailable, latestTxId, hasPendingEdit,
    releaseEntropy, cleanedUnlockProgress, cleanedUnlockStep, progressTitle, progressSubtitle,
    showFullLoading, combinedKeyForAttachments, isDialog: variant === "dialog", formatBytes,
    requiresFinalization, isFinalizing, isReadyToUnlock, isReleaseDatePassed,
    handleVaultIdChange, handleSecurityAnswerChange, handleFractionKeyChange,
    handleNext, handlePrev, handleReset, handleDownload, downloadDocument,
    handleFinalize
  };
}
