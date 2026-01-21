"use client";

import { fakerID_ID as faker } from "@faker-js/faker";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertMessage } from "@/components/ui/alert-message";
import { FieldError } from "@/components/ui/field-error";
import { ReviewSection, ReviewItem } from "@/components/ui/review-display";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WanderWalletButton, StorageSelector, MetaMaskWalletButton } from "@/components/shared/payment";
import { Stepper } from "@/components/shared/stepper";
import type { ChainId } from "@/lib/metamaskWallet";
import {
  connectWanderWallet,
  sendArPayment,
  WANDER_PAYMENT_CONFIG,
} from "@/lib/wanderWallet";


import type {
  FormState,
  SecurityQuestion,
  VaultCreationWizardProps,
} from "./types";
import { initialFormState, steps } from "./constants";

const placeholderSecurityQuestions = [
  "e.g. Where did we travel in 2025?",
  "e.g. What is my favorite Indonesian food?",
  "e.g. What is our first car's brand?",
];

export function VaultCreationWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
}: VaultCreationWizardProps) {

  const isDialog = variant === "dialog";
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (steps[currentStep]?.key === "willDetails") {
      // Small timeout to ensure DOM is ready and ref is attached
      const timer = setTimeout(() => {
        adjustTextareaHeight();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [formState.willDetails.content, currentStep, adjustTextareaHeight]);

  // No additional currency state needed for Wander Wallet

  const fillWithDummyData = useCallback(() => {
    const securityQuestions = Array.from({ length: 3 }, (_, idx) => ({
      question: `Security question ${idx + 1}: ${faker.lorem.sentence()}`,
      answer: (idx + 1).toString(),
    }));

    const triggerDate = faker.date
      .future({ years: 5 })
      .toISOString()
      .split("T")[0];

    const loremParagraphs = faker.lorem.paragraphs({ min: 2, max: 3 });

    setFormState({
      willDetails: {
        willType: "editable",
        title: `Inheritance ${faker.company.name()}`,
        content: loremParagraphs.replace(/\n/g, "\n\n"),
      },
      securityQuestions,
      triggerRelease: {
        triggerType: "manual",
        triggerDate,
      },
      storageType: "arweave",
      payment: {
        paymentMethod: "wander",
        selectedChain: undefined,
      },
    });
    setCurrentStep(0);
    setStepError(null);
    setIsSubmitting(false);
  }, []);



  const resetWizard = useCallback(() => {
    setFormState(initialFormState);
    setCurrentStep(0);
    setStepError(null);
    setFieldErrors({});
    setIsSubmitting(false);
  }, []);

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

  useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        fillWithDummyData();
      }
    };

    window.addEventListener("keydown", handleHotkey);
    return () => window.removeEventListener("keydown", handleHotkey);
  }, [fillWithDummyData]);





  const handleSecurityQuestionChange = (
    index: number,
    field: keyof SecurityQuestion,
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      securityQuestions: prev.securityQuestions.map((sq, i) =>
        i === index ? { ...sq, [field]: value } : sq,
      ),
    }));
    // Clear error when user starts typing
    const errorKey = `securityQuestions.${index}.${field}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addSecurityQuestion = () => {
    setFormState((prev) => ({
      ...prev,
      securityQuestions: [
        ...prev.securityQuestions,
        { question: "", answer: "" },
      ].slice(0, 5),
    }));
    // Reset field errors for securityQuestions because index changed
    setFieldErrors((prev) => {
      const newErrors: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith("securityQuestions.")) {
          newErrors[key] = prev[key];
        }
      });
      return newErrors;
    });
  };

  const removeSecurityQuestion = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      securityQuestions: prev.securityQuestions.filter((_, i) => i !== index),
    }));
    // Reset field errors for securityQuestions because index changed
    setFieldErrors((prev) => {
      const newErrors: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith("securityQuestions.")) {
          newErrors[key] = prev[key];
        }
      });
      return newErrors;
    });
  };

  const handlePaymentMethodChange = (
    method: FormState["payment"]["paymentMethod"],
  ) => {
    setFormState((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        paymentMethod: method,
      },
    }));
    // Clear error when user selects payment method
    if (fieldErrors.paymentMethod) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.paymentMethod;
        return newErrors;
      });
    }
  };

  const handleTriggerTypeChange = (
    type: FormState["triggerRelease"]["triggerType"],
  ) => {
    setFormState((prev) => ({
      ...prev,
      triggerRelease: {
        ...prev.triggerRelease,
        triggerType: type,
        triggerDate: type === "date" ? prev.triggerRelease.triggerDate : undefined,
      },
    }));
  };

  const setPresetTriggerDate = (years: number) => {
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + years);
    const iso = targetDate.toISOString().split("T")[0];
    setFormState((prev) => ({
      ...prev,
      triggerRelease: {
        ...prev.triggerRelease,
        triggerDate: iso,
      },
    }));
  };

  const reviewSummary = useMemo(
    () => ({
      ...formState,
      willDetails: {
        ...formState.willDetails,
      },
    }),
    [formState],
  );

  const validateStep = (index: number) => {
    const errors: Record<string, string> = {};

    switch (steps[index].key) {
      case "willDetails": {
        if (!formState.willDetails.title.trim()) {
          errors.title = "Please enter a title for your inheritance.";
        }
        if (!formState.willDetails.content.trim()) {
          errors.content = "Please enter the content for your inheritance.";
        }
        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "securityQuestions": {
        const errors: Record<string, string> = {};

        if (
          formState.securityQuestions.length < 3 ||
          formState.securityQuestions.length > 5
        ) {
          return "Please set between 3 and 5 security questions.";
        }

        formState.securityQuestions.forEach((sq, index) => {
          if (!sq.question.trim()) {
            errors[`securityQuestions.${index}.question`] = "Please enter a question.";
          }
          if (!sq.answer.trim()) {
            errors[`securityQuestions.${index}.answer`] = "Please provide an answer.";
          }
        });

        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "triggerRelease": {
        const errors: Record<string, string> = {};

        if (
          formState.triggerRelease.triggerType === "date" &&
          !formState.triggerRelease.triggerDate
        ) {
          errors.triggerDate = "Please choose a release date or select a quick option.";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      case "payment": {
        const errors: Record<string, string> = {};

        // Validation: only wander payment method is available
        if (!formState.payment.paymentMethod) {
          errors.paymentMethod = "Please choose a payment method.";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
      }
      default:
        return null;
    }
  };

  const transformPayload = async () => {
    return {
      willDetails: {
        ...formState.willDetails,
        ...formState.willDetails,
      },
      securityQuestions: formState.securityQuestions,
      triggerRelease: formState.triggerRelease,
      payment: {
        paymentMethod: formState.payment.paymentMethod,
      },
    };
  };

  const extractFractionKeys = (details: Record<string, unknown> | null | undefined) => {
    if (!details || typeof details !== "object") {
      console.warn("⚠️ extractFractionKeys: details is null or not an object");
      return [];
    }

    // Priority 1: fractionKeys directly from backend (array of strings)
    const fractionKeysArray = Array.isArray(
      (details as { fractionKeys?: unknown }).fractionKeys,
    )
      ? ((details as { fractionKeys?: unknown }).fractionKeys as unknown[])
      : null;

    if (fractionKeysArray && fractionKeysArray.length > 0) {
      const extracted = fractionKeysArray
        .map((value) => (typeof value === "string" ? value : null))
        .filter((key): key is string => Boolean(key))
        .slice(0, 5);

      console.log("✅ extractFractionKeys: Found fractionKeys array:", {
        count: extracted.length,
        firstKey: extracted[0]?.substring(0, 20) + "...",
      });

      return extracted;
    }

    // Priority 2: keys with structure { key: string, beneficiary: ... }
    const assignedKeys = Array.isArray((details as { fractionKeyAssignments?: unknown }).fractionKeyAssignments)
      ? ((details as { fractionKeyAssignments?: unknown }).fractionKeyAssignments as Array<{ key?: string }>)
      : [];

    if (assignedKeys.length > 0) {
      const extracted = assignedKeys
        .map((entry) => (typeof entry?.key === "string" ? entry.key : null))
        .filter((key): key is string => Boolean(key))
        .slice(0, 5);

      console.log("✅ extractFractionKeys: Found fractionKeyAssignments array:", {
        count: extracted.length,
        firstKey: extracted[0]?.substring(0, 20) + "...",
      });

      return extracted;
    }

    console.warn("⚠️ extractFractionKeys: No fraction keys found in details:", {
      hasFractionKeys: !!fractionKeysArray,
      hasAssignments: assignedKeys.length > 0,
      detailsKeys: Object.keys(details),
    });

    return [];
  };

  const submitToMCP = async () => {
    setIsSubmitting(true);
    setStepError(null);

    // Initial status
    setPaymentStatus("Preparing inheritance...");

    try {
      // 1. Prepare inheritance logic (Backend encrypts data)
      const payload = await transformPayload();

      // Call prepare endpoint instead of create
      const prepareResponse = await fetch("/api/vault/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok || !prepareData.success) {
        throw new Error(prepareData.error || prepareData.message || "We couldn't prepare the inheritance. Please try again.");
      }

      const { details } = prepareData;
      const { arweavePayload, fractionKeys, fractionKeyAssignments, vaultId } = details;

      // 2. Dispatch to blockchain (Frontend signs & uploads)
      // Use the appropriate wallet based on selected payment method
      let txId: string;

      let blockchainTxHash: string | undefined;
      let blockchainChain: string | undefined;

      if (formState.storageType === "arweave") {
        setPaymentStatus("Confirm transaction in Wander Wallet...");
        const { dispatchToArweave } = await import("@/lib/wanderWallet");
        const dispatchResult = await dispatchToArweave(arweavePayload, vaultId);
        txId = dispatchResult.txId;
        setPaymentStatus("Upload successful! We're saving your inheritance details...");
      } else if (formState.storageType === "bitxen") {
        setPaymentStatus("Confirm transaction in MetaMask...");
        const { dispatchToBitxen } = await import("@/lib/metamaskWallet");
        const selectedChain = (formState.payment.selectedChain || "bsc") as ChainId;
        const dispatchResult = await dispatchToBitxen(arweavePayload, vaultId, selectedChain);
        txId = dispatchResult.txHash;
        blockchainTxHash = dispatchResult.txHash;
        blockchainChain = selectedChain;
        setPaymentStatus(`Upload successful on ${selectedChain.toUpperCase()}!`);
      } else {
        throw new Error("Invalid storage type: " + formState.storageType);
      }

      // 3. Finalize success
      const resultData = {
        vaultId: vaultId,
        arweaveTxId: formState.storageType === "arweave" ? txId : null,
        blockchainTxHash,
        blockchainChain,
        message: "Your inheritance has been successfully created and stored on blockchain.",
        fractionKeys: fractionKeyAssignments && fractionKeyAssignments.length > 0
          ? fractionKeyAssignments.map((a: { key: string }) => a.key)
          : (fractionKeys || []),
        willType: payload.willDetails.willType,
        storageType: formState.storageType,
        createdAt: new Date().toISOString(),
        title: payload.willDetails.title,
        triggerType: payload.triggerRelease.triggerType,
        triggerDate: payload.triggerRelease.triggerDate,
      };

      console.log("✅ Inheritance created successfully:", resultData);

      onResult?.({
        status: "success",
        data: resultData,
      });

      // Close form after success
      onOpenChange?.(false);

    } catch (error) {
      console.error("Failed to submit VaultCreationWizard:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while processing your inheritance.";

      setStepError(message);
      setPaymentStatus(`Error: ${message}`);

      onResult?.({
        status: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
      // Don't clear payment status immediately so user sees "Success" or "Error"
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

    if (steps[currentStep].key === "payment") {
      await submitToMCP();
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleWanderPayment = async () => {
    try {
      setIsProcessingPayment(true);
      setPaymentStatus("Connecting to your Wander Wallet...");

      await connectWanderWallet();

      setPaymentStatus("Wallet connected successfully! We're creating your inheritance now...");

      // No separate payment - fee inheritance be handled during blockchain upload
      await handleNext();

      // Status handled by submitToMCP
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

      const { connectMetaMask } = await import("@/lib/metamaskWallet");
      await connectMetaMask();

      setPaymentStatus("Wallet connected! Processing transaction...");

      // Proceed to submit
      await handleNext();

      // Status handled by submitToMCP
    } catch (error) {
      console.error("MetaMask error:", error);
      setPaymentStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };



  const handlePrev = () => {
    setStepError(null);
    setFieldErrors({});
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  const renderStepContent = () => {
    switch (steps[currentStep].key) {
      case "willDetails":
        return (
          <div className="w-full max-w-full space-y-4 overflow-x-auto">
            <div className="w-full max-w-full">
              <p className="text-sm font-medium text-muted-foreground">
                Inheritance Type
              </p>
              <div className="mt-2 flex flex-wrap gap-3 w-full">
                {[
                  { label: "One-Time", value: "one-time" },
                  { label: "Editable", value: "editable" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "cursor-pointer rounded-lg border px-4 py-2 text-sm",
                      formState.willDetails.willType === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="willType"
                      value={option.value}
                      checked={formState.willDetails.willType === option.value}
                      onChange={() =>
                        setFormState((prev) => ({
                          ...prev,
                          willDetails: {
                            ...prev.willDetails,
                            willType: option.value as
                              | "one-time"
                              | "editable",
                          },
                        }))
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 w-full max-w-full">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formState.willDetails.title}
                onChange={(event) => {
                  setFormState((prev) => ({
                    ...prev,
                    willDetails: {
                      ...prev.willDetails,
                      title: event.target.value,
                    },
                  }));
                  // Clear error when user starts typing
                  if (fieldErrors.title) {
                    setFieldErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.title;
                      return newErrors;
                    });
                  }
                }}
                placeholder="e.g., My Digital Will"
                className={cn("w-full max-w-full", fieldErrors.title ? "border-destructive" : "")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmitting) {
                    handleNext();
                  }
                }}
              />
              <FieldError message={fieldErrors.title} />
            </div>
            <div className="space-y-2 w-full max-w-full">
              <label className="text-sm font-medium">
                Content
              </label>
              <Textarea
                ref={textareaRef}
                value={formState.willDetails.content}
                rows={5}
                onChange={(event) => {
                  setFormState((prev) => ({
                    ...prev,
                    willDetails: {
                      ...prev.willDetails,
                      content: event.target.value,
                    },
                  }));
                  // Clear error when user starts typing
                  if (fieldErrors.content) {
                    setFieldErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.content;
                      return newErrors;
                    });
                  }
                }}
                placeholder="Type your secure message or instructions here..."
                className={cn("w-full max-w-full resize-none overflow-hidden", fieldErrors.content ? "border-destructive" : "")}
              />
              <FieldError message={fieldErrors.content} />
            </div>
          </div>

        );
      case "securityQuestions":
        return (
          <div className="space-y-4">
            {formState.securityQuestions.map((sq, index) => (
              <div
                key={`security-question-${index}`}
                className="rounded-xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Question #{index + 1}
                  </p>
                  {formState.securityQuestions.length > 3 && (
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => removeSecurityQuestion(index)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <Input
                      placeholder={placeholderSecurityQuestions[index] || "Enter your security question"}
                      value={sq.question}
                      onChange={(event) =>
                        handleSecurityQuestionChange(
                          index,
                          "question",
                          event.target.value,
                        )
                      }
                      className={fieldErrors[`securityQuestions.${index}.question`] ? "border-destructive" : ""}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSubmitting) {
                          handleNext();
                        }
                      }}
                    />
                    <FieldError message={fieldErrors[`securityQuestions.${index}.question`]} />
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Enter answer..."
                      value={sq.answer}
                      onChange={(event) =>
                        handleSecurityQuestionChange(
                          index,
                          "answer",
                          event.target.value,
                        )
                      }
                      className={fieldErrors[`securityQuestions.${index}.answer`] ? "border-destructive" : ""}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSubmitting) {
                          handleNext();
                        }
                      }}
                    />
                    <FieldError message={fieldErrors[`securityQuestions.${index}.answer`]} />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={formState.securityQuestions.length >= 5}
              onClick={addSecurityQuestion}
            >
              + Add Question
            </Button>
          </div>
        );
      case "triggerRelease":
        return (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Trigger Release</p>
              <div className="mt-2 flex gap-3">
                {[
                  { label: "Anytime", value: "manual" },
                  { label: "Specific Date", value: "date" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "cursor-pointer rounded-lg border px-4 py-2 text-sm",
                      formState.triggerRelease.triggerType === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="triggerType"
                      value={option.value}
                      checked={formState.triggerRelease.triggerType === option.value}
                      onChange={() =>
                        handleTriggerTypeChange(
                          option.value as "date" | "manual",
                        )
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {formState.triggerRelease.triggerType === "manual" && (
              <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                The inheritance can be opened anytime by the heir who has the fraction keys and passes security verification.
              </p>
            )}
            {formState.triggerRelease.triggerType === "date" && (
              <>
                <div>
                  <p className="text-sm font-medium">Quick Options</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[5, 10, 15, 20].map((years) => (
                      <Button
                        key={years}
                        type="button"
                        variant="outline"
                        onClick={() => setPresetTriggerDate(years)}
                      >
                        {years} years
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Or select custom date
                  </label>
                  <div className="space-y-1">
                    <Input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={formState.triggerRelease.triggerDate || ""}
                      onChange={(event) => {
                        setFormState((prev) => ({
                          ...prev,
                          triggerRelease: {
                            ...prev.triggerRelease,
                            triggerDate: event.target.value,
                          },
                        }));
                        // Clear error when user selects date
                        if (fieldErrors.triggerDate) {
                          setFieldErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.triggerDate;
                            return newErrors;
                          });
                        }
                      }}
                      className={fieldErrors.triggerDate ? "border-destructive" : ""}
                    />
                    <FieldError message={fieldErrors.triggerDate} />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case "review":
        return (
          <div className="space-y-4 text-sm">
            <ReviewSection title="Inheritance Details">
              <ReviewItem label="Type" value={reviewSummary.willDetails.willType} className="capitalize" />
              <ReviewItem label="Title" value={reviewSummary.willDetails.title} />

            </ReviewSection>
            <ReviewSection title="Security Questions">
              {reviewSummary.securityQuestions.map((sq, index) => (
                <ReviewItem
                  key={`review-sq-${index}`}
                  label={`Security Question ${index + 1}`}
                  value={
                    <div className="flex flex-col gap-1 mt-1">
                      <div>
                        <span className="font-semibold">Question:</span> {sq.question}
                      </div>
                      <div>
                        <span className="font-semibold">Answer:</span> {sq.answer}
                      </div>
                    </div>
                  }
                />
              ))}
            </ReviewSection>
            <ReviewSection title="Trigger Release">
              <ReviewItem
                label="Type"
                value={reviewSummary.triggerRelease.triggerType == 'manual' ? 'By request' : reviewSummary.triggerRelease.triggerType}
                className="capitalize"
              />
              <ReviewItem
                label="Date"
                value={
                  reviewSummary.triggerRelease.triggerDate || "Anytime"
                }
              />
            </ReviewSection>
            {/* <ReviewSection title="Payment">
              <ReviewItem
                label="Method"
                value={reviewSummary.payment.paymentMethod}
              />
            </ReviewSection> */}
          </div>
        );
      case "storageSelection":
        return (
          <StorageSelector
            selectedStorage={formState.storageType}
            onStorageChange={(storage) => {
              setFormState((prev) => ({
                ...prev,
                storageType: storage,
                payment: {
                  ...prev.payment,
                  paymentMethod: storage === "arweave" ? "wander" : "metamask",
                  selectedChain: storage === "bitxen" ? (prev.payment.selectedChain || "bsc") : undefined,
                },
              }));
            }}
            selectedChain={(formState.payment.selectedChain || "bsc") as ChainId}
            onChainChange={(chain) => {
              setFormState((prev) => ({
                ...prev,
                payment: { ...prev.payment, selectedChain: chain },
              }));
            }}
          />
        );
      case "payment":
        if (formState.storageType === "bitxen") {
          return (
            <div className="space-y-4">
              <MetaMaskWalletButton
                onClick={handleMetaMaskPayment}
                disabled={isSubmitting || isProcessingPayment}
                selectedChain={(formState.payment.selectedChain || "bsc") as ChainId}
              />
              {paymentStatus && (
                <p className="text-sm text-muted-foreground text-center">
                  {paymentStatus}
                </p>
              )}
            </div>
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
      default:
        return null;
    }
  };

  const FooterButtons = (
    <div className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      !isDialog && "mt-4"
    )}>
      {currentStep > 0 && (
        <Button variant="outline" onClick={handlePrev} disabled={isSubmitting}>
          Back
        </Button>
      )}
      {/* Hide Next button in payment step - payment is done via wallet button in PaymentMethodSelector */}
      {currentStep !== steps.length - 1 && (
        <Button onClick={handleNext} disabled={isSubmitting}>
          Next
        </Button>
      )}
    </div>
  );

  const StepContent = (
    <>
      {/* Step Header with Description */}
      <Stepper steps={steps} currentStep={currentStep} className="mb-4" />

      <div className="w-full max-w-full space-y-4 overflow-x-auto">{renderStepContent()}</div>

      {/* Show error below form only if not on a step that already displays errors below each field */}
      {steps[currentStep].key !== "willDetails" &&
        steps[currentStep].key !== "securityQuestions" &&
        steps[currentStep].key !== "triggerRelease" &&
        steps[currentStep].key !== "payment" && (
          <AlertMessage
            message={stepError}
            variant="error"
            showIcon
          />
        )}

      {isDialog ? (
        <DialogFooter className="gap-2">
          {FooterButtons}
        </DialogFooter>
      ) : (
        FooterButtons
      )}
    </>
  );

  const TitleBlock = isDialog ? (
    <DialogHeader>
      <DialogTitle className="flex flex-col gap-1">
        <span>Create Inheritance</span>
        <span className="text-sm font-normal text-muted-foreground">
          Step {currentStep + 1} of {steps.length}:{" "}
          {steps[currentStep].label}
        </span>
      </DialogTitle>
    </DialogHeader>
  ) : (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold leading-none">
        Create Inheritance
      </h2>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {TitleBlock}
          {StepContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="aui-inline-vault-wizard w-full max-w-full rounded-3xl border border-border bg-background p-4 sm:p-6 dark:border-muted-foreground/15 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {TitleBlock}
        {/* <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onOpenChange?.(false)}
        >
          Close
        </Button> */}
      </div>
      <div className="mt-4 w-full max-w-full space-y-4 overflow-x-auto">{StepContent}</div>
    </div>
  );
}