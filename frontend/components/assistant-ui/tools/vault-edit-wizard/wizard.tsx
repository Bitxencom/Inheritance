"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Search,
  Loader2,
  RotateCcw,
  Check,
  Copy,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertMessage } from "@/components/ui/alert-message";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import {
  InheritanceIdField,
  SecurityQuestionsField,
  FractionKeysField,
  validateSecurityQuestionsApi,
  getLocalVaultErrorMessage,
  generateSecurityQuestionFieldErrors,
} from "@/components/assistant-ui/tools/shared";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  EditFormState,
  EditSubmissionResult,
  VaultEditWizardProps,
} from "./types";
import { editSteps, initialEditFormState } from "./constants";
import { StorageSelector, MetaMaskWalletButton, WanderWalletButton } from "@/components/shared/payment";
import { Stepper } from "@/components/shared/stepper";
import {
  connectWanderWallet,
  sendArPayment,
  WANDER_PAYMENT_CONFIG,
} from "@/lib/wanderWallet";
import {
  dispatchToBitxen,
  type ChainId,
  getChainConfig,
  DEFAULT_CHAIN,
} from "@/lib/metamaskWallet";

import { getVaultById, updateVaultTxId } from "@/lib/vault-storage";

export function VaultEditWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
  initialData,
}: VaultEditWizardProps) {
  const isDialog = variant === "dialog";
  const [formState, setFormState] =
    useState<EditFormState>(initialEditFormState);

  const [currentStep, setCurrentStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize with backup data if available
  useEffect(() => {
    if (initialData && open) {
      setIsInitializing(true);
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

      const willDetailsStepIndex = editSteps.findIndex((s) => s.key === "willDetails");
      if (willDetailsStepIndex !== -1) {
        setCurrentStep(willDetailsStepIndex);
      }
      // isInitializing will be set to false after content loads in the other effect
    }
  }, [initialData, open]);

  const [stepError, setStepError] = useState<string | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isSecurityAnswersVerified, setIsSecurityAnswersVerified] = useState(false);
  const [validSecurityAnswerIndexes, setValidSecurityAnswerIndexes] = useState<number[]>([]);
  const [isFractionKeysVerified, setIsFractionKeysVerified] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [isVerifyingVault, setIsVerifyingVault] = useState(false);
  const [isVerifyingQuestions, setIsVerifyingQuestions] = useState(false);
  const [isVerifyingFractionKeys, setIsVerifyingFractionKeys] = useState(false);

  // State for version tracking
  const [newerVersionAvailable, setNewerVersionAvailable] = useState(false);
  const [latestTxId, setLatestTxId] = useState<string | null>(null);

  // State for pending edit transaction (from localStorage)
  const [hasPendingEdit, setHasPendingEdit] = useState(false);

  // State for payment
  const [paymentState, setPaymentState] = useState<{
    paymentMethod: "wander";
  }>({
    paymentMethod: "wander",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ref to track active fetch abort controller to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (editSteps[currentStep]?.key === "willDetails") {
      // Small timeout to ensure DOM is ready and ref is attached
      const timer = setTimeout(() => {
        adjustTextareaHeight();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [formState.willDetails.content, currentStep, adjustTextareaHeight]);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  const reset = useCallback(() => {
    setFormState(initialEditFormState);
    setCurrentStep(0);
    setStepError(null);
    setIsWarning(false);
    setFieldErrors({});
    setIsSubmitting(false);
    setIsSecurityAnswersVerified(false);
    setIsFractionKeysVerified(false);
    setVerificationSuccess(false);
    setNewerVersionAvailable(false);
    setLatestTxId(null);
    setHasPendingEdit(false);
  }, []);

  useEffect(() => {
    if (isDialog && !open) {
      reset();
    }
  }, [isDialog, open, reset]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

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
    if (stepError) setStepError(null);
    setVerificationSuccess(false);
  };

  const handlePaymentMethodChange = (
    method: "wander",
  ) => {
    setPaymentState((prev) => ({
      ...prev,
      paymentMethod: method,
    }));
  };

  const handleWillDetailsChange = (field: "title" | "content", value: string) => {
    setFormState((prev) => ({
      ...prev,
      willDetails: {
        ...prev.willDetails,
        [field]: value,
      },
    }));
    // Clear error when user starts typing
    const errorKey = `willDetails.${field}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    if (stepError) setStepError(null);
  };

  const handleFractionKeyChange = (
    keyProp: keyof EditFormState["fractionKeys"],
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      fractionKeys: {
        ...prev.fractionKeys,
        [keyProp]: value,
      },
    }));

    // Reset validation when fraction key is changed
    setIsFractionKeysVerified(false);

    // Clear error when user starts typing
    const errorKey = `fractionKeys.${keyProp}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    if (stepError) setStepError(null);
  };

  const handleSecurityAnswerChange = (index: number, value: string) => {
    setFormState((prev) => ({
      ...prev,
      securityQuestionAnswers: prev.securityQuestionAnswers.map((sq, i) =>
        i === index ? { ...sq, answer: value } : sq,
      ),
    }));
    // Reset validation when security answer is changed
    setIsSecurityAnswersVerified(false);

    // Clear error when user starts typing
    const errorKey = `securityQuestionAnswers.${index}.answer`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    if (stepError) setStepError(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // === Handlers for Editing Security Questions ===

  const handleToggleEditSecurityQuestions = () => {
    setFormState((prev) => {
      const newIsEditing = !prev.isEditingSecurityQuestions;
      return {
        ...prev,
        isEditingSecurityQuestions: newIsEditing,
        // Initialize editedSecurityQuestions from verified answers if enabling edit
        editedSecurityQuestions: newIsEditing && prev.editedSecurityQuestions.length === 0
          ? prev.securityQuestionAnswers.map((sq) => ({ ...sq }))
          : prev.editedSecurityQuestions,
      };
    });
    if (stepError) setStepError(null);
  };

  const handleAddSecurityQuestion = () => {
    setFormState((prev) => ({
      ...prev,
      editedSecurityQuestions: [
        ...prev.editedSecurityQuestions,
        { question: "", answer: "" },
      ],
    }));
  };

  const handleRemoveSecurityQuestion = (index: number) => {
    if (formState.editedSecurityQuestions.length <= 3) {
      setStepError("Minimum 3 security questions are required.");
      return;
    }
    setFormState((prev) => ({
      ...prev,
      editedSecurityQuestions: prev.editedSecurityQuestions.filter((_, i) => i !== index),
    }));
    // Clear any related field errors
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors)
        .filter((key) => key.startsWith(`editedSecurityQuestions.${index}`))
        .forEach((key) => delete newErrors[key]);
      return newErrors;
    });
  };

  const handleEditSecurityQuestionChange = (
    index: number,
    field: "question" | "answer",
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      editedSecurityQuestions: prev.editedSecurityQuestions.map((sq, i) =>
        i === index ? { ...sq, [field]: value } : sq,
      ),
    }));
    // Clear error when user starts typing
    const errorKey = `editedSecurityQuestions.${index}.${field}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
    if (stepError) setStepError(null);
  };

  const handleResetSecurityQuestions = () => {
    // Reset to original security questions from verified answers, keep editing mode open
    setFormState((prev) => ({
      ...prev,
      editedSecurityQuestions: prev.securityQuestionAnswers.map((sq) => ({ ...sq })),
    }));
    setStepError(null);
    setFieldErrors({});
  };

  const handleCancelEditSecurityQuestions = () => {
    // Reset and close the edit form
    setFormState((prev) => ({
      ...prev,
      isEditingSecurityQuestions: false,
      editedSecurityQuestions: [],
    }));
    setStepError(null);
    setFieldErrors({});
  };


  const validateStep = (index: number): string | null => {
    const errors: Record<string, string> = {};

    switch (editSteps[index].key) {
      case "vaultId": {
        if (!formState.vaultId.trim()) {
          errors.vaultId = "Please enter your Inheritance ID.";
        }
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
      case "securityQuestion": {
        if (formState.securityQuestionAnswers.length === 0) {
          return "We couldn't load the security questions. Please check your Inheritance ID.";
        }
        formState.securityQuestionAnswers.forEach((sq, idx) => {
          if (!sq.answer.trim()) {
            errors[`securityQuestionAnswers.${idx}.answer`] = "Please provide an answer.";
          }
        });
        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "willDetails": {
        if (!formState.willDetails.title.trim()) {
          errors["willDetails.title"] = "Please enter a title for your inheritance.";
        }
        if (!formState.willDetails.content.trim()) {
          errors["willDetails.content"] = "Please enter the content for your inheritance.";
        }
        setFieldErrors(errors);
        return null;
      }
      case "editSecurityQuestions": {
        // Only validate if user has enabled editing
        if (formState.isEditingSecurityQuestions) {
          // Validate minimum 3 questions
          if (formState.editedSecurityQuestions.length < 3) {
            return "Minimum 3 security questions are required.";
          }
          // Validate all fields are filled
          formState.editedSecurityQuestions.forEach((sq, idx) => {
            if (!sq.question.trim()) {
              errors[`editedSecurityQuestions.${idx}.question`] = "Please enter a question.";
            }
            if (!sq.answer.trim()) {
              errors[`editedSecurityQuestions.${idx}.answer`] = "Please enter an answer.";
            }
          });
          setFieldErrors(errors);
          return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
        }
        return null;
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

    setStepError(null);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if aborted before starting attempt
        if (abortController.signal.aborted) {
          return false;
        }

        console.log(`🔍 [edit-wizard] loadSecurityQuestions attempt ${attempt}/${maxRetries}`);

        const localVault = getVaultById(formState.vaultId);
        const arweaveTxId = localVault?.arweaveTxId;

        const response = await fetch("/api/vault/claim/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vaultId: formState.vaultId,
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

        // Check again after reading text
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
          console.log(`✅ [edit-wizard] Success on attempt ${attempt}`);

          if (data.securityQuestions && Array.isArray(data.securityQuestions)) {
            setFormState((prev) => ({
              ...prev,
              securityQuestionAnswers: data.securityQuestions.map((q: string) => ({
                question: q,
                answer: "",
              })),
              answer: "",
            }));
            setVerificationSuccess(true);

            // Clear the ref
            if (abortControllerRef.current === abortController) {
              abortControllerRef.current = null;
            }
            return true;
          } else {
            throw new Error("We couldn't find any security questions for this inheritance.");
          }
        }

        // For 4xx client errors (except 404), don't retry - it's likely a real validation error
        if (response.status >= 400 && response.status < 500 && response.status !== 404) {
          console.log(`⚠️ [edit-wizard] Client error ${response.status}, not retrying`);
          throw new Error(
            data?.error ||
            "We encountered an issue loading the security questions. Please verify your Inheritance ID.",
          );
        }

        // For 5xx server errors or 404 (might be cold-start), retry
        console.log(`⚠️ [edit-wizard] Error ${response.status} on attempt ${attempt}, will retry...`);
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

        console.error(`❌ [edit-wizard] Error on attempt ${attempt}:`, error);
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
    const originalMessage = lastError?.message || "Something went wrong while loading the security questions.";

    // Use shared helper to get user-friendly error message based on local vault status
    const { message, isWarning } = getLocalVaultErrorMessage(
      formState.vaultId,
      originalMessage
    );
    setIsWarning(isWarning);
    setStepError(message);

    // Clear the ref if this is the current controller
    if (abortControllerRef.current === abortController) {
      abortControllerRef.current = null;
    }

    return false;
  };

  const loadExistingWillDetails = useCallback(async (): Promise<boolean> => {
    setIsVerifyingFractionKeys(true);
    setStepError(null);
    try {
      const response = await fetch("/api/vault/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId: formState.vaultId,
          fractionKeys: [
            formState.fractionKeys.key1,
            formState.fractionKeys.key2,
            formState.fractionKeys.key3,
          ],
          securityQuestionAnswers: formState.securityQuestionAnswers,
          arweaveTxId: getVaultById(formState.vaultId)?.arweaveTxId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        // Reset validation when there's an error
        setIsSecurityAnswersVerified(false);
        setIsFractionKeysVerified(false);

        const errorMessage =
          typeof data.error === "string"
            ? data.error
            : `We couldn't retrieve the inheritance content. Status: ${response.status}. Please double-check your credentials.`;

        // If error 403, inheritance cannot be edited (willType === "one-time")
        if (response.status === 403) {
          // Go back to first step and show clear error
          setCurrentStep(0);
          setStepError(errorMessage);
          return false;
        }

        // If error 401, most likely security questions are wrong
        if (response.status === 401) {
          // Navigate to securityQuestion step
          const securityQuestionIndex = editSteps.findIndex(
            (step) => step.key === "securityQuestion",
          );
          if (securityQuestionIndex !== -1) {
            setCurrentStep(securityQuestionIndex);
          }
          setStepError(errorMessage);
          return false;
        }

        // Other errors likely related to fraction keys
        // Check if error message contains fraction key keywords
        const errorLower = errorMessage.toLowerCase();
        const isFractionKeyError =
          errorLower.includes("fraction") ||
          errorLower.includes("shard") ||
          errorLower.includes("key") ||
          errorLower.includes("minimum 3") ||
          errorLower.includes("invalid") ||
          errorLower.includes("mismatch") ||
          (response.status === 400 && !errorLower.includes("security") && !errorLower.includes("question"));

        if (isFractionKeyError) {
          // Navigate to fractionKeys step
          const fractionKeysIndex = editSteps.findIndex(
            (step) => step.key === "fractionKeys",
          );
          if (fractionKeysIndex !== -1) {
            setCurrentStep(fractionKeysIndex);
          }
        }

        setStepError(errorMessage);
        return false;
      }

      // Validate willType after decrypt succeeds
      if (data.willDetails?.willType === "one-time") {
        // Reset validation
        setIsSecurityAnswersVerified(false);
        setIsFractionKeysVerified(false);

        // Go back to first step and show error
        setCurrentStep(0);
        setStepError(
          "This inheritance is set to 'One-Time' and cannot be edited. Only 'Editable' vaults can be modified.",
        );
        return false;
      }

      if (data.willDetails) {
        setFormState((prev) => ({
          ...prev,
          willDetails: {
            title: data.willDetails.title ?? "",
            content: data.willDetails.content ?? "",
          },
        }));
      }

      // If successful, fraction keys and security questions are valid
      setIsSecurityAnswersVerified(true);
      setIsFractionKeysVerified(true);

      return true;
    } catch (error) {
      // Reset validation when there's an error
      setIsSecurityAnswersVerified(false);
      setIsFractionKeysVerified(false);

      console.error("Failed to retrieve inheritance preview:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while retrieving the inheritance content. Please ensure your internet connection is stable.";

      // If network or connection error, stay at current step
      // But if error is related to fraction keys, navigate to fractionKeys
      const errorLower = message.toLowerCase();
      if (errorLower.includes("fraction") || errorLower.includes("shard") || errorLower.includes("key")) {
        const fractionKeysIndex = editSteps.findIndex(
          (step) => step.key === "fractionKeys",
        );
        if (fractionKeysIndex !== -1) {
          setCurrentStep(fractionKeysIndex);
        }
      }

      setStepError(message);
      return false;
    } finally {
      setIsVerifyingFractionKeys(false);
    }
  }, [formState.vaultId, formState.fractionKeys, formState.securityQuestionAnswers]);

  // Effect to load content when initializing (Restored Flow)
  // Effect to load content when initializing (Restored Flow)
  useEffect(() => {
    if (initialData && open && isInitializing) {
      // Wait until formState is populated with the initialData
      if (formState.vaultId !== initialData.vaultId) {
        return;
      }

      const initLoad = async () => {
        try {
          await loadExistingWillDetails();
        } catch (error) {
          console.error("Failed to load initial will details:", error);
        } finally {
          setIsInitializing(false);
        }
      };

      initLoad();
    }
  }, [initialData, open, isInitializing, formState.vaultId, loadExistingWillDetails]);

  // Auto-validate removed - validation only happens when user clicks the button
  // This prevents bugs in production where validation triggers unexpectedly



  const submitEdit = async () => {
    setIsSubmitting(true);
    setStepError(null);

    try {
      // Prepare request body
      const requestBody: Record<string, unknown> = {
        vaultId: formState.vaultId,
        willDetails: {
          title: formState.willDetails.title,
          content: formState.willDetails.content,
        },
        fractionKeys: [
          formState.fractionKeys.key1,
          formState.fractionKeys.key2,
          formState.fractionKeys.key3,
        ],
        securityQuestionAnswers: formState.securityQuestionAnswers,
        arweaveTxId: getVaultById(formState.vaultId)?.arweaveTxId,
      };

      // Include new security questions if user enabled editing
      if (formState.isEditingSecurityQuestions && formState.editedSecurityQuestions.length >= 3) {
        requestBody.securityQuestions = formState.editedSecurityQuestions;
      }

      const response = await fetch("/api/vault/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage =
          data?.error ||
          "We couldn't update the inheritance. Please check that all details are correct.";

        // If error 403, inheritance cannot be edited (willType === "one-time")
        if (response.status === 403) {
          // Go back to first step and show clear error
          setCurrentStep(0);
          setStepError(errorMessage);
          setIsSubmitting(false);
          return;
        }

        throw new Error(errorMessage);
      }

      let txId = data.details?.arweaveTxId;

      let blockchainTxHash: string | undefined;
      let blockchainChain: string | undefined;

      // Check if we need to dispatch from client (New Flow)
      if (data.shouldDispatch && data.details?.arweavePayload) {
        try {
          if (formState.storageType === "bitxen") {
            setPaymentStatus("Confirm transaction in MetaMask...");
            const selectedChain = (formState.payment.selectedChain || DEFAULT_CHAIN) as ChainId;
            const dispatchResult = await dispatchToBitxen(
              data.details.arweavePayload,
              data.details.vaultId,
              selectedChain
            );
            txId = dispatchResult.txHash;
            blockchainTxHash = dispatchResult.txHash;
            blockchainChain = selectedChain;
            setPaymentStatus(`Upload successful on ${selectedChain.toUpperCase()}!`);
          } else {
            // Default to Arweave/Wander
            setPaymentStatus("Confirm transaction in Wander Wallet...");
            const { dispatchToArweave } = await import("@/lib/wanderWallet");

            const dispatchResult = await dispatchToArweave(
              data.details.arweavePayload,
              data.details.vaultId
            );

            txId = dispatchResult.txId;
            setPaymentStatus("Upload successful!");
          }
        } catch (dispatchError) {
          console.error("Failed to dispatch edit transaction:", dispatchError);
          throw new Error(
            dispatchError instanceof Error
              ? dispatchError.message
              : "Failed to sign and upload transaction"
          );
        }
      }

      const resultData: EditSubmissionResult = {
        success: true,
        vaultId: formState.vaultId,
        message:
          data.message ||
          "New version of inheritance successfully created and stored on blockchain storage.",
        arweaveTxId: formState.storageType === "arweave" ? (txId ?? null) : null,
        blockchainTxHash,
        blockchainChain,
        storageType: formState.storageType,
      };

      // Update localStorage with the new transaction ID
      // This ensures the vault always points to the latest version
      if (txId) {
        const updated = updateVaultTxId(formState.vaultId, txId);
        if (updated) {
          console.log(`✅ Updated vault ${formState.vaultId} with new txId: ${txId}`);
        } else {
          // Vault not found in localStorage (might be claimed from another device)
          console.log(`ℹ️ Vault ${formState.vaultId} not found in local storage, edit still successful.`);
        }
      }

      onResult?.({
        status: "success",
        data: resultData,
      });

      if (txId) setLatestTxId(txId);

      const successStepIndex = editSteps.findIndex((s) => s.key === "success");
      if (successStepIndex !== -1) {
        setCurrentStep(successStepIndex);
      } else {
        onOpenChange?.(false);
      }
    } catch (error) {
      console.error("Failed to edit vault:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the inheritance.";
      setStepError(message);
      onResult?.({
        status: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWanderPayment = async () => {
    try {
      setIsProcessingPayment(true);
      setPaymentStatus("Connecting to your Wander Wallet...");

      await connectWanderWallet();

      setPaymentStatus("Wallet connected");

      // No separate payment - fee inheritance be handled duringblockchain storage upload
      await submitEdit();

      setPaymentStatus("Payment successful!");
    } catch (error) {
      console.error("Wander Wallet error:", error);
      setPaymentStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleMetaMaskPayment = async () => {
    try {
      setIsProcessingPayment(true);
      setPaymentStatus("Connecting to MetaMask...");

      // MetaMask connection happens within dispatchToBitxen if needed,
      // but we can trigger it here for better UX
      setPaymentStatus("MetaMask ready");

      await submitEdit();

      setPaymentStatus("Payment successful!");
    } catch (error) {
      console.error("MetaMask error:", error);
      setPaymentStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const validateSecurityQuestions = async (): Promise<boolean> => {
    setIsVerifyingQuestions(true);
    setStepError(null);

    try {
      const result = await validateSecurityQuestionsApi({
        vaultId: formState.vaultId,
        securityQuestionAnswers: formState.securityQuestionAnswers,
        arweaveTxId: getVaultById(formState.vaultId)?.arweaveTxId,
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
          // Do not setStepError(message) to avoid duplicate
        } else {
          setStepError(errorMessage);
        }
        setIsSecurityAnswersVerified(false);
        return false;
      }

      // Set flag that security questions are valid
      setIsSecurityAnswersVerified(true);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while validating security question answers.";
      setStepError(message);
      setIsSecurityAnswersVerified(false);
      return false;
    } finally {
      setIsVerifyingQuestions(false);
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

    // If still at Inheritance ID step, ensure Inheritance ID really exists on blockchain storage
    // and load security questions
    if (editSteps[currentStep].key === "vaultId") {
      if (!verificationSuccess) {
        try {
          setIsVerifyingVault(true);
          const localVault = getVaultById(formState.vaultId);
          const arweaveTxId = localVault?.arweaveTxId;

          const response = await fetch("/api/vault/claim/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vaultId: formState.vaultId,
              arweaveTxId,
            }),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok || !data.success) {
            let message =
              typeof data.error === "string"
                ? data.error
                : "Inheritance ID not found. Please ensure Inheritance ID is correct.";

            // If inheritance not found, check localStorage for pending vaults
            if (message.toLowerCase().includes("not found")) {
              const localVault = getVaultById(formState.vaultId);
              if (localVault) {
                const createdDate = new Date(localVault.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });

                if (localVault.status === "pending") {
                  message = `This inheritance was created on ${createdDate} and is still being uploaded to blockchain storage. Please wait a few moments and try again.`;
                  setIsWarning(true);
                } else if (localVault.status === "error") {
                  message = `This inheritance failed to upload to blockchain storage. Please try creating a new inheritance.`;
                  setIsWarning(false);
                } else if (localVault.status === "confirmed") {
                  message = `This inheritance has been confirmed but is not yet visible on blockchain storage. There may be a settlement delay. Please try again in a few minutes.`;
                  setIsWarning(true);
                } else {
                  setIsWarning(false);
                }
              } else {
                setIsWarning(false);
              }
            } else {
              setIsWarning(false);
            }

            setStepError(message);
            return;
          }

          // Validate willType from metadata before continuing
          // If willType exists in metadata and is "one-time", reject edit
          // If willType doesn't exist in metadata, continue (will be validated again after decrypt)
          const willType = data.willType;
          if (willType === "one-time") {
            setStepError(
              "Inheritance with type 'One-Time' cannot be edited. Only vaults with type 'Editable' can be changed.",
            );
            return;
          }
          // If willType doesn't exist in metadata (old inheritance not yet updated), continue
          // Validation will be done again after decrypt in loadExistingWillDetails

          // Check if there's a newer version available
          // Compare latestTxId from blockchain storage with stored arweaveTxId in localStorage
          if (data.latestTxId) {
            setLatestTxId(data.latestTxId);
            const localVault = getVaultById(formState.vaultId);
            if (localVault && localVault.arweaveTxId && localVault.arweaveTxId !== data.latestTxId) {
              console.log(`⚠️ Newer version detected for vault ${formState.vaultId}`);
              console.log(`   Local TxId: ${localVault.arweaveTxId}`);
              console.log(`   Latest TxId: ${data.latestTxId}`);
              setNewerVersionAvailable(true);

              // Check if the local version is pending (not yet confirmed on blockchain)
              if (localVault.status === "pending") {
                console.log(`   Status: PENDING - transaction not yet confirmed`);
                setHasPendingEdit(true);
              } else {
                setHasPendingEdit(false);
              }
            } else {
              setNewerVersionAvailable(false);
              setHasPendingEdit(false);
            }
          }

          // After Inheritance ID is valid and willType is "editable", directly load security questions
          const ok = await loadSecurityQuestions();
          if (!ok) {
            return;
          }
        } catch (error) {
          console.error("Failed to verify Inheritance ID for edit:", error);
          let message =
            error instanceof Error
              ? error.message
              : "An error occurred while verifying Inheritance ID.";

          // If inheritance not found, check localStorage for pending vaults
          if (message.toLowerCase().includes("not found")) {
            const localVault = getVaultById(formState.vaultId);
            if (localVault) {
              const createdDate = new Date(localVault.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });

              if (localVault.status === "pending") {
                message = `This inheritance was created on ${createdDate} and is still being uploaded to blockchain storage. Please wait a few moments and try again.`;
                setIsWarning(true);
              } else if (localVault.status === "error") {
                message = `This inheritance failed to upload to blockchain storage. Please try creating a new inheritance.`;
                setIsWarning(false);
              } else if (localVault.status === "confirmed") {
                message = `This inheritance has been confirmed but is not yet visible on blockchain storage. There may be a settlement delay. Please try again in a few minutes.`;
                setIsWarning(true);
              } else {
                setIsWarning(false);
              }
            } else {
              setIsWarning(false);
            }
          } else {
            setIsWarning(false);
          }

          setStepError(message);
          return;
        } finally {
          setIsVerifyingVault(false);
        }
      }
    }

    // Validate security question answers at securityQuestion step
    if (editSteps[currentStep].key === "securityQuestion") {
      // Validate security question answers first
      if (!isSecurityAnswersVerified) {
        const isValid = await validateSecurityQuestions();
        if (!isValid) {
          // Error already set in validateSecurityQuestions
          return;
        }
      }

      // Check if all fraction keys are filled
      // const { key1, key2, key3 } = formState.fractionKeys;
      // const allFractionKeysFilled = key1.trim() && key2.trim() && key3.trim();

      // If fraction keys are filled, validate together at preview step
      // if (allFractionKeysFilled) {
      //   const ok = await loadExistingWillDetails();
      //   if (!ok) {
      //     // Error already set in loadExistingWillDetails
      //     return;
      //   }
      // }
    }

    // After fractionKeys are valid, verify security questions and get old inheritance content for prefill
    if (editSteps[currentStep].key === "fractionKeys") {
      if (!isFractionKeysVerified) {
        // Check if all security questions are filled
        const allSecurityQuestionsFilled = formState.securityQuestionAnswers.length > 0 &&
          formState.securityQuestionAnswers.every(sq => sq.answer.trim());

        // If security questions are filled, validate together
        if (allSecurityQuestionsFilled) {
          const ok = await loadExistingWillDetails();
          if (!ok) {
            // Error already set in loadExistingWillDetails
            return;
          }
        }
      }
    }

    if (editSteps[currentStep].key === "payment") {
      // If wander method is selected, force user to complete payment
      if (paymentState.paymentMethod === "wander") {
        setStepError(
          "Complete payment via the payment button to save the new version.",
        );
        return;
      }

      // For other methods, allow direct submit
      await submitEdit();
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, editSteps.length - 1));
  };

  const handlePrev = () => {
    setStepError(null);
    setFieldErrors({});
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  const renderStepContent = () => {
    switch (editSteps[currentStep].key) {
      case "vaultId":
        return (
          <div className="space-y-4">
            <InheritanceIdField
              description="Enter the Inheritance ID of the inheritance you want to edit."
              value={formState.vaultId}
              onChange={handleVaultIdChange}
              isVerified={verificationSuccess}
              isLoading={isVerifyingVault || isSubmitting}
              error={fieldErrors.vaultId}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              onReset={() => {
                handleVaultIdChange("");
                setVerificationSuccess(false);
              }}
            />
          </div>
        );

      case "securityQuestion":
        return (
          <div className="space-y-4">


            {formState.securityQuestionAnswers.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                <p className="text-amber-700 dark:text-amber-300">
                  Loading security questions...
                </p>
              </div>
            ) : (
              <SecurityQuestionsField
                questions={formState.securityQuestionAnswers}
                onAnswerChange={handleSecurityAnswerChange}
                isVerified={isSecurityAnswersVerified}
                isLoading={isVerifyingQuestions || isSubmitting}
                errors={(() => {
                  const errors: Record<number, string> = {};
                  formState.securityQuestionAnswers.forEach((_, index) => {
                    const errorKey = `securityQuestionAnswers.${index}.answer`;
                    if (fieldErrors[errorKey]) {
                      errors[index] = fieldErrors[errorKey];
                    }
                  });
                  return errors;
                })()}
                validIndexes={validSecurityAnswerIndexes}
                onEnterPress={handleNext}
              />
            )}
          </div>
        );

      case "fractionKeys":
        return (
          <div className="space-y-4">
            <FractionKeysField
              keys={formState.fractionKeys}
              onKeyChange={handleFractionKeyChange}
              isVerified={isFractionKeysVerified}
              isLoading={isVerifyingFractionKeys || isSubmitting}
              errors={fieldErrors}
              onEnterPress={handleNext}
            />
          </div>
        );

      case "willDetails":
        return (
          <div className="space-y-4">
            {/* Only show success message if we actually have content loaded and it's not empty */}
            {formState.willDetails.title && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
                <p className="font-medium text-green-700 dark:text-green-300">
                  Current inheritance content successfully loaded
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formState.willDetails.title}
                onChange={(e) =>
                  handleWillDetailsChange("title", e.target.value)
                }
                placeholder="Example: Inheritance for Family (latest version)"
                className={fieldErrors["willDetails.title"] ? "border-destructive" : ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmitting) {
                    handleNext();
                  }
                }}
              />
              <FieldError message={fieldErrors["willDetails.title"]} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                ref={textareaRef}
                value={formState.willDetails.content}
                rows={5}
                onChange={(e) =>
                  handleWillDetailsChange("content", e.target.value)
                }
                placeholder="Write your latest inheritance content..."
                className={cn(
                  "resize-none overflow-hidden",
                  fieldErrors["willDetails.content"] ? "border-destructive" : ""
                )}
              />
              <FieldError message={fieldErrors["willDetails.content"]} />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              These changes will be saved as a new version on blockchain storage, the old version remains archived.
            </p>
          </div >
        );

      case "editSecurityQuestions":
        return (
          <div className="space-y-4">
            {/* Show question when not editing */}
            {!formState.isEditingSecurityQuestions && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  Do you want to change the Security Questions?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can modify, add, or remove security questions. If you don&apos;t want to change them, click &quot;Continue&quot; to proceed.
                </p>
              </div>
            )}

            {/* Show editable fields when editing is enabled */}
            {formState.isEditingSecurityQuestions && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
                  <p className="font-medium text-green-700 dark:text-green-300">
                    Editing Security Questions
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum 3 security questions required. Make sure to remember your new questions and answers.
                  </p>
                </div>

                {formState.editedSecurityQuestions.map((sq, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Question #{index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveSecurityQuestion(index)}
                        disabled={formState.editedSecurityQuestions.length <= 3}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={sq.question}
                        onChange={(e) => handleEditSecurityQuestionChange(index, "question", e.target.value)}
                        placeholder="Enter security question"
                        className={fieldErrors[`editedSecurityQuestions.${index}.question`] ? "border-destructive" : ""}
                      />
                      <FieldError message={fieldErrors[`editedSecurityQuestions.${index}.question`]} />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={sq.answer}
                        onChange={(e) => handleEditSecurityQuestionChange(index, "answer", e.target.value)}
                        placeholder="Enter answer"
                        className={fieldErrors[`editedSecurityQuestions.${index}.answer`] ? "border-destructive" : ""}
                      />
                      <FieldError message={fieldErrors[`editedSecurityQuestions.${index}.answer`]} />
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddSecurityQuestion}
                  >
                    + Add Security Question
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSecurityQuestions}
                  >
                    Reset
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEditSecurityQuestions}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Confirm Edit
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                A new version will be saved onblockchain storage using the same Inheritance
                ID. The old version remains archived.
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">Inheritance ID</p>
              <p className="mt-1 font-mono text-sm break-all">
                {formState.vaultId}
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">Title</p>
              <p className="mt-1 text-sm">{formState.willDetails.title}</p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">Content</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {formState.willDetails.content}
              </p>
            </div>


          </div>
        );

      case "storageSelection":
        return (
          <StorageSelector
            selectedStorage={formState.storageType}
            selectedChain={(formState.payment.selectedChain as ChainId) || DEFAULT_CHAIN}
            onStorageChange={(storage) => {
              setFormState((prev) => ({
                ...prev,
                storageType: storage,
                payment: {
                  ...prev.payment,
                  paymentMethod: storage === "arweave" ? "wander" : "metamask",
                },
              }));
            }}
            onChainChange={(chain) => {
              setFormState((prev) => ({
                ...prev,
                payment: {
                  ...prev.payment,
                  selectedChain: chain,
                },
              }));
            }}
          />
        );

      case "payment":
        // Render different component based on storage type
        if (formState.storageType === "bitxen") {
          return (
            <MetaMaskWalletButton
              selectedChain={(formState.payment.selectedChain as ChainId) || DEFAULT_CHAIN}
              onClick={handleMetaMaskPayment}
              disabled={isSubmitting || isProcessingPayment}
            />
          );
        }

        return (
          <WanderWalletButton
            onClick={handleWanderPayment}
            isSubmitting={isSubmitting}
            isProcessingPayment={isProcessingPayment}
            paymentStatus={paymentStatus}
          />
        );

      case "success":
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/30">
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">🎉</span>
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
                  Great news! The new version of your inheritance is securely updated.
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Inheritance ID
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-16 gap-1 text-xs"
                    onClick={() => handleCopy(formState.vaultId)}
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <p className="font-mono text-sm break-all select-all">
                  {formState.vaultId}
                </p>
              </div>

              {latestTxId && (
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {formState.storageType === "bitxen"
                        ? `Transaction Hash (${(formState.payment.selectedChain || DEFAULT_CHAIN).toUpperCase()})`
                        : "Transaction ID (Arweave)"}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-16 gap-1 text-xs"
                        onClick={() => handleCopy(latestTxId)}
                      >
                        <Copy className="size-3" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-xs"
                        onClick={() => {
                          if (formState.storageType === "bitxen") {
                            const chain = (formState.payment.selectedChain || DEFAULT_CHAIN) as ChainId;
                            const config = getChainConfig(chain);
                            window.open(`${config.blockExplorer}/tx/${latestTxId}`, "_blank");
                          } else {
                            window.open(`https://viewblock.io/arweave/tx/${latestTxId}`, "_blank");
                          }
                        }}
                      >
                        <ExternalLink className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-sm break-all select-all">
                    {latestTxId}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex gap-2">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    Important: Confirmation in Progress
                  </p>
                  <p className="text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    Your edited inheritance has been submitted to the blockchain storage network. It may take{" "}
                    <span className="font-semibold">~20 minutes</span> for the new version to be fully confirmed.
                  </p>
                  <p className="text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    During this time, if you open or edit this inheritance again, you may still see the previous version
                    until the new transaction is confirmed on the network.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const buttonContent = (() => {
    if (isSubmitting) {
      return "Saving New Version...";
    }

    if (isVerifyingVault || isVerifyingQuestions || isVerifyingFractionKeys) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Checking...
        </div>
      );
    }

    switch (editSteps[currentStep].key) {
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

      case "securityQuestion":
        return isSecurityAnswersVerified ? "Next" : "Verify";

      case "fractionKeys":
        return isFractionKeysVerified ? "Next" : "Verify";

      case "confirm":
        return "Save New Version";

      case "success":
        return "Close";

      default:
        return "Next";
    }
  })();

  const content = (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className={initialData || (editSteps[currentStep] && editSteps[currentStep].key === "success") ? "hidden" : ""}>
        <Stepper steps={editSteps} currentStep={currentStep} />
      </div>

      {/* Warning regarding pending edit - visible on all steps after Vault ID (Step 1) */}
      {hasPendingEdit && currentStep > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950 mb-4">
          <p className="font-medium text-red-700 dark:text-red-300">
            ⏳ Previous Edit Still Processing
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            There is a pending edit that hasn&apos;t been confirmed on the blockchain yet.
            The content shown is from the <strong>previous confirmed version</strong>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The latest changes will appear once the pending transaction is confirmed (~20 minutes).
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
      {/* <div className="min-h-[280px]">{renderStepContent()}</div> */}
      <div className="">
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
            <div className="bg-primary/10 p-3 rounded-full mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="font-medium">Loading Inheritance Content...</p>
            <p className="text-sm text-muted-foreground mt-1 px-4">
              We are verifying your credentials and decrypting the vault content. This is done locally in your browser for security.
            </p>
          </div>
        ) : (
          renderStepContent()
        )}
      </div>

      {/* Error/Warning Message - display for all steps */}
      <AlertMessage
        message={stepError}
        variant={isWarning ? "warning" : "error"}
        showIcon
      />

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3">
        {currentStep > 0 && !initialData && editSteps[currentStep]?.key !== "success" ? (
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isSubmitting}
          >
            Previous
          </Button>
        ) : (
          <div />
        )}
        {/* Hide button in payment step - payment via BasePay/MetaMask button */}
        {/* Show 2 buttons for editSecurityQuestions step when not editing */}
        {editSteps[currentStep].key === "payment" ? (
          null
        ) : editSteps[currentStep].key === "editSecurityQuestions" && !formState.isEditingSecurityQuestions ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleToggleEditSecurityQuestions}
              disabled={isSubmitting}
            >
              Edit Security Questions
            </Button>
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
            >
              Continue
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleNext}
            disabled={isSubmitting || isVerifyingVault || isVerifyingQuestions || isVerifyingFractionKeys}
          >
            {buttonContent}
          </Button>
        )}
      </div>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Inheritance</DialogTitle>
          </DialogHeader>
          {content}
          <DialogFooter className="hidden" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="aui-vault-edit-wizard-root w-full rounded-xl border border-border bg-background p-6">
      <h3 className="mb-6 text-lg font-semibold">Edit Inheritance</h3>
      {content}
    </div>
  );
}


