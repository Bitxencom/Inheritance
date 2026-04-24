const fs = require('fs');

const WIZARD_PATH = 'frontend/components/assistant-ui/tools/vault-claim-wizard/wizard.tsx';
const HOOK_PATH = 'frontend/components/assistant-ui/tools/vault-claim-wizard/hooks/use-vault-claim.ts';

const text = fs.readFileSync(WIZARD_PATH, 'utf-8');
const lines = text.split('\n');

const startIdx = lines.findIndex(l => l.includes('export function VaultClaimWizard'));
const renderIdx = lines.findIndex(l => l.includes('const renderStepContent = () => {'));

// All imports and types up to startIdx
const importsLines = lines.slice(0, startIdx);

// Extract logic lines
let logicLines = lines.slice(startIdx + 1, renderIdx);
// Remove first line which is `}: VaultClaimWizardProps) {` 
logicLines.shift();

const hookContent = `${importsLines.join('\n')}

export function useVaultClaim({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
  initialData,
}: VaultClaimWizardProps) {
${logicLines.join('\n')}
  return {
    formState, currentStep, stepError, isWarning, fieldErrors, isSubmitting, isVerifying, 
    isVerifyingFractionKeys,
    unlockProgress, unlockStep, securityQuestions, verificationSuccess, isSecurityAnswersVerified,
    validSecurityAnswerIndexes, isFractionKeysVerified, triggerRelease, unlockedDocuments,
    unlockedDecryptedDocuments, vaultTitle, newerVersionAvailable, latestTxId, hasPendingEdit,
    releaseEntropy, cleanedUnlockProgress, cleanedUnlockStep, progressTitle, progressSubtitle,
    showFullLoading, combinedKeyForAttachments,
    handleVaultIdChange, handleSecurityAnswerChange, handleFractionKeyChange,
    handleNext, handlePrev, handleReset, handleDownload, downloadDocument
  };
}
`;

fs.writeFileSync(HOOK_PATH, hookContent);

const newWizardContent = `${importsLines.join('\n')}
import { useVaultClaim } from "./hooks/use-vault-claim";

export function VaultClaimWizard({
  variant = "dialog",
  open = true,
  onOpenChange,
  onStepChange,
  onResult,
  initialData,
}: VaultClaimWizardProps) {
  const isDialog = variant === "dialog";
  const {
    formState, currentStep, stepError, isWarning, fieldErrors, isSubmitting, isVerifying, 
    isVerifyingFractionKeys,
    unlockProgress, unlockStep, securityQuestions, verificationSuccess, isSecurityAnswersVerified,
    validSecurityAnswerIndexes, isFractionKeysVerified, triggerRelease, unlockedDocuments,
    unlockedDecryptedDocuments, vaultTitle, newerVersionAvailable, latestTxId, hasPendingEdit,
    releaseEntropy, cleanedUnlockProgress, cleanedUnlockStep, progressTitle, progressSubtitle,
    showFullLoading,
    handleVaultIdChange, handleSecurityAnswerChange, handleFractionKeyChange,
    handleNext, handlePrev, handleReset, handleDownload, downloadDocument
  } = useVaultClaim({ variant, open, onOpenChange, onStepChange, onResult, initialData });

${lines.slice(renderIdx).join('\n')}
`;

fs.writeFileSync(WIZARD_PATH, newWizardContent);

console.log("Refactoring complete");
