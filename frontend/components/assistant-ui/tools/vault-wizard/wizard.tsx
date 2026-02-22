"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertMessage } from "@/components/ui/alert-message";
import { FieldError } from "@/components/ui/field-error";
import { ReviewSection, ReviewItem } from "@/components/ui/review-display";
import { cn } from "@/lib/utils";
import { FileText, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnifiedPaymentSelector } from "@/components/shared/payment";
import { Stepper } from "@/components/shared/stepper";

import { VaultCreationWizardProps } from "./types";
import { steps } from "./constants";
import { useVaultCreation } from "./hooks/use-vault-creation";

const placeholderSecurityQuestions = [
  "e.g. Where did we travel in 2025?",
  "e.g. What is our pet's name?",
  "e.g. What is the color of our first car?",
];

export function VaultCreationWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
}: VaultCreationWizardProps) {
  const {
    isDialog, formState, setFormState, currentStep, setCurrentStep, stepError, setStepError, fieldErrors, setFieldErrors, isSubmitting, setIsSubmitting, isProcessingPayment, setIsProcessingPayment, paymentStatus, setPaymentStatus, paymentProgress, setPaymentProgress, paymentPhase, setPaymentPhase, vaultIdRef, vaultKeyRef, pqcKeyPairRef, pqcCipherTextRef, textareaRef, adjustTextareaHeight, fillWithDummyData, resetWizard, handleDocumentsChange, removeDocument, formatFileSize, isNextBlockedByAttachmentPrep, handleSecurityQuestionChange, addSecurityQuestion, removeSecurityQuestion, handleTriggerTypeChange, setPresetTriggerDate, reviewSummary, validateStep, transformPayload, submitToMCP, handleNext, handleUnifiedPayment, handlePrev
  } = useVaultCreation({ variant, open, onOpenChange, onStepChange, onResult });

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
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleDocumentsChange(event.target.files)}
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

