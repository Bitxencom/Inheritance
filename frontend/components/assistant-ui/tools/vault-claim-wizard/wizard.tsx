"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Search, CircleDashed, FileText, Download, ShieldAlert, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Stepper } from "@/components/shared/stepper";
import {
  InheritanceIdField,
  SecurityQuestionsField,
  FractionKeysField,
} from "@/components/assistant-ui/tools/shared";

import type { VaultClaimWizardProps } from "./types";
import { claimSteps } from "./constants";
import { useVaultClaim } from "./hooks/use-vault-claim";

const OnChainReleasePayment = ({
  requiresFinalization,
  isFinalizing,
  handleFinalize,
  releaseEntropy,
}: {
  requiresFinalization: boolean;
  isFinalizing: boolean;
  handleFinalize: () => void;
  releaseEntropy: string | null;
}) => {
  if (!requiresFinalization && !isFinalizing && !releaseEntropy) return null;

  if (releaseEntropy && !requiresFinalization) {
    return (
      <div className="rounded-lg px-4 py-4 border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-md font-semibold text-green-700 dark:text-green-300">
              Blockchain Activated
            </p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">
              Final decryption key obtained. Processing unlock...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-4 py-4 border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <ShieldAlert className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-md font-semibold text-blue-700 dark:text-blue-300">
            Step Required: On-Chain Release
          </p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
            Blockchain release is required to finalize the inheritance
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        The release date has arrived, but the inheritance must be released on the blockchain before it can be decrypted.
        This is a one-time finalization step that requires a MetaMask transaction to obtain the final decryption keys.
      </p>
    </div>
  );
}

const Unlock = ({
  triggerRelease,
  isReleaseDatePassed,
  formState,
  handleNext,
  requiresFinalization,
  isFinalizing,
  handleFinalize,
  releaseEntropy,
}: {
  triggerRelease: any;
  isReleaseDatePassed: boolean;
  formState: any;
  handleNext: () => void;
  requiresFinalization: boolean;
  isFinalizing: boolean;
  handleFinalize: () => void;
  releaseEntropy: string | null;
}) => {
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
      const releaseDate = new Date(triggerDate);
      const formattedDate = releaseDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (isReleaseDatePassed) {
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

      {
        requiresFinalization ? (
          <OnChainReleasePayment
            requiresFinalization={requiresFinalization}
            isFinalizing={isFinalizing}
            handleFinalize={handleFinalize}
            releaseEntropy={releaseEntropy}
          />
        ) : (
          <div className={`rounded-lg border px-4 py-3 text-sm ${borderColor}`}>
            <p className={`font-medium ${textColor}`}>
              {triggerMsg.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {triggerMsg.message}
            </p>
          </div>
        )
      }

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
          {formState.securityQuestionAnswers.map((sq: { question: string }, index: number) => (
            <li key={index}>{sq.question}</li>
          ))}
        </ul>
      </div>

    </div>
  );
}

export function VaultClaimWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
  initialData,
}: VaultClaimWizardProps) {
  const {
    formState, currentStep, stepError, isWarning, fieldErrors, isSubmitting, isVerifying,
    isVerifyingFractionKeys,
    unlockProgress, unlockStep, securityQuestions, verificationSuccess, isSecurityAnswersVerified,
    validSecurityAnswerIndexes, isFractionKeysVerified, triggerRelease, unlockedDocuments,
    unlockedDecryptedDocuments, vaultTitle, newerVersionAvailable, latestTxId, hasPendingEdit,
    releaseEntropy, cleanedUnlockProgress, cleanedUnlockStep, progressTitle, progressSubtitle,
    showFullLoading, isDialog, formatBytes, requiresFinalization, isFinalizing, isReadyToUnlock, isReleaseDatePassed,
    handleVaultIdChange, handleSecurityAnswerChange, handleFractionKeyChange,
    handleNext, handlePrev, handleReset, handleDownload, downloadDocument,
    handleFinalize
  } = useVaultClaim({ variant, open, onOpenChange, onStepChange, onResult, initialData });

  const visibleSteps = claimSteps;

  const currentVisibleStepIndex = currentStep;

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
        return (
          <Unlock
            triggerRelease={triggerRelease}
            isReleaseDatePassed={isReleaseDatePassed}
            formState={formState}
            handleNext={handleNext}
            requiresFinalization={requiresFinalization}
            isFinalizing={isFinalizing}
            handleFinalize={handleFinalize}
            releaseEntropy={releaseEntropy}
          />
        )

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
      return (
        <div className="flex items-center gap-2">
          <CircleDashed className="size-4 animate-spin" />
          <span>{progressTitle}</span>
        </div>
      );
    }

    if (isFinalizing) {
      return (
        <div className="flex items-center gap-2" id="is-finalizing-btn-content">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing Payment...
        </div>
      );
    }

    if (isVerifying || isVerifyingFractionKeys) {
      return (
        <div className="flex items-center gap-2">
          <CircleDashed className="size-4 animate-spin" />
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
        if (requiresFinalization) {
          return (
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center rounded-full bg-orange-50 p-1 mr-2 h-6 w-6 shrink-0">
                <Image
                  src="/metamask-fox.svg"
                  alt="MetaMask"
                  width={18}
                  height={18}
                  className="w-4 h-4 object-contain"
                />
              </div>
              Open & Pay with MetaMask
            </div>
          );
        }
        return "Open Inheritance";

      case "success":
        return "Close";

      default:
        return "Next";
    }
  })();

  const content = showFullLoading ? (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-2 rounded-xl bg-background text-center">
      <CircleDashed className="h-10 w-10 animate-spin text-muted-foreground" />
      <p className="text-base font-medium">Processing...</p>
      <p className="text-sm text-muted-foreground">{progressSubtitle}</p>
    </div>
  ) : (
    <div className="space-y-6">
      <div className={initialData || claimSteps[currentStep].key === "success" ? "hidden" : ""}>
        <Stepper steps={visibleSteps} currentStep={currentVisibleStepIndex !== -1 ? currentVisibleStepIndex : 0} />
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

      {/* Progress Indicator */}
      {isSubmitting && unlockProgress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950 mb-4">
          <p className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <CircleDashed className="size-4 animate-spin" />
            {progressTitle}
          </p>
          {cleanedUnlockStep && (
            <p className="mt-1 text-xs text-muted-foreground">
              {cleanedUnlockStep}
            </p>
          )}
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
            (claimSteps[currentStep].key === "unlock" && (!isReadyToUnlock || isFinalizing))
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

