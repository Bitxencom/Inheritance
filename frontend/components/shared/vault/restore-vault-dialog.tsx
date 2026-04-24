"use client";

import { useState, useRef, ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Edit, Loader2 } from "lucide-react";
import { parseBackupFile, BackupData } from "@/lib/backup";
import {
  SecurityQuestionsField,
  validateSecurityQuestionsApi,
  generateSecurityQuestionFieldErrors
} from "@/components/assistant-ui/tools/shared";
import { getVaultById } from "@/lib/vault-storage";
import { AlertMessage } from "@/components/ui/alert-message";
import { cn } from "@/lib/utils";
import { readBitxenDataIdByHash, getAvailableChains, ChainId } from "@/lib/metamaskWallet";
import { sha256Hex } from "@/lib/clientVaultCrypto";

interface RestoreVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenVault: (data: BackupData, securityAnswers: { question: string; answer: string }[]) => void;
  onEditVault: (data: BackupData, securityAnswers: { question: string; answer: string }[]) => void;
}

type Step = "upload" | "verification" | "action";

export function RestoreVaultDialog({
  open,
  onOpenChange,
  onOpenVault,
  onEditVault,
}: RestoreVaultDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [securityQuestions, setSecurityQuestions] = useState<{ question: string; answer: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  const [validIndexes, setValidIndexes] = useState<number[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [vaultType, setVaultType] = useState<string | null>(null);
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setBackupData(null);
    setSecurityQuestions([]);
    setError(null);
    setIsLoading(false);
    setFieldErrors({});
    setValidIndexes([]);
    setIsVerified(false);
    setVaultType(null);
    setIsPendingConfirmation(false);
    setReleaseError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setReleaseError(null);

    try {
      const text = await file.text();
      const data = parseBackupFile(text);
      setBackupData(data);

      // Check vault confirmation status
      const confirmationResult = await checkVaultConfirmation(data.vaultId);

      if (confirmationResult === true) {
        setError(`Vault ID ${data.vaultId} is still pending on blockchain storage. Please wait a few moments before trying again.`);
        return;
      }

      if (typeof confirmationResult === "string") {
        setReleaseError(confirmationResult);
        return;
      }

      // Load security questions only if vault is confirmed
      try {
        await loadSecurityQuestionsOnly(data.vaultId);
      } catch (err) {
        // If loading questions fails with blockchain storage error, 
        // it means the vault is actually pending
        const errorMessage = err instanceof Error ? err.message : "Failed to load security questions";
        
        if (errorMessage.toLowerCase().includes("not found on blockchain storage")) {
          setError(`Vault ID ${data.vaultId} is still pending on blockchain storage. Please wait a few moments before trying again.`);
          return;
        }
        
        // Re-throw other errors
        throw err;
      }

      setStep("verification");
    } catch (err) {
      const rawMessage =
        err instanceof Error ? err.message : "Failed to parse backup file";
      const looksLikePath =
        !rawMessage.includes("\n") &&
        (rawMessage.includes("/") || rawMessage.includes("\\")) &&
        /\.txt$/i.test(rawMessage);
      setError(
        looksLikePath
          ? `Failed to read backup file "${file.name}". Please re-download the backup and try again.`
          : rawMessage,
      );
    } finally {
      setIsLoading(false);
      // Reset input value to allow selecting same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const checkVaultConfirmation = async (vaultId: string): Promise<boolean | string> => {
    const localVault = getVaultById(vaultId);
    const arweaveTxId = localVault?.arweaveTxId;
    
    let lastSuccessfulData: CheckClaimResponse | null = null;

    type CheckClaimResponse = {
      success?: boolean;
      error?: string;
      isConfirmed?: boolean;
      willType?: string;
      trigger?: { triggerType: string; triggerDate?: string };
      latestTxId?: string;
      isHybrid?: boolean;
      message?: string;
    };

    // Single API call to check vault status (includes blockchain confirmation check)
    const response = await fetch("/api/vault/claim/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId, arweaveTxId }),
    });

    const raw = await response.text();
    const data: CheckClaimResponse = (() => {
      try {
        return JSON.parse(raw) as CheckClaimResponse;
      } catch {
        return {
          success: false,
          error: raw || `Non-JSON response (HTTP ${response.status})`,
        };
      }
    })();

    if (!response.ok || data.success !== true) {
      const message = (typeof data.error === "string" ? data.error.trim() : "") ||
        `Failed to check vault status (HTTP ${response.status}).`;
      
      if (message.toLowerCase().includes("not found on blockchain storage") || message.toLowerCase().includes("belum tersedia di gateway")) {
        setIsPendingConfirmation(true);
        return true;
      }

      // Backend returns 403 with trigger info when vault is not yet released
      if (response.status === 403 && data.trigger) {
        const { triggerType, triggerDate } = data.trigger as { triggerType: string; triggerDate?: string };
        if (triggerType === "date" && triggerDate) {
          const releaseDate = new Date(triggerDate);
          const formattedDate = releaseDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          return `This inheritance is not released yet. It is scheduled to become available on ${formattedDate}.`;
        }
        return message || "This inheritance is not released yet.";
      }

      throw new Error(message || `Failed to check vault status (HTTP ${response.status}).`);
    }

    // Check if vault is confirmed based on blockchain confirmation depth
    if (data.isConfirmed === false) {
      // Vault has insufficient confirmations
      const message = (typeof data.message === "string" ? data.message : "Vault has insufficient blockchain confirmations.");
      setIsPendingConfirmation(true);
      return true;
    }

    // Store successful data
    lastSuccessfulData = data;

    // API handles blockchain confirmation check, just set pending status based on isHybrid
    if (data.isHybrid) {
      setIsPendingConfirmation(false); // API confirmed it has sufficient confirmations
    } else {
      // Non-hybrid vault
      setIsPendingConfirmation(false);
    }

    // Check release date from API trigger info
    if (data.trigger?.triggerType === "date" && data.trigger.triggerDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const releaseDate = new Date(data.trigger.triggerDate);
      releaseDate.setHours(0, 0, 0, 0);
      if (today < releaseDate) {
        const formattedDate = releaseDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `This inheritance is not released yet. It is scheduled to become available on ${formattedDate}.`;
      }
    }

    return false;
  };

  const loadSecurityQuestionsOnly = async (vaultId: string): Promise<void> => {
    const localVault = getVaultById(vaultId);
    const arweaveTxId = localVault?.arweaveTxId;

    const response = await fetch("/api/vault/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId, arweaveTxId }),
    });

    type VerifyClaimResponse = {
      success?: boolean;
      error?: string;
      securityQuestions?: unknown;
      willType?: string;
      latestTxId?: string;
      trigger?: { triggerType: string; triggerDate?: string };
    };

    const raw = await response.text();
    const data: VerifyClaimResponse = (() => {
      try {
        return JSON.parse(raw) as VerifyClaimResponse;
      } catch {
        throw new Error(`Non-JSON response (HTTP ${response.status})`);
      }
    })();

    if (!response.ok || data.success !== true) {
      throw new Error(`Failed to load security questions (HTTP ${response.status})`);
    }

    if (data.willType) {
      setVaultType(data.willType);
    }

    if (Array.isArray(data.securityQuestions)) {
      setSecurityQuestions(
        data.securityQuestions.map((q: string) => ({ question: q, answer: "" }))
      );
    } else {
      throw new Error("No security questions found for this vault.");
    }
  };

  const loadSecurityQuestions = async (vaultId: string): Promise<boolean | string> => {
    const localVault = getVaultById(vaultId);
    const arweaveTxId = localVault?.arweaveTxId;

    const response = await fetch("/api/vault/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultId, arweaveTxId }),
    });

    type VerifyClaimResponse = {
      success?: boolean;
      error?: string;
      securityQuestions?: unknown;
      willType?: string;
      latestTxId?: string;
      trigger?: { triggerType: string; triggerDate?: string };
    };

    const raw = await response.text();
    const data: VerifyClaimResponse = (() => {
      try {
        return JSON.parse(raw) as VerifyClaimResponse;
      } catch {
        return {
          success: false,
          error: raw || `Non-JSON response (HTTP ${response.status})`,
        };
      }
    })();

    if (!response.ok || data.success !== true) {
      const message = (typeof data.error === "string" ? data.error.trim() : "") ||
        `Failed to load security questions (HTTP ${response.status}).`;

      if (message.toLowerCase().includes("not found on blockchain storage") || message.toLowerCase().includes("belum tersedia di gateway")) {
        setIsPendingConfirmation(true);
        return true;
      }

      // Backend returns 403 with trigger info when vault is not yet released
      if (response.status === 403 && data.trigger) {
        const { triggerType, triggerDate } = data.trigger as { triggerType: string; triggerDate?: string };
        if (triggerType === "date" && triggerDate) {
          const releaseDate = new Date(triggerDate);
          const formattedDate = releaseDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          return `This inheritance is not released yet. It is scheduled to become available on ${formattedDate}.`;
        }
        return message || "This inheritance is not released yet.";
      }

      throw new Error(message || `Failed to load security questions (HTTP ${response.status}).`);
    }

    // EARLY BLOCKCHAIN CHECK
    const txIdToCheck = data.latestTxId || arweaveTxId;
    if (txIdToCheck) {
      try {
        const payloadText = await fetch(`https://arweave.net/${txIdToCheck}`).then(r => r.ok ? r.text() : null);
        if (payloadText) {
          let isHybrid = true;
          try {
            const payloadJson = JSON.parse(payloadText);
            const metadata = payloadJson?.metadata || {};
            isHybrid = !!(metadata.blockchainChain || metadata.contractAddress || metadata.contractEncryptedKey);
          } catch (e) {
            // Ignore JSON parse errors, fallback to hybrid
          }

          if (!isHybrid) {
            setIsPendingConfirmation(false);
          } else {
            const payloadBuffer = new TextEncoder().encode(payloadText);
            const dataHashRaw = await sha256Hex(payloadBuffer);
            const dataHash = "0x" + dataHashRaw;

            let isConfirmed = false;
            const chains = getAvailableChains();
            outer: for (const chainKey of chains) {
              for (let v = 1; v <= 5; v++) {
                try {
                  const id = await readBitxenDataIdByHash({
                    chainId: chainKey as ChainId,
                    dataHash,
                    version: BigInt(v),
                  });
                  if (id && id !== "0x" + "0".repeat(64)) {
                    isConfirmed = true;
                    break outer;
                  }
                } catch {
                  // Ignore version not found
                }
              }
            }

            if (!isConfirmed) {
              setIsPendingConfirmation(true);
              return true;
            } else {
              setIsPendingConfirmation(false);
            }
          }
        }
      } catch (err) {
        setIsPendingConfirmation(false);
        // ignore fetch failures, assume it might be valid
      }
    } else {
      setIsPendingConfirmation(false);
    }

    if (data.willType) {
      setVaultType(data.willType);
    }

    if (Array.isArray(data.securityQuestions)) {
      setSecurityQuestions(
        data.securityQuestions.map((q: string) => ({ question: q, answer: "" }))
      );
    } else {
      throw new Error("No security questions found for this vault.");
    }

    // Check release date from API trigger info
    if (data.trigger?.triggerType === "date" && data.trigger.triggerDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const releaseDate = new Date(data.trigger.triggerDate);
      releaseDate.setHours(0, 0, 0, 0);
      if (today < releaseDate) {
        const formattedDate = releaseDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `This inheritance is not released yet. It is scheduled to become available on ${formattedDate}.`;
      }
    }

    return false;
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setSecurityQuestions((prev) =>
      prev.map((sq, i) => (i === index ? { ...sq, answer } : sq))
    );
    // Clear field error
    if (fieldErrors[index]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
    if (error) setError(null);
    setIsVerified(false);
  };

  const handleVerify = async () => {
    if (!backupData) return;

    // Client-side empty check
    const errors: Record<number, string> = {};
    securityQuestions.forEach((sq, idx) => {
      if (!sq.answer.trim()) {
        errors[idx] = "Please provide an answer.";
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await validateSecurityQuestionsApi({
        vaultId: backupData.vaultId,
        securityQuestionAnswers: securityQuestions,
        arweaveTxId: getVaultById(backupData.vaultId)?.arweaveTxId,
      });

      if (!result.success) {
        const errorMessage = result.error || "Security question answers do not match.";

        if (result.correctIndexes && result.correctIndexes.length > 0) {
          setValidIndexes(result.correctIndexes);
        }

        if (errorMessage === "Security question answers do not match.") {
          const stringErrors = generateSecurityQuestionFieldErrors(
            securityQuestions.length,
            errorMessage,
            result.incorrectIndexes
          );
          // Convert string keys to numeric keys for SecurityQuestionsField
          const numericErrors: Record<number, string> = {};
          for (const [key, value] of Object.entries(stringErrors)) {
            const match = key.match(/securityQuestionAnswers\.(\d+)\.answer/);
            if (match) {
              numericErrors[parseInt(match[1], 10)] = value;
            }
          }
          setFieldErrors(numericErrors);
        } else {
          setError(errorMessage);
        }
        return;
      }

      setIsVerified(true);
      setValidIndexes(securityQuestions.map((_, i) => i)); // All correct

      if (vaultType === "one-time") {
        onOpenVault(backupData, securityQuestions);
        handleOpenChange(false);
      } else {
        setStep("action");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: "open" | "edit") => {
    if (!backupData) return;

    if (action === "open") {
      onOpenVault(backupData, securityQuestions);
    } else {
      onEditVault(backupData, securityQuestions);
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Open Inheritance</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload your backup file to restore access to your vault."}
            {step === "verification" && "Answer the security questions to verify your identity."}
            {step === "action" && "Security questions passed. Choose an action."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <AlertMessage
            variant="error"
            showHeader
            message={error}
            className="mb-4"
          />
          <AlertMessage
            variant="warning"
            showHeader
            message={releaseError}
            className="mb-4"
          />

          {step === "upload" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              {isLoading ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              )}
              <h3 className="text-lg font-semibold mb-1">
                {isLoading ? "Checking..." : "Click to Upload Backup"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Select your vault backup (.txt) file
              </p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </div>
          )}

          {step === "verification" && (
            <div className="space-y-4">
              <div className="border rounded-md p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-mono mb-1">INHERITANCE ID</p>
                <p className="font-mono text-sm break-all">{backupData?.vaultId}</p>
              </div>

              <SecurityQuestionsField
                questions={securityQuestions}
                onAnswerChange={handleAnswerChange}
                isVerified={isVerified}
                isLoading={isLoading}
                errors={fieldErrors} // Pass converted field errors
                validIndexes={validIndexes}
                onEnterPress={handleVerify}
              />
            </div>
          )}

          {step === "action" && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all group"
                onClick={() => handleAction("open")}
              >
                {/* <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Eye className="h-6 w-6" />
                </div> */}
                <div className="space-y-1">
                  <span className="font-semibold text-lg block">Open Vault</span>
                  <span className="text-xs text-muted-foreground block font-normal">View contents</span>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all group"
                onClick={() => handleAction("edit")}
              >
                {/* <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Edit className="h-6 w-6" />
                </div> */}
                <div className="space-y-1">
                  <span className="font-semibold text-lg block">Edit Vault</span>
                  <span className="text-xs text-muted-foreground block font-normal">Modify contents</span>
                </div>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className={step === "action" ? "hidden" : ""}>
          {step === "verification" && (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => resetState()} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleVerify} disabled={isLoading || isPendingConfirmation}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          )}
          {step === "upload" && (
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
