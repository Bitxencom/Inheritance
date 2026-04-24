import express from "express";

import {
    logTransaction,
    arweaveRelay,
    arweaveRelayStart,
    arweaveRelayEvents,
    getAllTransactions,
    getTransactionsByVault,
    clearTransactions,
} from "./transactions.controller.js";

export const transactionRouter = express.Router();

// Transaction log
transactionRouter.post("/log", logTransaction);
transactionRouter.get("/", getAllTransactions);
transactionRouter.get("/:vaultId", getTransactionsByVault);
transactionRouter.delete("/", clearTransactions);

// Arweave relay
transactionRouter.post("/arweave/relay", arweaveRelay);
transactionRouter.post("/arweave/relay/start", arweaveRelayStart);
transactionRouter.get("/arweave/relay/:jobId/events", arweaveRelayEvents);
