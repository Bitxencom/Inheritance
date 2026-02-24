"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
    type EditFormState,
    type VaultEditWizardProps,
    type VaultPayloadForEdit,
    type FractionKeyCommitmentsV1,
} from "../types";
import { editSteps, initialEditFormState } from "../constants";
import {
    type ChainId,
    DEFAULT_CHAIN,
    CHAIN_CONFIG,
    getChainConfig,
} from "@/lib/chains";
import {
    readBitxenDataIdByHash,
    readBitxenDataRecord,
    dispatchHybrid,
} from "@/lib/metamaskWallet";
import { getVaultById, updateVaultTxId } from "@/lib/vault-storage";
import { combineSharesClient } from "@/lib/shamirClient";
import {
    deriveEffectiveAesKeyClient,
    deriveUnlockKey,
    decryptVaultPayloadClient,
    decryptVaultPayloadRawKeyClient,
    encryptVaultPayloadClient,
    prepareArweavePayloadClient,
    unwrapKeyClient,
    type EncryptedVaultClient,
    type WrappedKeyV1,
} from "@/lib/clientVaultCrypto";
import { sha256Hex } from "@/lib/crypto-utils";
import { hashSecurityAnswerClient } from "@/lib/securityQuestionsClient";
import {
    validateSecurityQuestionsApi,
    getLocalVaultErrorMessage,
    generateSecurityQuestionFieldErrors,
} from "@/components/assistant-ui/tools/shared";
import { type PaymentMode } from "@/components/shared/payment";
import { useArweaveUpload } from "@/hooks/use-arweave-upload";



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

async function verifyFractionKeyCommitmentsIfPresent(params: {
    metadata: unknown;
    fractionKeys: string[];
}): Promise<void> {
    const metadataAny = params.metadata as { fractionKeyCommitments?: unknown } | null | undefined;
    const commitmentConfig = metadataAny?.fractionKeyCommitments as unknown;
    if (!commitmentConfig || typeof commitmentConfig !== "object") return;

    const configAny = commitmentConfig as Partial<FractionKeyCommitmentsV1>;
    if (configAny.scheme !== "sha256" || configAny.version !== 1) return;
    if (!configAny.byShareId || typeof configAny.byShareId !== "object") return;

    const byShareId = configAny.byShareId as Record<string, unknown>;
    const encoder = new TextEncoder();
    const seenIds = new Set<number>();

    for (const key of params.fractionKeys) {
        const trimmed = key.trim();
        const info = parseFractionKeyShareInfo(trimmed);
        if (seenIds.has(info.id)) {
            throw new Error("Fraction Keys must be unique. Duplicates are not allowed.");
        }
        seenIds.add(info.id);

        const expectedRaw = byShareId[String(info.id)];
        const expected = typeof expectedRaw === "string" ? expectedRaw.trim().toLowerCase() : "";
        if (!expected) {
            throw new Error("Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.");
        }

        const actual = (await sha256Hex(encoder.encode(trimmed))).toLowerCase();
        if (actual !== expected) {
            throw new Error("Incorrect or mismatched Fraction Keys. Make sure all keys come from the same backup.");
        }
    }
}

function parseWrappedKeyV1(value: unknown): WrappedKeyV1 {
    if (!value || typeof value !== "object") {
        throw new Error("Invalid encrypted key format.");
    }
    const v = value as Record<string, unknown>;
    if (v["schema"] !== "bitxen-wrapped-key-v1") {
        throw new Error("Unsupported encrypted key schema.");
    }
    if (v["v"] !== 1) {
        throw new Error("Unsupported encrypted key version.");
    }
    if (v["alg"] !== "AES-GCM") {
        throw new Error("Unsupported encrypted key algorithm.");
    }
    if (typeof v["iv"] !== "string" || typeof v["cipherText"] !== "string" || typeof v["checksum"] !== "string") {
        throw new Error("Invalid encrypted key fields.");
    }
    return v as unknown as WrappedKeyV1;
}

const normB64 = (c: string) =>
    c.startsWith("data:") ? (c.split(",")[1] || "") : c;

