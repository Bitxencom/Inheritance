const fs = require('fs');

const WIZARD_PATH = 'frontend/components/assistant-ui/tools/vault-claim-wizard/wizard.tsx';
const HOOK_PATH = 'frontend/components/assistant-ui/tools/vault-claim-wizard/hooks/use-vault-claim.ts';

const importsBlock = `"use client";

import { useCallback, useEffect, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, CircleDashed, FileText, Download } from "lucide-react";
import { AlertMessage } from "@/components/ui/alert-message";
import { Stepper } from "@/components/shared/stepper";
import { getVaultById } from "@/lib/vault-storage";
import {
  InheritanceIdField,
  SecurityQuestionsField,
  FractionKeysField,
  validateSecurityQuestionsApi,
  getLocalVaultErrorMessage,
  generateSecurityQuestionFieldErrors,
} from "@/components/assistant-ui/tools/shared";
import { combineSharesClient } from "@/lib/shamirClient";
import {
  deriveEffectiveAesKeyClient,
  decryptVaultPayloadClient,
  decryptVaultPayloadRawKeyClient,
  decryptMetadataClient,
  unwrapKeyClient,
  deriveUnlockKey,
  type WrappedKeyV1,
  type EncryptedVaultClient,
} from "@/lib/clientVaultCrypto";
import {
  getAvailableChains,
  getChainKeyFromNumericChainId,
  getNetworkIdFromChainKey,
  CHAIN_CONFIG,
  type ChainId,
} from "@/lib/chains";
import {
  readBitxenDataIdByHash,
  readBitxenDataRecord,
  finalizeRelease,
} from "@/lib/metamaskWallet";
import { sha256Hex } from "@/lib/crypto-utils";
import {
  discoverBitxenChainInfo,
  discoverBitxenEncryptedKeyForVault,
  tryLoadHybridEncryptedVault,
  extractWrappedKeyRawFromMetadata,
  parseWrappedKeyV1,
  verifyFractionKeyCommitmentsIfPresent,
  type FractionKeyCommitmentsV1,
  type BitxenIndexV1,
} from "@/lib/bitxen-discovery";

import type { ClaimFormState, ClaimSubmissionResult, VaultClaimWizardProps } from "./types";
import { initialClaimFormState, claimSteps } from "./constants";

export type UnlockResponseLike = {
  success?: boolean;
  encryptedVault?: unknown;
  decryptedVault?: unknown;
  metadata?: unknown;
  legacy?: unknown;
  message?: unknown;
  error?: unknown;
  releaseEntropy?: string;
  contractDataId?: string;
  contractAddress?: string;
  chainId?: number;
};
`;

const hookLines = fs.readFileSync(HOOK_PATH, 'utf-8').split('\n');
const hookStart = hookLines.findIndex(l => l.includes('export function useVaultClaim'));
const hookContent = importsBlock + '\n' + hookLines.slice(hookStart).join('\n');
fs.writeFileSync(HOOK_PATH, hookContent);

const wizLines = fs.readFileSync(WIZARD_PATH, 'utf-8').split('\n');
const wizStart = wizLines.findIndex(l => l.includes('export function VaultClaimWizard'));
const newWiz = importsBlock + '\nimport { useVaultClaim } from "./hooks/use-vault-claim";\n\n' + wizLines.slice(wizStart).join('\n');
fs.writeFileSync(WIZARD_PATH, newWiz);

console.log("Restored cleanly.");
