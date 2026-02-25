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
  prepareArweavePayloadClient,
  calculateCommitment,
  generatePqcKeyPairClient,
  encapsulatePqcClient,
  generateVaultKey,
  encryptVaultPayloadClient,
  wrapKeyClient,
  type PqcKeyPairClient,
  generateRandomSecret,
  deriveUnlockKey,
  sealWithDrand,
} from "@/lib/clientVaultCrypto";
import { timestampToDrandRonde } from "@/lib/drand";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { splitKeyClient } from "@/lib/shamirClient";
import { hashSecurityAnswerClient } from "@/lib/securityQuestionsClient";
import { CHAIN_CONFIG } from "@/lib/metamaskWallet";

import type {
  FormState,
  SecurityQuestion,
  VaultCreationWizardProps,
} from "../types";
import { initialFormState, steps } from "../constants";
import { useArweaveUpload } from "@/hooks/use-arweave-upload";


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


export function useVaultCreation({
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

  const { upload: arUpload, progress: arProgress, status: arStatus, phase: arPhase, isUploading: isArUploading, reset: resetArUpload } = useArweaveUpload();



  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (isArUploading) {
      setPaymentStatus(arStatus);
      setPaymentProgress(arProgress);
      if (arPhase !== "idle") {
        setPaymentPhase(arPhase as any);
      }
    }
  }, [isArUploading, arStatus, arProgress, arPhase]);


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

    const loremParagraphs = faker.lorem.paragraphs({ min: 2, max: 3 });

    const dummyState: FormState = {
      willDetails: {
        willType: "editable",
        title: `Inheritance ${faker.company.name()}`,
        content: loremParagraphs.replace(/\n/g, "\n\n"),
        documents: [],
      },
      securityQuestions,
      triggerRelease: {
        triggerType: "manual",
        triggerDate: undefined,
      },
      storageType: "bitxenArweave",
      payment: {
        paymentMethod: "wander",
        selectedChain: undefined,
      },
    };

    setFormState(dummyState);
    setCurrentStep(0);
    setStepError(null);
    setFieldErrors({}); // Clear validation errors
    setIsSubmitting(false);

    // Reset crypto-related refs to ensure a clean test run
    vaultIdRef.current = null;
    vaultKeyRef.current = null;
    pqcKeyPairRef.current = null;
    pqcCipherTextRef.current = null;

    console.log('Dummy data filled:', dummyState);
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
    resetArUpload();
  }, [resetArUpload]);


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
        if (isSubmitting) return; // Don't trigger while submitting
        event.preventDefault();
        fillWithDummyData();
      }
    };

    window.addEventListener("keydown", handleHotkey);
    return () => window.removeEventListener("keydown", handleHotkey);
  }, [fillWithDummyData, isSubmitting]);

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

  const handleWillTypeChange = (
    type: FormState["willDetails"]["willType"],
  ) => {
    setFormState((prev) => {
      const newState = {
        ...prev,
        willDetails: {
          ...prev.willDetails,
          willType: type,
        },
      };

      if (type === "editable") {
        newState.triggerRelease = {
          ...prev.triggerRelease,
          triggerType: "manual",
          triggerDate: undefined,
        };
      }

      return newState;
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

        if (formState.willDetails.willType === "editable" && formState.triggerRelease.triggerType !== "manual") {
          errors.triggerType = "Editable inheritance must use anytime trigger.";
        }

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

      let finalVaultKey = vaultKey;
      let plainContractSecret: string | undefined;
      let sealedContractSecret: string | undefined;
      let ronde: number | undefined;

      if (effectiveStorageType === "bitxenArweave") {
        plainContractSecret = generateRandomSecret();

        // Calculate Drand Ronde for sealing
        let triggerMs = NaN;
        if (payload.triggerRelease.triggerType === "date" && payload.triggerRelease.triggerDate) {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const isToday = payload.triggerRelease.triggerDate === todayStr;

          if (isToday) {
            triggerMs = now.getTime() + (5 * 60 * 1000);
          } else {
            const [year, month, day] = payload.triggerRelease.triggerDate.split("-").map(Number);
            triggerMs = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
          }
        }

        const releaseSeconds = Number.isFinite(triggerMs)
          ? Math.floor(triggerMs / 1000)
          : Math.floor(Date.now() / 1000);

        ronde = timestampToDrandRonde(releaseSeconds);
        console.log(`🔒 Sealing secret for ronde ${ronde} (release date: ${new Date(releaseSeconds * 1000).toISOString()})`);

        sealedContractSecret = await sealWithDrand(new TextEncoder().encode(plainContractSecret), ronde);

        const selectedChain = (effectiveChain || "bsc") as ChainId;
        const config = CHAIN_CONFIG[selectedChain];
        const contractAddress = config.contractAddress;

        finalVaultKey = await deriveUnlockKey(
          vaultKey,
          plainContractSecret,
          {
            chainId: config.chainId,
            contractAddress: contractAddress,
          }
        );
      }

      const wrappedKey = await wrapKeyClient(payloadKey, finalVaultKey);
      const contractEncryptedKey = JSON.stringify(wrappedKey);

      const fractionKeys = splitKeyClient(pqcKeyPair.secretKey);
      const fractionKeyCommitments = await buildFractionKeyCommitmentsV1(fractionKeys);

      const securityQuestionHashes = await Promise.all(
        payload.securityQuestions.map(async (sq) => ({
          question: sq.question,
          answerHash: await hashSecurityAnswerClient(sq.answer),
        })),
      );

      // Build metadata with proper scope for ronde variable
      const metadata: any = {
        trigger: payload.triggerRelease,
        beneficiaryCount: 0,
        securityQuestionHashes,
        willType: payload.willDetails.willType,
        fractionKeyCommitments,
        contractEncryptedKey,
        sealedContractSecret,
        encryptionVersion: "v3-envelope" as const,
        contractAddress:
          effectiveStorageType === "bitxenArweave" && effectiveChain
            ? CHAIN_CONFIG[effectiveChain as ChainId].contractAddress
            : undefined,
        blockchainChain:
          effectiveStorageType === "bitxenArweave" && effectiveChain
            ? effectiveChain
            : undefined,
      };

      // Add triggerRonde only for bitxenArweave storage
      if (effectiveStorageType === "bitxenArweave" && ronde !== undefined) {
        metadata.triggerRonde = ronde;
      }

      const arweavePayload = await prepareArweavePayloadClient({
        vaultId,
        encryptedVault,
        metadata,
      });

      let txId: string;

      let blockchainTxHash: string | undefined;
      let blockchainChain: string | undefined;
      let contractDataId: string | undefined;

      if (effectiveStorageType === "arweave") {
        setPaymentStatus("Step 1/2: Preparing your vault...");
        const dispatchResult = await arUpload(arweavePayload, vaultId);
        txId = dispatchResult.txId;
        setPaymentStatus("Upload successful! We're saving your inheritance details...");
      } else if (effectiveStorageType === "bitxenArweave") {

        // Hybrid: Arweave storage + Bitxen contract registry
        // We use the "bitxenArweave" storage type name but "hybrid" implementation under the hood
        setPaymentStatus("Step 1/2: Confirm in Wander (Arweave)...");
        const { dispatchHybrid } = await import("@/lib/metamaskWallet");
        const selectedChain = (effectiveChain || "bsc") as ChainId;
        const isPermanent = payload.willDetails.willType === "one-time";
        let triggerMs = NaN;
        if (payload.triggerRelease.triggerType === "date" && payload.triggerRelease.triggerDate) {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const isToday = payload.triggerRelease.triggerDate === todayStr;

          if (isToday) {
            // Sejak pengguna memilih hari ini, tambahkan 5 menit dari waktu saat ini.
            triggerMs = now.getTime() + (5 * 60 * 1000);
          } else {
            // Jika memilih tanggal di masa depan, atur waktu ke 00:00:00 zona waktu LOKAL pengguna pada hari tersebut.
            const [year, month, day] = payload.triggerRelease.triggerDate.split("-").map(Number);
            triggerMs = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
          }
        }
        const releaseDate = Number.isFinite(triggerMs)
          ? BigInt(Math.floor(triggerMs / 1000))
          : BigInt(0);

        // Calculate Commitment (Anti-Bypass)
        // We need dataHash (hash of the encrypted vault payload) and wrappedKeyHash.
        // We must ensure dataHash matches what dispatchHybrid uses (keccak256(JSON.stringify(payload))).

        const { connectMetaMask } = await import("@/lib/metamaskWallet");
        const userAddress = await connectMetaMask();

        const dataJson = JSON.stringify(arweavePayload);
        const dataHashBytes = keccak_256(new TextEncoder().encode(dataJson));
        const dataHash = "0x" + Array.from(dataHashBytes as Uint8Array).map(b => (b as number).toString(16).padStart(2, '0')).join('');

        const wrappedKeyHashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contractEncryptedKey));
        const wrappedKeyHash = "0x" + Array.from(new Uint8Array(wrappedKeyHashBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

        const commitment = calculateCommitment({
          dataHash,
          wrappedKeyHash,
          ownerAddress: userAddress,
        });

        const hybridResult = await dispatchHybrid(arweavePayload, vaultId, selectedChain, {
          isPermanent,
          releaseDate,
          commitment,
          secret: "0x" + "0".repeat(64), // No plaintext secret on Bitxen blockchain
          onUploadProgress: (progress) => {
            setPaymentProgress(progress);
            if (progress >= 0 && progress < 100) setPaymentPhase("upload");
            if (progress >= 100) setPaymentPhase("finalize");
          },
          onProgress: (status) => {
            setPaymentStatus(status);
            const normalized = status.toLowerCase();
            if (
              normalized.includes("waiting for wallet") ||
              normalized.includes("confirm transaction") ||
              normalized.includes("confirm arweave") ||
              normalized.includes("confirm in wander") ||
              normalized.includes("signature")
            ) {
              setPaymentPhase("confirm");
              return;
            }
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
        plainContractSecret,
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

  return {
    isDialog, formState, setFormState, currentStep, setCurrentStep, stepError, setStepError, fieldErrors, setFieldErrors, isSubmitting, setIsSubmitting, isProcessingPayment, setIsProcessingPayment, paymentStatus, setPaymentStatus, paymentProgress, setPaymentProgress, paymentPhase, setPaymentPhase, vaultIdRef, vaultKeyRef, pqcKeyPairRef, pqcCipherTextRef, textareaRef, adjustTextareaHeight, fillWithDummyData, resetWizard, handleDocumentsChange, removeDocument, formatFileSize, isNextBlockedByAttachmentPrep, handleSecurityQuestionChange, addSecurityQuestion, removeSecurityQuestion, handleWillTypeChange, handleTriggerTypeChange, setPresetTriggerDate, reviewSummary, validateStep, transformPayload, submitToMCP, handleNext, handleUnifiedPayment, handlePrev
  };
}