export function useVaultEdit({

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
    const [stepError, setStepError] = useState<string | null>(null);
    const [isWarning, setIsWarning] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [paymentProgress, setPaymentProgress] = useState<number | null>(null);
    const [paymentPhase, setPaymentPhase] = useState<"confirm" | "upload" | "finalize" | null>(null);
    const [isSecurityAnswersVerified, setIsSecurityAnswersVerified] = useState(false);
    const [validSecurityAnswerIndexes, setValidSecurityAnswerIndexes] = useState<number[]>([]);
    const [isFractionKeysVerified, setIsFractionKeysVerified] = useState(false);
    const [verificationSuccess, setVerificationSuccess] = useState(false);
    const [isVerifyingVault, setIsVerifyingVault] = useState(false);
    const [isVerifyingQuestions, setIsVerifyingQuestions] = useState(false);
    const [isVerifyingFractionKeys, setIsVerifyingFractionKeys] = useState(false);
    const [decryptedVaultPayload, setDecryptedVaultPayload] = useState<VaultPayloadForEdit | null>(null);
    const [combinedKeyForAttachments, setCombinedKeyForAttachments] = useState<Uint8Array | null>(null);
    const [newerVersionAvailable, setNewerVersionAvailable] = useState(false);
    const [latestTxId, setLatestTxId] = useState<string | null>(null);
    const [hasPendingEdit, setHasPendingEdit] = useState(false);
    const [isStorageAutoDetected, setIsStorageAutoDetected] = useState(false);

    const { upload: arUpload, progress: arProgress, status: arStatus, phase: arPhase, isUploading: isArUploading, reset: resetArUpload } = useArweaveUpload();



    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const encryptedVaultRef = useRef<EncryptedVaultClient | null>(null);
    const isPqcVaultRef = useRef(false);
    const fractionKeyCommitmentsRef = useRef<unknown>(null);
    const envelopePayloadKeyRef = useRef<Uint8Array | null>(null);
    const hybridChainRef = useRef<ChainId | null>(null);
    const hybridContractDataIdRef = useRef<string | null>(null);
    const hybridContractEncryptedKeyRef = useRef<string | null>(null);
    const hybridContractSecretRef = useRef<string | null>(null);

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
        setCombinedKeyForAttachments(null);
        encryptedVaultRef.current = null;
        isPqcVaultRef.current = false;
        fractionKeyCommitmentsRef.current = null;
        envelopePayloadKeyRef.current = null;
        hybridChainRef.current = null;
        hybridContractDataIdRef.current = null;
        hybridContractEncryptedKeyRef.current = null;
        hybridContractSecretRef.current = null;
        setIsStorageAutoDetected(false);
        setPaymentProgress(null);
        setPaymentPhase(null);
        resetArUpload();
    }, [resetArUpload]);


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

    const handleWillDetailsChange = (field: "title" | "content", value: string) => {
        setFormState((prev) => ({
            ...prev,
            willDetails: {
                ...prev.willDetails,
                [field]: value,
            },
        }));
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
        setIsFractionKeysVerified(false);
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
        setIsSecurityAnswersVerified(false);
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

    const handleDocumentsChange = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files);
        const existingSize = formState.willDetails.existingDocuments.reduce((acc, doc) => acc + doc.size, 0);
        const pendingNewSize = formState.willDetails.newDocuments.reduce((acc, doc) => acc + doc.size, 0);
        const incomingSize = newFiles.reduce((acc, doc) => acc + doc.size, 0);
        const totalSize = existingSize + pendingNewSize + incomingSize;
        const MAX_SIZE = 1024 * 1024 * 1024;
        if (totalSize > MAX_SIZE) {
            setStepError("Total document size cannot exceed 1 GB.");
            return;
        }
        setFormState((prev) => ({
            ...prev,
            willDetails: {
                ...prev.willDetails,
                newDocuments: [...prev.willDetails.newDocuments, ...newFiles],
            },
        }));
        setStepError(null);
    };

    const removeNewDocument = (index: number) => {
        setFormState((prev) => ({
            ...prev,
            willDetails: {
                ...prev.willDetails,
                newDocuments: prev.willDetails.newDocuments.filter((_, i) => i !== index),
            },
        }));
    };

    const removeExistingDocument = (index: number) => {
        setFormState((prev) => ({
            ...prev,
            willDetails: {
                ...prev.willDetails,
                existingDocuments: prev.willDetails.existingDocuments.filter((_, i) => i !== index),
            },
        }));
    };

    const handleToggleEditSecurityQuestions = () => {
        setFormState((prev) => {
            const newIsEditing = !prev.isEditingSecurityQuestions;
            return {
                ...prev,
                isEditingSecurityQuestions: newIsEditing,
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
        setFormState((prev) => ({
            ...prev,
            editedSecurityQuestions: prev.securityQuestionAnswers.map((sq) => ({ ...sq })),
        }));
        setStepError(null);
        setFieldErrors({});
    };

    const handleCancelEditSecurityQuestions = () => {
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
                if (!key1.trim()) errors["fractionKeys.key1"] = "Please enter Fraction Key #1.";
                if (!key2.trim()) errors["fractionKeys.key2"] = "Please enter Fraction Key #2.";
                if (!key3.trim()) errors["fractionKeys.key3"] = "Please enter Fraction Key #3.";
                const fractionKeysArray = [key1.trim(), key2.trim(), key3.trim()];
                const duplicates = new Map<string, number[]>();
                fractionKeysArray.forEach((key) => {
                    if (key) {
                        const indices = fractionKeysArray.map((k, i) => k === key ? i : -1).filter(i => i !== -1);
                        if (indices.length > 1) duplicates.set(key, indices);
                    }
                });
                if (duplicates.size > 0) {
                    duplicates.forEach((indices) => {
                        indices.forEach((idx) => {
                            const keyName = `fractionKeys.key${idx + 1}`;
                            if (!errors[keyName]) errors[keyName] = "Each Fraction Key must be unique.";
                        });
                    });
                }
                setFieldErrors(errors);
                return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
            }
            case "securityQuestion": {
                if (formState.securityQuestionAnswers.length === 0) {
                    return "Questions not loaded.";
                }
                formState.securityQuestionAnswers.forEach((sq, idx) => {
                    if (!sq.answer.trim()) errors[`securityQuestionAnswers.${idx}.answer`] = "Please provide an answer.";
                });
                setFieldErrors(errors);
                return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
            }
            case "willDetails": {
                if (!formState.willDetails.title.trim()) errors["willDetails.title"] = "Title required.";
                if (!formState.willDetails.content.trim()) errors["willDetails.content"] = "Content required.";
                setFieldErrors(errors);
                return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
            }
            case "editSecurityQuestions": {
                if (formState.isEditingSecurityQuestions) {
                    if (formState.editedSecurityQuestions.length < 3) return "Min 3 questions required.";
                    formState.editedSecurityQuestions.forEach((sq, idx) => {
                        if (!sq.question.trim()) errors[`editedSecurityQuestions.${idx}.question`] = "Question required.";
                        if (!sq.answer.trim()) errors[`editedSecurityQuestions.${idx}.answer`] = "Answer required.";
                    });
                    setFieldErrors(errors);
                    return Object.keys(errors).length > 0 ? "FIELD_ERROR" : null;
                }
                return null;
            }
            default: return null;
        }
    };

    const loadSecurityQuestions = async (): Promise<boolean> => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setStepError(null);
        const maxRetries = 3;
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (abortController.signal.aborted) return false;
                const localVault = getVaultById(formState.vaultId);
                const arweaveTxId = localVault?.arweaveTxId;
                const response = await fetch("/api/vault/claim/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vaultId: formState.vaultId, arweaveTxId }),
                    signal: abortController.signal,
                });
                if (abortController.signal.aborted) return false;
                const responseText = await response.text();
                if (abortController.signal.aborted) return false;
                let data;
                try { data = responseText ? JSON.parse(responseText) : {}; }
                catch { throw new Error("Server returned an invalid response."); }
                if (response.ok && data.success) {
                    if (data.securityQuestions && Array.isArray(data.securityQuestions)) {
                        setFormState((prev) => ({
                            ...prev,
                            securityQuestionAnswers: data.securityQuestions.map((q: string) => ({
                                question: q,
                                answer: "",
                            })),
                        }));
                        setVerificationSuccess(true);
                        if (abortControllerRef.current === abortController) abortControllerRef.current = null;
                        return true;
                    } else throw new Error("No security questions found.");
                }
                if (response.status >= 400 && response.status < 500 && response.status !== 404) {
                    throw new Error(data?.error || "Issue loading security questions.");
                }
                lastError = new Error(data?.error || `Server error (${response.status})`);
                if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return false;
                lastError = error instanceof Error ? error : new Error(String(error));
                if (lastError.message.includes("Inheritance ID") || lastError.message.includes("not found")) break;
                if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
        const { message, isWarning } = getLocalVaultErrorMessage(formState.vaultId, lastError?.message || "Error loading questions.");
        setIsWarning(isWarning);
        setStepError(message);
        if (abortControllerRef.current === abortController) abortControllerRef.current = null;
        return false;
    };

    const loadExistingWillDetails = useCallback(async (): Promise<boolean> => {
        setIsVerifyingFractionKeys(true);
        setStepError(null);
        try {
            const response = await fetch("/api/vault/claim/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vaultId: formState.vaultId,
                    fractionKeys: {
                        key1: formState.fractionKeys.key1,
                        key2: formState.fractionKeys.key2,
                        key3: formState.fractionKeys.key3,
                    },
                    securityQuestionAnswers: formState.securityQuestionAnswers,
                    arweaveTxId: getVaultById(formState.vaultId)?.arweaveTxId,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                setIsSecurityAnswersVerified(false);
                setIsFractionKeysVerified(false);
                const errorMessage = typeof data.error === "string" ? data.error : "Retrieval failed.";
                if (response.status === 403) {
                    setCurrentStep(0);
                    setStepError(errorMessage);
                    return false;
                }
                if (response.status === 401) {
                    const idx = editSteps.findIndex((s) => s.key === "securityQuestion");
                    if (idx !== -1) setCurrentStep(idx);
                    setStepError(errorMessage);
                    return false;
                }
                const errorLower = errorMessage.toLowerCase();
                if (errorLower.includes("fraction") || errorLower.includes("key")) {
                    const idx = editSteps.findIndex((s) => s.key === "fractionKeys");
                    if (idx !== -1) setCurrentStep(idx);
                }
                setStepError(errorMessage);
                return false;
            }
            const fractionKeysArray = [
                formState.fractionKeys.key1,
                formState.fractionKeys.key2,
                formState.fractionKeys.key3,
            ].filter((v) => v.trim() !== "");
            await verifyFractionKeyCommitmentsIfPresent({ metadata: data.metadata, fractionKeys: fractionKeysArray });
            fractionKeyCommitmentsRef.current = data.metadata?.fractionKeyCommitments || null;
            const combinedKey = combineSharesClient(fractionKeysArray);
            const encTemp = data.encryptedVault as EncryptedVaultClient | undefined;
            isPqcVaultRef.current = data.legacy?.isPqcEnabled === true || data.metadata?.isPqcEnabled === true || (!!encTemp?.pqcCipherText);
            if (encTemp) {
                encryptedVaultRef.current = encTemp;
                const vaultKey = await deriveEffectiveAesKeyClient(encTemp, combinedKey);
                setCombinedKeyForAttachments(vaultKey);
            } else {
                encryptedVaultRef.current = null;
                setCombinedKeyForAttachments(combinedKey);
            }
            let decrypted: VaultPayloadForEdit;
            if (encTemp?.keyMode === "envelope") {
                const vaultKey = encTemp ? await deriveEffectiveAesKeyClient(encTemp, combinedKey) : combinedKey;
                const metadataEncKey = typeof data.metadata?.contractEncryptedKey === "string" ? data.metadata.contractEncryptedKey : null;
                if (!metadataEncKey) throw new Error("Hybrid key missing.");
                hybridContractEncryptedKeyRef.current = metadataEncKey;
                const wrappedKey = parseWrappedKeyV1(JSON.parse(metadataEncKey));
                const localVault = getVaultById(formState.vaultId);
                let contractSecret = typeof data.releaseEntropy === "string" ? data.releaseEntropy : null;

                // If not in API response, try direct blockchain fetch (since we don't store it in metadata anymore)
                if (!contractSecret && (data.metadata?.contractDataId || localVault?.contractDataId)) {
                    try {
                        const targetDataId = (data.metadata?.contractDataId || localVault?.contractDataId) as string;
                        const metaChain = data.metadata?.blockchainChain as ChainId | undefined;
                        const targetChain = metaChain ?? (localVault?.blockchainChain as ChainId) ?? DEFAULT_CHAIN as ChainId;
                        const targetAddr = data.metadata?.contractAddress ?? localVault?.contractAddress ?? CHAIN_CONFIG[targetChain].contractAddress;

                        const blockchainRecord = await readBitxenDataRecord({
                            chainId: targetChain,
                            contractDataId: targetDataId,
                            contractAddress: targetAddr
                        });

                        if (blockchainRecord.releaseEntropy && blockchainRecord.releaseEntropy !== "0x" + "0".repeat(64)) {
                            contractSecret = blockchainRecord.releaseEntropy;
                        }
                    } catch (e) {
                        console.warn("Could not fetch secret from blockchain during edit initialization", e);
                    }
                }

                hybridContractSecretRef.current = contractSecret;
                let unwrappingKey = vaultKey;
                if (contractSecret) {
                    const metaChain = data.metadata?.blockchainChain as ChainId | undefined;
                    const localVault = getVaultById(formState.vaultId);
                    const resChain = metaChain ?? (localVault?.blockchainChain as ChainId) ?? DEFAULT_CHAIN as ChainId;
                    const resAddr = data.metadata?.contractAddress ?? localVault?.contractAddress ?? CHAIN_CONFIG[resChain].contractAddress;
                    unwrappingKey = await deriveUnlockKey(vaultKey, contractSecret, { contractAddress: resAddr, chainId: CHAIN_CONFIG[resChain].chainId });
                }
                const payloadKey = await unwrapKeyClient(wrappedKey, unwrappingKey);
                envelopePayloadKeyRef.current = payloadKey;
                decrypted = (data.decryptedVault ? data.decryptedVault : await decryptVaultPayloadRawKeyClient(encTemp, payloadKey)) as VaultPayloadForEdit;
            } else {
                envelopePayloadKeyRef.current = null;
                decrypted = (data.decryptedVault ? data.decryptedVault : await decryptVaultPayloadClient(encTemp as EncryptedVaultClient, combinedKey)) as VaultPayloadForEdit;
            }
            setDecryptedVaultPayload(decrypted);
            const willType = data.metadata?.willType || decrypted.willDetails?.willType;
            if (willType === "one-time") {
                setIsSecurityAnswersVerified(false);
                setIsFractionKeysVerified(false);
                setCurrentStep(0);
                setStepError("Vault is One-Time and cannot be edited.");
                return false;
            }
            const localVault = getVaultById(formState.vaultId);
            const detectedStorage: "arweave" | "bitxenArweave" = (!!data.metadata?.blockchainChain || !!data.metadata?.contractEncryptedKey || localVault?.storageType === "bitxenArweave" || localVault?.contractDataId?.startsWith("0x")) ? "bitxenArweave" : "arweave";
            setIsStorageAutoDetected(true);
            setFormState((prev) => ({
                ...prev,
                storageType: detectedStorage,
                payment: {
                    ...prev.payment,
                    paymentMethod: detectedStorage === "bitxenArweave" ? "metamask" : "wander",
                    selectedChain: detectedStorage === "bitxenArweave" ? (data.metadata?.blockchainChain || localVault?.blockchainChain || prev.payment.selectedChain) : prev.payment.selectedChain,
                },
                willDetails: {
                    title: decrypted.willDetails?.title ?? "",
                    content: decrypted.willDetails?.content ?? "",
                    existingDocuments: (decrypted.willDetails?.documents ?? []).map((doc, sourceIndex) => ({
                        sourceIndex,
                        name: doc.name || "",
                        size: doc.size || 0,
                        type: doc.type || "application/octet-stream",
                    })),
                    newDocuments: prev.willDetails.newDocuments,
                },
            }));
            setIsSecurityAnswersVerified(true);
            setIsFractionKeysVerified(true);
            return true;
        } catch (err) {
            setIsSecurityAnswersVerified(false);
            setIsFractionKeysVerified(false);
            setStepError(err instanceof Error ? err.message : "Unlock failed.");
            return false;
        } finally { setIsVerifyingFractionKeys(false); }
    }, [formState.vaultId, formState.fractionKeys, formState.securityQuestionAnswers]);

    useEffect(() => {
        if (initialData && open && isInitializing && formState.vaultId === initialData.vaultId) {
            loadExistingWillDetails().finally(() => setIsInitializing(false));
        }
    }, [initialData, open, isInitializing, formState.vaultId, loadExistingWillDetails]);

    // Rest of state initialization for when initialData provided
    useEffect(() => {
        if (initialData && open) {
            setIsInitializing(true);
            setFormState((prev) => ({
                ...prev,
                vaultId: initialData.vaultId,
                fractionKeys: { key1: initialData.fractionKeys[0] || "", key2: initialData.fractionKeys[1] || "", key3: initialData.fractionKeys[2] || "" },
                securityQuestionAnswers: initialData.securityQuestionAnswers,
            }));
            setVerificationSuccess(true);
            setIsSecurityAnswersVerified(true);
            setIsFractionKeysVerified(true);
            const idx = editSteps.findIndex((s) => s.key === "willDetails");
            if (idx !== -1) setCurrentStep(idx);
        }
    }, [initialData, open]);

    const submitEdit = async (overrides?: { storageType?: "arweave" | "bitxenArweave"; selectedChain?: ChainId }) => {
        setIsSubmitting(true);
        setStepError(null);
        try {
            const readFile = async (f: File): Promise<string> => new Promise((res, rej) => {

                const r = new FileReader();
                r.onload = () => res(normB64(typeof r.result === "string" ? r.result : ""));
                r.onerror = () => rej(r.error);
                r.readAsDataURL(f);
            });
            const MAX_INLINE = 5 * 1024 * 1024;
            const fKeys = [formState.fractionKeys.key1, formState.fractionKeys.key2, formState.fractionKeys.key3].filter(k => !!k.trim());
            const cKey = combineSharesClient(fKeys);
            const encTemp = encryptedVaultRef.current;
            const eKey = encTemp ? await deriveEffectiveAesKeyClient(encTemp, cKey) : cKey;
            const newDocs: any[] = [];
            for (const doc of formState.willDetails.newDocuments) {
                if (doc.size > MAX_INLINE) {
                    const { encryptBytesClient } = await import("@/lib/clientVaultCrypto");
                    const enc = await encryptBytesClient(await doc.arrayBuffer(), eKey);
                    const tags = { "Content-Type": doc.type, Type: "att", "Doc-Name": doc.name };
                    const res = await arUpload(enc.cipherBytes, formState.vaultId, tags);
                    newDocs.push({ name: doc.name, size: doc.size, type: doc.type, attachment: { txId: res.txId, iv: enc.iv, checksum: enc.checksum } });
                } else {
                    newDocs.push({ name: doc.name, size: doc.size, type: doc.type, content: await readFile(doc) });
                }
            }

            const bPayload = decryptedVaultPayload!;
            const bDocs = bPayload.willDetails?.documents ?? [];
            const exDocs = formState.willDetails.existingDocuments.map(d => {
                const st = bDocs[d.sourceIndex] as any;
                const base = { name: d.name, size: d.size, type: d.type };
                return st.content ? { ...base, content: st.content } : { ...base, attachment: st.attachment };
            });
            const nextQ = formState.isEditingSecurityQuestions ? formState.editedSecurityQuestions : bPayload.securityQuestions!;
            const qHashes = await Promise.all(nextQ.map(async v => ({ question: v.question, answerHash: await hashSecurityAnswerClient(v.answer) })));
            const metadata = {
                trigger: bPayload.triggerRelease, beneficiaryCount: 0, securityQuestionHashes: qHashes, fractionKeyCommitments: fractionKeyCommitmentsRef.current, willType: "editable",
                contractEncryptedKey: hybridContractEncryptedKeyRef.current, blockchainChain: hybridChainRef.current, encryptionVersion: envelopePayloadKeyRef.current ? "v3-envelope" : "v2-client",
            };
            const encV = await encryptVaultPayloadClient({ ...bPayload, willDetails: { ...bPayload.willDetails, title: formState.willDetails.title, content: formState.willDetails.content, documents: [...exDocs, ...newDocs] }, securityQuestions: nextQ }, envelopePayloadKeyRef.current ?? eKey);
            if (encTemp?.pqcCipherText) encV.pqcCipherText = encTemp.pqcCipherText;
            if (envelopePayloadKeyRef.current) encV.keyMode = "envelope";
            const arPayload = await prepareArweavePayloadClient({ vaultId: formState.vaultId, encryptedVault: encV, metadata });
            const effStorage = overrides?.storageType ?? formState.storageType;
            let txId: string;
            let bTxHash: string | undefined;
            let bChain: string | undefined;
            if (effStorage === "bitxenArweave") {
                const { dispatchHybrid } = await import("@/lib/metamaskWallet");
                const hRes = await dispatchHybrid(arPayload, formState.vaultId, (overrides?.selectedChain ?? formState.payment.selectedChain ?? DEFAULT_CHAIN) as ChainId, { onProgress: setPaymentStatus, onUploadProgress: setPaymentProgress });
                txId = hRes.arweaveTxId; bTxHash = hRes.contractTxHash; bChain = overrides?.selectedChain ?? formState.payment.selectedChain ?? DEFAULT_CHAIN;
                hybridContractDataIdRef.current = hRes.contractDataId;
            } else {
                const res = await arUpload(arPayload, formState.vaultId);
                txId = res.txId;
            }

            updateVaultTxId(formState.vaultId, txId, { storageType: effStorage, blockchainTxHash: bTxHash, blockchainChain: bChain, contractDataId: hybridContractDataIdRef.current || undefined });
            setLatestTxId(txId);
            onResult?.({ status: "success", data: { success: true, vaultId: formState.vaultId, message: "Updated.", arweaveTxId: effStorage === "arweave" ? txId : null, blockchainTxHash: bTxHash, blockchainChain: bChain, storageType: effStorage } });
            const sIdx = editSteps.findIndex(s => s.key === "success");
            if (sIdx !== -1) setCurrentStep(sIdx);
            else onOpenChange?.(false);
        } catch (err) {
            setStepError(err instanceof Error ? err.message : "Edit failed.");
            onResult?.({ status: "error", message: err instanceof Error ? err.message : "Edit failed." });
        } finally { setIsSubmitting(false); }
    };

    const handleUnifiedPayment = async (mode: PaymentMode, chainId?: ChainId) => {
        setIsProcessingPayment(true);
        const effStorage = mode === "wander" ? "arweave" : "bitxenArweave";
        setFormState(prev => ({ ...prev, storageType: effStorage, payment: { ...prev.payment, selectedChain: chainId || prev.payment.selectedChain } }));
        await submitEdit({ storageType: effStorage, selectedChain: chainId });
        setIsProcessingPayment(false);
    };

    const validateSecurityQuestions = async (): Promise<boolean> => {
        setIsVerifyingQuestions(true);
        setStepError(null);
        try {
            const result = await validateSecurityQuestionsApi({ vaultId: formState.vaultId, securityQuestionAnswers: formState.securityQuestionAnswers });
            if (!result.success) {
                if (result.correctIndexes) setValidSecurityAnswerIndexes(result.correctIndexes);
                const msg = result.error || "Mismatched answers.";
                if (result.incorrectIndexes) setFieldErrors(generateSecurityQuestionFieldErrors(formState.securityQuestionAnswers.length, msg, result.incorrectIndexes));
                else setStepError(msg);
                return false;
            }
            setIsSecurityAnswersVerified(true);
            return true;
        } catch (err) { setStepError("Validation failed."); return false; }
        finally { setIsVerifyingQuestions(false); }
    };

    const handleNext = async () => {
        setStepError(null);
        setFieldErrors({});
        const error = validateStep(currentStep);
        if (error && error !== "FIELD_ERROR") { setStepError(error); return; }
        if (error === "FIELD_ERROR") return;

        if (editSteps[currentStep].key === "vaultId") {
            if (!verificationSuccess) {
                setIsVerifyingVault(true);
                try {
                    const res = await fetch("/api/vault/claim/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vaultId: formState.vaultId }) });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.success) { setStepError(data.error || "Vault not found."); return; }
                    if (data.willType === "one-time") { setStepError("One-Time vaults cannot be edited."); return; }
                    if (data.latestTxId) {
                        setLatestTxId(data.latestTxId);
                        const lv = getVaultById(formState.vaultId);
                        if (lv && lv.arweaveTxId !== data.latestTxId) {
                            setNewerVersionAvailable(true);
                            if (lv.status === "pending") setHasPendingEdit(true);
                        }
                    }
                    const ok = await loadSecurityQuestions();
                    if (!ok) return;
                } finally { setIsVerifyingVault(false); }
            }
        }

        if (editSteps[currentStep].key === "securityQuestion" && !isSecurityAnswersVerified) {
            const ok = await validateSecurityQuestions();
            if (!ok) return;
        }

        if (editSteps[currentStep].key === "fractionKeys" && !isFractionKeysVerified) {
            if (formState.securityQuestionAnswers.every(s => !!s.answer.trim())) {
                const ok = await loadExistingWillDetails();
                if (!ok) return;
            }
        }

        if (editSteps[currentStep].key === "payment" || editSteps[currentStep].key === "storageSelection") return;

        const nextIdx = currentStep + 1;
        if (editSteps[nextIdx]?.key === "storageSelection" && isStorageAutoDetected) setCurrentStep(nextIdx + 1);
        else setCurrentStep(Math.min(nextIdx, editSteps.length - 1));
    };

    const handlePrev = () => {
        if (currentStep === 0) return;
        const prevIdx = currentStep - 1;
        if (editSteps[prevIdx]?.key === "storageSelection" && isStorageAutoDetected) setCurrentStep(prevIdx - 1);
        else setCurrentStep(prevIdx);
    };

    const downloadDocument = async (idx: number) => {
        try {
            const doc = formState.willDetails.existingDocuments[idx];
            const stored = decryptedVaultPayload?.willDetails?.documents?.[doc.sourceIndex] as any;
            let blob: Blob;
            if (stored.content) {
                const b64 = normB64(stored.content);
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                blob = new Blob([bytes], { type: doc.type });
            } else {
                const res = await fetch(`https://arweave.net/${stored.attachment.txId}`);
                const buf = await res.arrayBuffer();
                const { decryptBytesClient } = await import("@/lib/clientVaultCrypto");
                const plain = await decryptBytesClient({ cipherBytes: buf, iv: stored.attachment.iv, checksum: stored.attachment.checksum }, combinedKeyForAttachments!);
                blob = new Blob([plain as any], { type: doc.type });
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = doc.name; a.click();
        } catch (e) { setStepError("Download failed."); }
    };

    return {
        formState, currentStep, stepError, isWarning, fieldErrors, isSubmitting, isVerifyingVault, isVerifyingQuestions, isVerifyingFractionKeys,
        isProcessingPayment, paymentStatus, paymentProgress, paymentPhase, isSecurityAnswersVerified, validSecurityAnswerIndexes, isFractionKeysVerified,
        verificationSuccess, decryptedVaultPayload, combinedKeyForAttachments, newerVersionAvailable, latestTxId, hasPendingEdit, isStorageAutoDetected,
        isInitializing, isDialog, textareaRef,
        handleVaultIdChange, handleWillDetailsChange, handleFractionKeyChange, handleSecurityAnswerChange, handleDocumentsChange,
        removeNewDocument, removeExistingDocument, handleToggleEditSecurityQuestions, handleAddSecurityQuestion, handleRemoveSecurityQuestion,
        handleEditSecurityQuestionChange, handleResetSecurityQuestions, handleCancelEditSecurityQuestions, handleNext, handlePrev, handleUnifiedPayment,
        downloadDocument, adjustTextareaHeight
    };
}

