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

    try {
      const text = await file.text();
      const data = parseBackupFile(text);
      setBackupData(data);

      // Fetch security questions
      await loadSecurityQuestions(data.vaultId);
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

  const loadSecurityQuestions = async (vaultId: string) => {
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
      throw new Error(message || `Failed to load security questions (HTTP ${response.status}).`);
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
              <Button onClick={handleVerify} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
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
