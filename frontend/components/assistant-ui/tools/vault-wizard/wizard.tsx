"use client";

import { fakerID_ID as faker } from "@faker-js/faker";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertMessage } from "@/components/ui/alert-message";
import { FieldError } from "@/components/ui/field-error";
import { ReviewSection, ReviewItem } from "@/components/ui/review-display";
import { savePendingVault } from "@/lib/vault-storage";
import { cn } from "@/lib/utils";
import { FileText, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnifiedPaymentSelector, type PaymentMode } from "@/components/shared/payment";
import { Stepper } from "@/components/shared/stepper";
import type { ChainId } from "@/lib/metamaskWallet";
import {
  encapsulatePqcClient,
  generateVaultKey,
  encryptVaultPayloadClient,
  generatePqcKeyPairClient,
  wrapKeyClient,
  type PqcKeyPairClient,
} from "@/lib/clientVaultCrypto";
import { splitKeyClient } from "@/lib/shamirClient";
import { hashSecurityAnswerClient } from "@/lib/securityQuestionsClient";

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

type FractionKeyCommitmentsV1 = {
  scheme: "sha256";
  version: 1;
  byShareId: Record<string, string>;
  createdAt?: string;
};

function getCryptoSubtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return globalThis.crypto.subtle;
}

async function sha256HexFromString(value: string): Promise<string> {
  const hash = await getCryptoSubtle().digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseFractionKeyShareInfo(value: string): { bits: number; id: number } {
  const trimmed = value.trim();
  const bits = parseInt(trimmed.slice(0, 1), 36);
  if (!Number.isFinite(bits) || bits < 3 || bits > 20) {
    throw new Error("Invalid share: bits out of range");
  }
  const max = Math.pow(2, bits) - 1;
  const idLen = max.toString(16).length;
  const match = new RegExp(`^([a-kA-K3-9]{1})([a-fA-F0-9]{${idLen}})([a-fA-F0-9]+)$`).exec(trimmed);
  if (!match) {
    throw new Error("Invalid share format");
  }
  const id = parseInt(match[2], 16);
  if (!Number.isFinite(id) || id < 1 || id > max) {
    throw new Error("Invalid share: id out of range");
  }
  return { bits, id };
}

async function buildFractionKeyCommitmentsV1(fractionKeys: string[]): Promise<FractionKeyCommitmentsV1> {
  const byShareId: Record<string, string> = {};
  for (const key of fractionKeys) {
    const trimmed = key.trim();
    const info = parseFractionKeyShareInfo(trimmed);
    byShareId[String(info.id)] = await sha256HexFromString(trimmed);
  }
  return {
    scheme: "sha256",
    version: 1,
    byShareId,
    createdAt: new Date().toISOString(),
  };
}

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
  const [paymentProgress, setPaymentProgress] = useState<number | null>(null);
  const [paymentPhase, setPaymentPhase] = useState<"confirm" | "upload" | "finalize" | null>(null);
  const vaultIdRef = useRef<string | null>(null);
  const vaultKeyRef = useRef<Uint8Array | null>(null);
  const pqcKeyPairRef = useRef<PqcKeyPairClient | null>(null);
  const pqcCipherTextRef = useRef<string | null>(null);

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
        documents: [],
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
    setIsProcessingPayment(false);
    setPaymentStatus(null);
    vaultIdRef.current = null;
    vaultKeyRef.current = null;
    pqcKeyPairRef.current = null;
    pqcCipherTextRef.current = null;
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

  const handleDocumentsChange = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);


    // Calculate total size including existing documents and already selected new documents
    const existingSize = formState.willDetails.documents.reduce((acc, doc) => acc + doc.size, 0);
    const incomingSize = newFiles.reduce((acc, doc) => acc + doc.size, 0);

    const totalSize = existingSize + incomingSize;
    const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB

    if (totalSize > MAX_SIZE) {
      setStepError("Total document size cannot exceed 1 GB.");
      return;
    }

    setFormState((prev) => ({
      ...prev,
      willDetails: {
        ...prev.willDetails,
        documents: [...prev.willDetails.documents, ...newFiles],
      },
    }));
    // Clear error if adding files was successful
    setStepError(null);
  };

  const removeDocument = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      willDetails: {
        ...prev.willDetails,
        documents: prev.willDetails.documents.filter((_, i) => i !== index),
      },
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isNextBlockedByAttachmentPrep = false;

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

  const transformPayload = async (params: {
    vaultId: string;
    vaultKey: Uint8Array;
    onStatus?: (status: string) => void;
  }) => {
    const normalizeBase64 = (content: string): string => {
      if (!content) return "";
      if (!content.startsWith("data:")) return content;
      const commaIndex = content.indexOf(",");
      return commaIndex === -1 ? content : content.slice(commaIndex + 1);
    };

    const estimateBase64Bytes = (base64: string): number => {
      const trimmed = base64.trim();
      if (!trimmed) return 0;
      let padding = 0;
      if (trimmed.endsWith("==")) padding = 2;
      else if (trimmed.endsWith("=")) padding = 1;
      return (trimmed.length * 3) / 4 - padding;
    };

    const readFileAsBase64 = async (file: File): Promise<string> =>
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          resolve(normalizeBase64(result));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });

    const documentsWithContent: Array<{
      name: string;
      size: number;
      type: string;
      content?: string;
      attachment?: { txId: string; iv: string; checksum: string };
    }> = [];

    for (const doc of formState.willDetails.documents) {
      params.onStatus?.(`Reading document: ${doc.name}`);
      const base64Content = await readFileAsBase64(doc);
      if (!base64Content) {
        throw new Error(`Attachment "${doc.name}" has no content. Please re-upload the file.`);
      }

      const decodedSize = estimateBase64Bytes(base64Content);
      if (!Number.isFinite(decodedSize) || decodedSize <= 0 || Math.abs(decodedSize - doc.size) > 4) {
        throw new Error(`Attachment "${doc.name}" looks corrupted or incomplete. Please re-upload the file.`);
      }

      documentsWithContent.push({
        name: doc.name,
        size: doc.size,
        type: doc.type,
        content: base64Content,
      });
    }

    return {
      willDetails: {
        ...formState.willDetails,
        documents: documentsWithContent,
      },
      securityQuestions: formState.securityQuestions,
      triggerRelease: formState.triggerRelease,
      payment: {
        paymentMethod: formState.payment.paymentMethod,
      },
    };
  };

  const submitToMCP = async (overrides?: { storageType?: "arweave" | "bitxenArweave"; selectedChain?: ChainId }) => {
    setIsSubmitting(true);
    setStepError(null);
    setPaymentProgress(null);
    setPaymentPhase(null);

    const effectiveStorageType = overrides?.storageType ?? formState.storageType;
    const effectiveChain = overrides?.selectedChain ?? (formState.payment.selectedChain as ChainId | undefined);

    setPaymentStatus(effectiveStorageType === "bitxenArweave" ? "Step 1/2: Preparing your vault..." : "Preparing your vault...");

    try {
      const vaultId =
        vaultIdRef.current ??
        (typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      vaultIdRef.current = vaultId;

      const pqcKeyPair = pqcKeyPairRef.current ?? generatePqcKeyPairClient();
      pqcKeyPairRef.current = pqcKeyPair;

      if (!vaultKeyRef.current || !pqcCipherTextRef.current) {
        const { pqcCipherText, sharedSecret } = encapsulatePqcClient(pqcKeyPair.publicKey);
        pqcCipherTextRef.current = pqcCipherText;
        vaultKeyRef.current = sharedSecret.slice(0, 32);
      }

      const vaultKey = vaultKeyRef.current;
      const pqcCipherText = pqcCipherTextRef.current;
      if (!vaultKey || !pqcCipherText) {
        throw new Error("Failed to prepare vault encryption keys. Please try again.");
      }

      const setStepStatus = (status: string) => {
        if (effectiveStorageType !== "bitxenArweave") {
          setPaymentStatus(status);
          return;
        }

        const normalized = status.toLowerCase();
        if (normalized.includes("step 2") || normalized.includes("contract") || normalized.includes("metamask")) {
          setPaymentStatus(status);
          return;
        }

        if (normalized.startsWith("step 1/2:")) {
          setPaymentStatus(status);
          return;
        }

        setPaymentStatus(`Step 1/2: ${status}`);
      };

      const payload = await transformPayload({
        vaultId,
        vaultKey,
        onStatus: (status) => setStepStatus(status),
      });

      const payloadKey = generateVaultKey();
      const encryptedVault = await encryptVaultPayloadClient(payload, payloadKey);
      encryptedVault.pqcCipherText = pqcCipherText;
      encryptedVault.alg = "AES-GCM";
      encryptedVault.keyMode = "envelope";

      const wrappedKey = await wrapKeyClient(payloadKey, vaultKey);
      const contractEncryptedKey = JSON.stringify(wrappedKey);

      const fractionKeys = splitKeyClient(pqcKeyPair.secretKey);
      const fractionKeyCommitments = await buildFractionKeyCommitmentsV1(fractionKeys);

      const securityQuestionHashes = await Promise.all(
        payload.securityQuestions.map(async (sq) => ({
          question: sq.question,
          answerHash: await hashSecurityAnswerClient(sq.answer),
        })),
      );

      const metadata = {
        trigger: payload.triggerRelease,
        beneficiaryCount: 0,
        securityQuestionHashes,
        willType: payload.willDetails.willType,
        fractionKeyCommitments,
        contractEncryptedKey,
        encryptionVersion: "v3-envelope" as const,
      };

      const prepareResponse = await fetch("/api/vault/prepare-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vaultId,
          encryptedVault,
          metadata,
        }),
      });

      const prepareRaw = await prepareResponse.text();
      type PrepareClientResponse = {
        success?: boolean;
        error?: string;
        message?: string;
        details?: {
          vaultId?: string;
          arweavePayload?: unknown;
          encryptionVersion?: string;
        } | null;
      };

      const prepareData: PrepareClientResponse = (() => {
        try {
          return JSON.parse(prepareRaw) as PrepareClientResponse;
        } catch {
          return {
            success: false,
            error: prepareRaw || `Non-JSON response (HTTP ${prepareResponse.status}).`,
          };
        }
      })();

      if (!prepareResponse.ok || !prepareData.success || !prepareData.details) {
        throw new Error(
          prepareData.error ||
          prepareData.message ||
          "We couldn't prepare the inheritance. Please try again.",
        );
      }

      const details = prepareData.details as NonNullable<PrepareClientResponse["details"]>;
      const { arweavePayload } = details;

      let txId: string;

      let blockchainTxHash: string | undefined;
      let blockchainChain: string | undefined;
      let contractDataId: string | undefined;

      if (effectiveStorageType === "arweave") {
        setPaymentStatus("Step 1/2: Confirm transaction in Wander Wallet...");
        setPaymentPhase("confirm");
        setPaymentProgress(null);
        const { dispatchToArweave, isWalletReady, connectWanderWallet } = await import("@/lib/wanderWallet");
        if (!(await isWalletReady())) {
          await connectWanderWallet();
        }
        const dispatchResult = await dispatchToArweave(
          arweavePayload,
          vaultId,
          undefined,
          (progress) => {
            setPaymentProgress(progress);
            if (progress >= 0 && progress < 100) setPaymentPhase("upload");
            if (progress >= 100) setPaymentPhase("finalize");
          },
          (status) => {
            setPaymentStatus(status);
            const normalized = status.toLowerCase();
            if (
              normalized.includes("waiting for wallet") ||
              normalized.includes("confirm transaction") ||
              normalized.includes("confirm arweave") ||
              normalized.includes("signature")
            ) {
              setPaymentPhase("confirm");
              return;
            }
            if (
              normalized.includes("uploading") ||
              normalized.includes("upload chunk") ||
              normalized.includes("resuming") ||
              normalized.includes("preparing upload")
            ) {
              setPaymentPhase("upload");
              return;
            }
            if (normalized.includes("upload successful") || normalized.includes("successful")) {
              setPaymentPhase("finalize");
            }
          },
        );
        txId = dispatchResult.txId;
        setPaymentStatus("Upload successful! We're saving your inheritance details...");
      } else if (effectiveStorageType === "bitxenArweave") {
        // Hybrid: Arweave storage + Bitxen contract registry
        // We use the "bitxenArweave" storage type name but "hybrid" implementation under the hood
        setPaymentStatus("Confirm Arweave upload in Wander...");
        const { dispatchHybrid } = await import("@/lib/metamaskWallet");
        const selectedChain = (effectiveChain || "bsc") as ChainId;
        const isPermanent = payload.willDetails.willType === "one-time";
        const triggerMs =
          payload.triggerRelease.triggerType === "date" && payload.triggerRelease.triggerDate
            ? Date.parse(payload.triggerRelease.triggerDate)
            : NaN;
        const releaseDate = Number.isFinite(triggerMs)
          ? BigInt(Math.floor(triggerMs / 1000))
          : BigInt(0);

        const hybridResult = await dispatchHybrid(arweavePayload, vaultId, selectedChain, {
          isPermanent,
          releaseDate,
          encryptedKey: contractEncryptedKey,
          onProgress: (status) => {
            setPaymentStatus(status);
          },
        });

        // Use contract tx hash for display
        txId = hybridResult.arweaveTxId;
        blockchainTxHash = hybridResult.contractTxHash;
        blockchainChain = selectedChain;
        contractDataId = hybridResult.contractDataId;
        setPaymentStatus(`Hybrid storage complete! Arweave + ${selectedChain.toUpperCase()}`);
      } else {
        throw new Error("Invalid storage type: " + effectiveStorageType);
      }

      const resultData = {
        vaultId: vaultId,
        arweaveTxId: txId,
        blockchainTxHash,
        blockchainChain,
        contractDataId,
        message: "Your inheritance has been successfully created and stored on blockchain.",
        fractionKeys: fractionKeys || [],
        willType: payload.willDetails.willType,
        storageType: effectiveStorageType,
        createdAt: new Date().toISOString(),
        title: payload.willDetails.title,
        triggerType: payload.triggerRelease.triggerType,
        triggerDate: payload.triggerRelease.triggerDate,
      };

      console.log("✅ Inheritance created successfully:", resultData);

      // Save to local storage for persistence
      try {


        savePendingVault({
          vaultId: resultData.vaultId,
          arweaveTxId: resultData.arweaveTxId || "",
          title: resultData.title,
          willType: resultData.willType as "one-time" | "editable",
          fractionKeys: resultData.fractionKeys,
          triggerType: resultData.triggerType as "date" | "manual" | undefined,
          triggerDate: resultData.triggerDate,
          storageType: resultData.storageType as "arweave" | "bitxenArweave",
          blockchainTxHash: resultData.blockchainTxHash,
          blockchainChain: resultData.blockchainChain,
          contractDataId: typeof (resultData as { contractDataId?: unknown }).contractDataId === "string"
            ? ((resultData as { contractDataId?: string }).contractDataId as string)
            : undefined,
        });
      } catch (e) {
        console.error("Failed to save vault to local storage:", e);
      }

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

  const handleUnifiedPayment = async (mode: PaymentMode, chainId?: ChainId) => {
    try {
      setIsProcessingPayment(true);
      setPaymentProgress(null);
      setPaymentPhase(null);

      // Calculate effective values immediately (don't rely on async state update)
      const effectiveStorageType = mode === "wander" ? "arweave" : "bitxenArweave";
      const effectiveChain = chainId;

      // Also update form state for UI consistency (but don't depend on it for submit)
      setFormState((prev) => ({
        ...prev,
        storageType: effectiveStorageType,
        payment: {
          paymentMethod: mode === "wander" ? "wander" : "metamask",
          selectedChain: chainId,
        },
      }));

      if (mode === "wander") {
        setPaymentStatus("Preparing your vault...");
        setPaymentPhase("confirm");
      } else {
        setPaymentStatus("Step 1/2: Uploading to Arweave...");
      }

      // Pass overrides directly to submitToMCP to avoid async state issues
      await submitToMCP({
        storageType: effectiveStorageType,
        selectedChain: effectiveChain,
      });

    } catch (error) {
      console.error("Payment error:", error);
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

            <div className="space-y-3">
              <label className="text-sm font-medium">
                Additional Documents (optional)
              </label>

              {stepError && (
                <AlertMessage
                  message={stepError}
                  variant="error"
                  showIcon
                />
              )}

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:bg-muted/50">
                <FileText className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload documents</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, Office, images, video, audio, and more
                </p>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.doc,.docx,.csv,.xls,.xlsx,.heic,.heiv,.hevc,.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.m4v,.rtf,.rtfd,.html,.odt,.ai,.eps,.svg,.tiff,.psd,.fbx,.stp,.step,.igs,.iges,.stl,.3mf,.obg,.mp3,.aac,.wav,.flac,.alac,.aiff,.ogg,.m4a"
                  onChange={(event) => handleDocumentsChange(event.target.files)}
                  className="sr-only"
                />
              </label>

              {formState.willDetails.documents.length > 0 && (
                <div className="space-y-2">
                  {formState.willDetails.documents.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <div className="mt-0.5 flex items-center justify-start gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <Badge
                            className={cn(
                              "shrink-0 gap-1.5 border !shadow-none",
                              "border-emerald-200 bg-emerald-50 hover:bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
                            )}
                          >
                            <span>Encrypted</span>
                          </Badge>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        aria-label="Remove file"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
      case "payment":
        return (
          <UnifiedPaymentSelector
            onSubmit={handleUnifiedPayment}
            isSubmitting={isSubmitting || isProcessingPayment}
            paymentStatus={paymentStatus}
            paymentProgress={paymentProgress}
            paymentPhase={paymentPhase}
            isReady={true}
            blockedReason={null}
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
        <Button onClick={handleNext} disabled={isSubmitting || isNextBlockedByAttachmentPrep}>
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
