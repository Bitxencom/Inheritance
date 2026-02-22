import { Router } from "express";

import {
    estimateCostSimple,
    estimateCost,
    prepareDeprecated,
    prepareClient,
    prepareClientById,
    unlockVault,
    claimDeprecated,
    editDeprecated,
    previewDeprecated,
    verifyFractionKeysDeprecated,
    downloadDocumentDeprecated,
    getSecurityQuestions,
    verifySecurityQuestions,
} from "./vault.controller.js";

export const vaultRouter = Router();

// Cost estimation
vaultRouter.post("/estimate-cost-simple", estimateCostSimple);
vaultRouter.post("/estimate-cost", estimateCost);

// Vault preparation
vaultRouter.post("/prepare", prepareDeprecated);
vaultRouter.post("/prepare-client", prepareClient);
vaultRouter.post("/:vaultId/prepare-client", prepareClientById);

// Vault access
vaultRouter.post("/:vaultId/unlock", unlockVault);
vaultRouter.post("/claim", claimDeprecated);

// Edit / preview (deprecated server-side operations)
vaultRouter.post("/:vaultId/edit", editDeprecated);
vaultRouter.post("/:vaultId/preview", previewDeprecated);

// Security questions
vaultRouter.post("/:vaultId/security-questions", getSecurityQuestions);
vaultRouter.post("/:vaultId/verify-security-questions", verifySecurityQuestions);

// Fraction keys (deprecated server-side)
vaultRouter.post("/:vaultId/verify-fraction-keys", verifyFractionKeysDeprecated);

// Document download (deprecated server-side)
vaultRouter.post("/:vaultId/document/:documentIndex", downloadDocumentDeprecated);
