import express, { Request, Response } from "express";
import cors from "cors";

import { appEnv } from "./config/env.js";
import { vaultRouter } from "./modules/vault/vault.route.js";
import { ragRouter } from "./routes/rag.js";
import { aiQualityRouter } from "./routes/ai-quality.js";
import { transactionRouter } from "./modules/transactions/transactions.route.js";
import { globalErrorHandler } from "./middlewares/error.middleware.js";

export const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(
    cors({
        origin:
            appEnv.nodeEnv === "development"
                ? true
                : ["http://localhost:7000", "http://localhost:3000", "http://localhost:3001",
                    "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
);

// ── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2000mb" }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", async (_req: Request, res: Response) => {
    const healthStatus = {
        status: "ok",
        environment: appEnv.nodeEnv,
        timestamp: new Date().toISOString(),
        services: {
            backend: true,
            arweave: {
                available: false,
                gateway: appEnv.arweaveGateway,
                error: null as string | null,
            },
        },
    };

    try {
        const url = new URL(appEnv.arweaveGateway);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch(`${url.origin}/info`, {
                method: "GET",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                healthStatus.services.arweave.available = true;
            } else {
                healthStatus.services.arweave.error = `HTTP ${response.status}`;
            }
        } catch (error) {
            clearTimeout(timeoutId);
            healthStatus.services.arweave.error =
                error instanceof Error
                    ? error.name === "AbortError"
                        ? "Timeout - Blockchain storage not responding"
                        : error.message
                    : "Unknown error";
        }
    } catch (error) {
        healthStatus.services.arweave.error =
            error instanceof Error ? error.message : "Invalid gateway URL";
    }

    if (!healthStatus.services.arweave.available) {
        healthStatus.status = "warning";
    }

    res.json(healthStatus);
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/vaults", vaultRouter);
app.use("/api/v1/rag", ragRouter);
app.use("/api/v1/ai-quality", aiQualityRouter);
app.use("/api/v1/transactions", transactionRouter);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(globalErrorHandler);
