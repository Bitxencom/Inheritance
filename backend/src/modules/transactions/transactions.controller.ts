import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Arweave from "arweave";

import { appEnv } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const createArweaveClient = (gatewayUrl: string) => {
    const url = new URL(gatewayUrl);
    return Arweave.init({
        host: url.hostname,
        port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
        protocol: url.protocol.replace(":", ""),
    });
};

const b64ToBytes = (input: string): Buffer => {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/").trim();
    const padLen = normalized.length % 4;
    const padded = padLen === 0 ? normalized : normalized + "=".repeat(4 - padLen);
    return Buffer.from(padded, "base64");
};

// ─────────────────────────────────────────────────────────────────────────────
// Relay-job state (in-memory)
// ─────────────────────────────────────────────────────────────────────────────
type RelayJobState = {
    jobId: string;
    progress: number;
    status: string;
    done: boolean;
    txId?: string;
    error?: string;
    updatedAt: number;
};

const relayJobs = new Map<string, RelayJobState>();
const relayJobSubscribers = new Map<string, Set<Response>>();
const RELAY_JOB_TTL_MS = 10 * 60 * 1000;

const emitRelayJobEvent = (jobId: string, event: "progress" | "complete" | "error") => {
    const state = relayJobs.get(jobId);
    if (!state) return;
    const subscribers = relayJobSubscribers.get(jobId);
    if (!subscribers || subscribers.size === 0) return;

    const payload = JSON.stringify({
        jobId: state.jobId,
        progress: state.progress,
        status: state.status,
        done: state.done,
        txId: state.txId,
        error: state.error,
        updatedAt: state.updatedAt,
    });

    for (const res of subscribers) {
        try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${payload}\n\n`);
        } catch {
            // subscriber disconnected
        }
    }
};

const updateRelayJob = (
    jobId: string,
    patch: Partial<RelayJobState>,
    event: "progress" | "complete" | "error" = "progress",
) => {
    const prev = relayJobs.get(jobId);
    if (!prev) return;
    relayJobs.set(jobId, { ...prev, ...patch, jobId, updatedAt: Date.now() });
    emitRelayJobEvent(jobId, event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Transaction log (file-based)
// ─────────────────────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "transactions.json");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify({ transactions: [] }, null, 2));

interface TransactionLog {
    id: string;
    vaultId: string;
    txHash: string;
    chainId: string;
    chainName: string;
    contractAddress: string;
    fromAddress: string;
    dataHash: string;
    storageURI: string;
    fee: string;
    timestamp: string;
    blockExplorerUrl?: string;
}

interface TransactionLogFile {
    transactions: TransactionLog[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Arweave chunk upload helper (shared between relay endpoints)
// ─────────────────────────────────────────────────────────────────────────────
const MAX_CHUNK_RETRIES = 8;

async function uploadWithRetry(
    uploader: unknown,
    onProgress?: (pct: number) => void,
): Promise<number> {
    while (!(uploader as { isComplete: boolean }).isComplete) {
        let attempt = 0;
        while (true) {
            try {
                await (uploader as { uploadChunk: () => Promise<void> }).uploadChunk();
                break;
            } catch (e) {
                attempt += 1;
                if (attempt >= MAX_CHUNK_RETRIES) throw e;
                const backoffMs = Math.min(10_000, 500 * Math.pow(2, attempt - 1));
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
        }

        const pct =
            typeof (uploader as { pctComplete?: unknown }).pctComplete === "number"
                ? (uploader as { pctComplete: number }).pctComplete
                : typeof (uploader as { uploadedChunks?: unknown }).uploadedChunks === "number" &&
                    typeof (uploader as { totalChunks?: unknown }).totalChunks === "number" &&
                    (uploader as { totalChunks: number }).totalChunks > 0
                    ? ((uploader as { uploadedChunks: number }).uploadedChunks /
                        (uploader as { totalChunks: number }).totalChunks) *
                    100
                    : 0;

        onProgress?.(Math.max(0, Math.min(100, pct)));
    }

    return typeof (uploader as { lastResponseStatus?: unknown }).lastResponseStatus === "number"
        ? (uploader as { lastResponseStatus: number }).lastResponseStatus
        : 200;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/transactions/log
 * Log a successful blockchain transaction
 */
export const logTransaction = (req: Request, res: Response): void => {
    try {
        const {
            vaultId,
            txHash,
            chainId,
            chainName,
            contractAddress,
            fromAddress,
            dataHash,
            storageURI,
            fee,
            blockExplorerUrl,
        } = req.body;

        if (!vaultId || !txHash || !chainId) {
            res.status(400).json({
                success: false,
                error: "Missing required fields: vaultId, txHash, chainId",
            });
            return;
        }

        const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
        const newLog: TransactionLog = {
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            vaultId,
            txHash,
            chainId,
            chainName: chainName || "Unknown",
            contractAddress: contractAddress || "",
            fromAddress: fromAddress || "",
            dataHash: dataHash || "",
            storageURI: storageURI || "",
            fee: fee || "0",
            timestamp: new Date().toISOString(),
            blockExplorerUrl: blockExplorerUrl || undefined,
        };

        logsData.transactions.push(newLog);
        fs.writeFileSync(LOG_FILE, JSON.stringify(logsData, null, 2));
        console.log(`📝 Transaction logged: ${txHash.slice(0, 10)}... for vault ${vaultId}`);

        res.json({ success: true, message: "Transaction logged successfully", log: newLog });
    } catch (error) {
        console.error("❌ Error logging transaction:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to log transaction",
        });
    }
};

/**
 * POST /api/v1/transactions/arweave/relay
 * Synchronous Arweave relay (waits for completion)
 */
export const arweaveRelay = async (req: Request, res: Response): Promise<void> => {
    try {
        const body = req.body as { gatewayUrl?: unknown; txRaw?: unknown; dataB64?: unknown };
        const gatewayUrl =
            typeof body.gatewayUrl === "string" && body.gatewayUrl.trim().length > 0
                ? body.gatewayUrl.trim()
                : appEnv.arweaveGateway;

        if (!body.txRaw || typeof body.txRaw !== "object") {
            res.status(400).json({ success: false, error: "txRaw is required" });
            return;
        }
        if (typeof body.dataB64 !== "string" || body.dataB64.trim().length === 0) {
            res.status(400).json({ success: false, error: "dataB64 is required" });
            return;
        }

        const data = b64ToBytes(body.dataB64);
        const arweave = createArweaveClient(gatewayUrl);
        const tx = arweave.transactions.fromRaw(body.txRaw as never);

        if (!(await arweave.transactions.verify(tx))) {
            res.status(400).json({ success: false, error: "Invalid transaction signature" });
            return;
        }

        if (typeof (tx as unknown as { prepareChunks?: unknown }).prepareChunks === "function") {
            await (tx as unknown as { prepareChunks: (d: Buffer) => Promise<void> }).prepareChunks(data);
        }

        const uploader = await arweave.transactions.getUploader(tx, data);
        const lastStatus = await uploadWithRetry(uploader);

        if (lastStatus !== 200 && lastStatus !== 202) {
            res.status(502).json({
                success: false,
                error: `Arweave relay failed (Status: ${lastStatus})`,
                status: lastStatus,
            });
            return;
        }

        res.json({ success: true, txId: tx.id, status: lastStatus, gateway: gatewayUrl });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Arweave relay failed",
        });
    }
};

/**
 * POST /api/v1/transactions/arweave/relay/start
 * Async Arweave relay — returns jobId immediately, then uploads in background
 */
export const arweaveRelayStart = async (req: Request, res: Response): Promise<void> => {
    try {
        const body = req.body as { gatewayUrl?: unknown; txRaw?: unknown; dataB64?: unknown };
        const gatewayUrl =
            typeof body.gatewayUrl === "string" && body.gatewayUrl.trim().length > 0
                ? body.gatewayUrl.trim()
                : appEnv.arweaveGateway;

        if (!body.txRaw || typeof body.txRaw !== "object") {
            res.status(400).json({ success: false, error: "txRaw is required" });
            return;
        }
        if (typeof body.dataB64 !== "string" || body.dataB64.trim().length === 0) {
            res.status(400).json({ success: false, error: "dataB64 is required" });
            return;
        }

        const jobId =
            typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `relay-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        relayJobs.set(jobId, {
            jobId,
            progress: 0,
            status: "Queued",
            done: false,
            updatedAt: Date.now(),
        });
        setTimeout(() => {
            relayJobs.delete(jobId);
            relayJobSubscribers.delete(jobId);
        }, RELAY_JOB_TTL_MS).unref?.();

        res.json({ success: true, jobId });

        // Background upload
        const data = b64ToBytes(body.dataB64);
        const arweave = createArweaveClient(gatewayUrl);

        (async () => {
            try {
                updateRelayJob(jobId, { status: "Preparing Arweave transaction..." });
                const tx = arweave.transactions.fromRaw(body.txRaw as never);

                if (!(await arweave.transactions.verify(tx))) {
                    updateRelayJob(jobId, { done: true, error: "Invalid transaction signature" }, "error");
                    return;
                }

                if (typeof (tx as unknown as { prepareChunks?: unknown }).prepareChunks === "function") {
                    updateRelayJob(jobId, { status: "Preparing upload (chunking data)..." });
                    await (tx as unknown as { prepareChunks: (d: Buffer) => Promise<void> }).prepareChunks(data);
                }

                updateRelayJob(jobId, { status: "Uploading to Arweave..." });
                const uploader = await arweave.transactions.getUploader(tx, data);
                const lastStatus = await uploadWithRetry(uploader, (pct) =>
                    updateRelayJob(jobId, { progress: pct }, "progress"),
                );

                if (lastStatus !== 200 && lastStatus !== 202) {
                    updateRelayJob(
                        jobId,
                        { done: true, error: `Arweave relay failed (Status: ${lastStatus})` },
                        "error",
                    );
                    return;
                }

                updateRelayJob(
                    jobId,
                    { progress: 100, status: "Upload successful.", done: true, txId: tx.id },
                    "complete",
                );
            } catch (error) {
                updateRelayJob(
                    jobId,
                    { done: true, error: error instanceof Error ? error.message : "Arweave relay failed" },
                    "error",
                );
            }
        })();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Arweave relay start failed",
        });
    }
};

