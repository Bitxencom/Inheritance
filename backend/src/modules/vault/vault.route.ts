import { Router } from "express";

import {
    estimateCostSimple,
    estimateCost,
    prepareClient,
    prepareClientById,
    unlockVault,
    getSecurityQuestions,
    verifySecurityQuestions,
} from "./vault.controller.js";

export const vaultRouter = Router();

// Cost estimation
vaultRouter.post("/estimate-cost-simple", estimateCostSimple);
vaultRouter.post("/estimate-cost", estimateCost);

// Vault preparation
vaultRouter.post("/prepare-client", prepareClient);
vaultRouter.post("/:vaultId/prepare-client", prepareClientById);

// Vault access
vaultRouter.post("/:vaultId/unlock", unlockVault);

// Security questions
vaultRouter.post("/:vaultId/security-questions", getSecurityQuestions);
vaultRouter.post("/:vaultId/verify-security-questions", verifySecurityQuestions);
