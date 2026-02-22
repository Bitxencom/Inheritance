"use client";

import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Copy,
  ExternalLink,
  AlertCircle,
  Search,
  CheckCircle2,
  X,
  FileText,
  Trash2,
  Upload,
  Download,
} from "lucide-react";
import { useVaultEdit } from "./hooks/use-vault-edit";
import { type VaultEditWizardProps } from "./types";
import { editSteps } from "./constants";
import { UnifiedPaymentSelector } from "@/components/shared/payment";
import { Stepper } from "@/components/shared/stepper";
import { AlertMessage } from "@/components/ui/alert-message";
import { FieldError } from "@/components/ui/field-error";
import { getChainConfig, type ChainId, DEFAULT_CHAIN } from "@/lib/chains";



export function VaultEditWizard(props: VaultEditWizardProps) {
  const {
    variant = "dialog",
    open = true,
    onOpenChange,
    onResult,
    initialData,
  } = props;

  const {
    formState,
    currentStep,
    stepError,
    isWarning,
    fieldErrors,
    isSubmitting,
    isVerifyingVault,
    isVerifyingQuestions,
    isVerifyingFractionKeys,
    isProcessingPayment,
    paymentStatus,
    paymentProgress,
    paymentPhase,
    isSecurityAnswersVerified,
    validSecurityAnswerIndexes,
    isFractionKeysVerified,
    verificationSuccess,
    latestTxId,
    hasPendingEdit,
    newerVersionAvailable,
    isStorageAutoDetected,
    isInitializing,
    isDialog,
    textareaRef,
    handleVaultIdChange,
    handleWillDetailsChange,
    handleFractionKeyChange,
    handleSecurityAnswerChange,
    handleDocumentsChange,
    removeNewDocument,
    removeExistingDocument,
    handleToggleEditSecurityQuestions,
    handleAddSecurityQuestion,
    handleRemoveSecurityQuestion,
    handleEditSecurityQuestionChange,
    handleResetSecurityQuestions,
    handleCancelEditSecurityQuestions,
    handleNext,
    handlePrev,
    handleUnifiedPayment,
    downloadDocument,
    adjustTextareaHeight,
  } = useVaultEdit(props);

  useEffect(() => {
    adjustTextareaHeight();
  }, [formState.willDetails.content, adjustTextareaHeight, currentStep]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // toast.success("Copied to clipboard");
  };


  const renderStepContent = () => {
    switch (editSteps[currentStep].key) {
      case "vaultId":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
              <p className="font-medium text-blue-700 dark:text-blue-300">
                Update Existing Inheritance
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your Inheritance ID to load and edit its content.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Inheritance ID</label>
              <div className="flex gap-2">
                <Input
                  value={formState.vaultId}
                  onChange={(e) => handleVaultIdChange(e.target.value)}
                  placeholder="e.g. will-12345678"
                  className={fieldErrors.vaultId ? "border-destructive" : ""}
                  disabled={verificationSuccess}
                />
                {verificationSuccess && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleVaultIdChange("")}
                    title="Change Vault ID"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              <FieldError message={fieldErrors.vaultId} />
            </div>

            {verificationSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="size-3" />
                Inheritance ID verified. You can proceed to the next step.
              </div>
            )}
          </div>
        );

      case "securityQuestion":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Security Verification
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please answer your security questions to authorize editing. These were set during creation.
              </p>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {formState.securityQuestionAnswers.map((sq, index) => (
                <div key={index} className="space-y-2">
                  <p className="text-sm font-medium">{sq.question}</p>
                  <div className="relative">
                    <Input
                      type="password"
                      value={sq.answer}
                      onChange={(e) => handleSecurityAnswerChange(index, e.target.value)}
                      placeholder="Your answer"
                      className={fieldErrors[`securityQuestionAnswers.${index}.answer`] ? "border-destructive" : ""}
                      disabled={isSecurityAnswersVerified}
                    />
                    {isSecurityAnswersVerified && (
                      <CheckCircle2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-500" />
                    )}
                    {validSecurityAnswerIndexes.includes(index) && !isSecurityAnswersVerified && (
                      <CheckCircle2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-500/50" />
                    )}
                  </div>
                  <FieldError message={fieldErrors[`securityQuestionAnswers.${index}.answer`]} />
                </div>
              ))}
            </div>
            {isSecurityAnswersVerified && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="size-3" />
                Security answers verified successfully.
              </div>
            )}
          </div>
        );

      case "fractionKeys":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Unlock Content
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Provide at least 3 Fraction Keys from your backup to unlock and decrypt the current content.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fraction Key #1</label>
                <Input
                  value={formState.fractionKeys.key1}
                  onChange={(e) => handleFractionKeyChange("key1", e.target.value)}
                  placeholder="Paste your first fraction key"
                  className={fieldErrors["fractionKeys.key1"] ? "border-destructive" : ""}
                  disabled={isFractionKeysVerified}
                />
                <FieldError message={fieldErrors["fractionKeys.key1"]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fraction Key #2</label>
                <Input
                  value={formState.fractionKeys.key2}
                  onChange={(e) => handleFractionKeyChange("key2", e.target.value)}
                  placeholder="Paste your second fraction key"
                  className={fieldErrors["fractionKeys.key2"] ? "border-destructive" : ""}
                  disabled={isFractionKeysVerified}
                />
                <FieldError message={fieldErrors["fractionKeys.key2"]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fraction Key #3</label>
                <Input
                  value={formState.fractionKeys.key3}
                  onChange={(e) => handleFractionKeyChange("key3", e.target.value)}
                  placeholder="Paste your third fraction key"
                  className={fieldErrors["fractionKeys.key3"] ? "border-destructive" : ""}
                  disabled={isFractionKeysVerified}
                />
                <FieldError message={fieldErrors["fractionKeys.key3"]} />
              </div>
            </div>
            {isFractionKeysVerified && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="size-3" />
                Content unlocked and decrypted successfully.
              </div>
            )}
          </div>
        );

      case "willDetails":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950">
              <p className="font-medium text-green-700 dark:text-green-300">
                Edit Content
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Modify the title, content, and documents for this inheritance.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formState.willDetails.title}
                onChange={(e) => handleWillDetailsChange("title", e.target.value)}
                placeholder="Title for your inheritance"
                className={fieldErrors["willDetails.title"] ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors["willDetails.title"]} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content / Message</label>
              <Textarea
                ref={textareaRef}
                value={formState.willDetails.content}
                onChange={(e) => handleWillDetailsChange("content", e.target.value)}
                placeholder="Enter the secure content or message..."
                className={`min-h-[150px] resize-none overflow-hidden ${fieldErrors["willDetails.content"] ? "border-destructive" : ""}`}
              />
              <FieldError message={fieldErrors["willDetails.content"]} />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Documents</label>

              {/* Existing Documents */}
              {formState.willDetails.existingDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Existing Documents</p>
                  <div className="rounded-lg border bg-muted/30 divide-y">
                    {formState.willDetails.existingDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 text-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="size-4 shrink-0 text-blue-500" />
                          <span className="truncate">{doc.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            ({(doc.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => downloadDocument(index)}
                            title="Download"
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeExistingDocument(index)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Documents */}
              <div className="space-y-2">
                {formState.willDetails.newDocuments.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Added Documents</p>
                    <div className="rounded-lg border border-dashed bg-muted/30 divide-y">
                      {formState.willDetails.newDocuments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="size-4 shrink-0 text-green-500" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeNewDocument(index)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="relative">
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    id="edit-file-upload"
                    onChange={(e) => handleDocumentsChange(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed"
                    onClick={() => document.getElementById("edit-file-upload")?.click()}
                  >
                    <Upload className="size-4" />
                    Upload Documents
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Max 1GB total size. Large files (&gt;5MB) uploaded directly to Arweave.
                </p>
              </div>
            </div>
          </div>
        );

      case "editSecurityQuestions":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-800 dark:bg-blue-950">
              <p className="font-medium text-blue-700 dark:text-blue-300">
                Manage Security Questions
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Would you like to update your security questions as well?
              </p>
            </div>

            {/* Question placeholder when not editing */}
            {!formState.isEditingSecurityQuestions && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm dark:border-blue-800/50 dark:bg-blue-950/20">
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
                A new version will be saved on blockchain storage using the same Inheritance
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
          <UnifiedPaymentSelector
            onSubmit={handleUnifiedPayment}
            isSubmitting={isSubmitting || isProcessingPayment}
            paymentStatus={paymentStatus}
            paymentProgress={paymentProgress}
            paymentPhase={paymentPhase}
            isReady={true}
          />
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
            lockedMode={isStorageAutoDetected ? (formState.storageType === "bitxenArweave" ? "hybrid" : "wander") : undefined}
            lockedChain={isStorageAutoDetected && formState.storageType === "bitxenArweave" ? ((formState.payment.selectedChain as ChainId) || DEFAULT_CHAIN) : undefined}
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
              <div className="rounded-lg border bg-card p-4">
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
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {formState.storageType === "bitxenArweave"
                        ? `Transaction Hash (${(formState.payment.selectedChain || DEFAULT_CHAIN).toUpperCase()})`
                        : "Transaction ID (Arweave)"}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-16 gap-1 text-xs"
                        onClick={() => handleCopy(latestTxId!)}
                      >
                        <Copy className="size-3" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-xs"
                        onClick={() => {
                          if (formState.storageType === "bitxenArweave") {
                            const chain = (formState.payment.selectedChain || DEFAULT_CHAIN) as ChainId;
                            const config = getChainConfig(chain);
                            window.open(`${config.blockExplorer}/tx/${latestTxId}`, "_blank");
                          } else {
                            const explorerBaseUrl = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL || "http://localhost:3021";
                            window.open(`${explorerBaseUrl}/explorer/arweave/tx/${latestTxId}`, "_blank");
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
        {(() => {
          const visibleSteps = isStorageAutoDetected
            ? editSteps.filter((s) => s.key !== "storageSelection")
            : editSteps;
          const visibleIndex = visibleSteps.findIndex((s) => s.key === editSteps[currentStep]?.key);
          return <Stepper steps={visibleSteps} currentStep={visibleIndex >= 0 ? visibleIndex : currentStep} />;
        })()}
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