/**
 * GET /api/v1/transactions/arweave/relay/:jobId/events
 * SSE stream for relay job progress
 */
export const arweaveRelayEvents = (req: Request, res: Response): void => {
    const jobId = typeof req.params.jobId === "string" ? req.params.jobId : "";
    const state = relayJobs.get(jobId);
    if (!state) {
        res.status(404).json({ success: false, error: "Job not found" });
        return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();

    const subscribers = relayJobSubscribers.get(jobId) ?? new Set<Response>();
    subscribers.add(res);
    relayJobSubscribers.set(jobId, subscribers);

    emitRelayJobEvent(jobId, state.done ? (state.error ? "error" : "complete") : "progress");

    const ping = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* subscriber gone */ }
    }, 20_000);

    req.on("close", () => {
        clearInterval(ping);
        const set = relayJobSubscribers.get(jobId);
        if (set) {
            set.delete(res);
            if (set.size === 0) relayJobSubscribers.delete(jobId);
        }
    });
};

/**
 * GET /api/v1/transactions
 * Get all transaction logs
 */
export const getAllTransactions = (_req: Request, res: Response): void => {
    try {
        const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
        res.json({
            success: true,
            count: logsData.transactions.length,
            transactions: logsData.transactions,
        });
    } catch (error) {
        console.error("❌ Error reading transaction logs:", error);
        res.status(500).json({ success: false, error: "Failed to read transaction logs" });
    }
};

/**
 * GET /api/v1/transactions/:vaultId
 * Get transaction logs for a specific vault
 */
export const getTransactionsByVault = (req: Request, res: Response): void => {
    try {
        const { vaultId } = req.params;
        const logsData: TransactionLogFile = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
        const vaultTransactions = logsData.transactions.filter((tx) => tx.vaultId === vaultId);
        res.json({ success: true, vaultId, count: vaultTransactions.length, transactions: vaultTransactions });
    } catch (error) {
        console.error("❌ Error reading transaction logs:", error);
        res.status(500).json({ success: false, error: "Failed to read transaction logs" });
    }
};

/**
 * DELETE /api/v1/transactions
 * Clear all transaction logs
 */
export const clearTransactions = (_req: Request, res: Response): void => {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify({ transactions: [] }, null, 2));
        res.json({ success: true, message: "All transaction logs cleared" });
    } catch (error) {
        console.error("❌ Error clearing transaction logs:", error);
        res.status(500).json({ success: false, error: "Failed to clear transaction logs" });
    }
};
