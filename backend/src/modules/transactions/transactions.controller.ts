import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Arweave from "arweave";

import { appEnv } from "../../config/env.js";
import { logger } from "../../config/logger.js";

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
                const u = uploader as { lastResponseStatus?: number; lastResponseError?: string };
                if (u.lastResponseStatus && u.lastResponseStatus !== 200 && u.lastResponseStatus !== 202) {
                    throw new Error(`Chunk upload failed with status ${u.lastResponseStatus}: ${u.lastResponseError || ""}`);
                }
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
        logger.info(`📝 Transaction logged: ${txHash.slice(0, 10)}... for vault ${vaultId}`);

        res.json({ success: true, message: "Transaction logged successfully", log: newLog });
    } catch (error) {
        logger.error({ err: error }, "❌ Error logging transaction");
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
                tx.data = data; // CRITICAL: Buffer must be attached for signature verification and upload

                const gateways = [
                    gatewayUrl,
                    "https://arweave.dev",
                ].filter((v, i, a) => a.indexOf(v) === i);

                if (!(await arweave.transactions.verify(tx))) {
                    logger.error({ jobId, txId: tx.id }, "[ArweaveRelay] Mathematical verification failed locally");
                    updateRelayJob(jobId, { done: true, error: "Invalid transaction signature" }, "error");
                    return;
                }

                let uploadSuccessful = false;
                for (const gw of gateways) {
                    try {
                        const gwArweave = createArweaveClient(gw);
                        logger.info({ jobId, gateway: gw }, "[ArweaveRelay] Trying gateway...");

                        // 1. Try Direct Post for small files
                        if (data.length < 256 * 1024) {
                            updateRelayJob(jobId, { status: `Posting to ${new URL(gw).hostname}...` });
                            // Use api.post() directly to avoid arweave.transactions.post() calling
                            // prepareChunks() internally, which can overwrite data_root and cause
                            // the posted header to mismatch the signed data_root → arweave.net 400.
                            const signedDataRoot = tx.data_root;
                            const txJson = tx.toJSON ? tx.toJSON() : tx;
                            logger.info({
                                jobId,
                                txId: tx.id,
                                data_root: signedDataRoot,
                                data_size: tx.data_size,
                                dataLen: data.length,
                                owner_prefix: tx.owner?.slice(0, 20),
                            }, "[ArweaveRelay] Posting tx...");
                            const rawResp = await (gwArweave as any).api.post("tx", txJson);
                            const postStatus: number = rawResp?.status ?? 0;
                            if (postStatus === 200 || postStatus === 202) {
                                uploadSuccessful = true;
                                logger.info({ jobId, gateway: gw, status: postStatus }, "[ArweaveRelay] Post success");
                                break;
                            }
                            logger.warn({ jobId, gateway: gw, status: postStatus, body: rawResp?.data }, "[ArweaveRelay] Post failed");
                        }

                        // 2. Try Chunked Uploader as fallback or for large files
                        updateRelayJob(jobId, { status: `Uploading to ${new URL(gw).hostname}...` });
                        if (typeof (tx as any).prepareChunks === "function") {
                            // Save the signed data_root before prepareChunks() can overwrite it.
                            // prepareChunks() recomputes from raw bytes and sets tx.data_root.
                            // If the recomputed value differs from what was signed, the uploaded
                            // header would have a wrong data_root → network signature verify fails.
                            const savedDataRoot = tx.data_root;
                            await (tx as any).prepareChunks(data);
                            if (savedDataRoot && tx.data_root !== savedDataRoot) {
                                logger.warn({
                                    jobId,
                                    signed: savedDataRoot,
                                    computed: tx.data_root,
                                }, "[ArweaveRelay] data_root mismatch after prepareChunks — restoring signed value");
                                tx.data_root = savedDataRoot;
                            }
                        }
                        const uploader = await gwArweave.transactions.getUploader(tx, data);
                        const status = await uploadWithRetry(uploader, (pct) =>
                            updateRelayJob(jobId, { progress: pct }, "progress")
                        );

                        if (status === 200 || status === 202) {
                            uploadSuccessful = true;
                            logger.info({ jobId, gateway: gw, status }, "[ArweaveRelay] Uploader success");
                            break;
                        }
                    } catch (gwErr: any) {
                        logger.error({ jobId, gateway: gw, error: gwErr.message }, "[ArweaveRelay] Gateway error");
                        continue;
                    }
                }

                if (!uploadSuccessful) {
                    throw new Error("All Arweave gateways failed to accept the transaction. The signature might be invalid for the current block height or network is unstable.");
                }

                updateRelayJob(
                    jobId,
                    { progress: 100, status: "Upload successful.", done: true, txId: tx.id },
                    "complete",
                );
            } catch (error: any) {
                updateRelayJob(
                    jobId,
                    { done: true, error: error.message || "Arweave relay failed" },
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
    res.setHeader("X-Accel-Buffering", "no"); // CRITICAL: Disable Nginx buffering for SSE
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();

    const subscribers = relayJobSubscribers.get(jobId) ?? new Set<Response>();
    subscribers.add(res);
    relayJobSubscribers.set(jobId, subscribers);

    emitRelayJobEvent(jobId, state.done ? (state.error ? "error" : "complete") : "progress");

    const ping = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* subscriber gone */ }
    }, 10_000);

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
        logger.error({ err: error }, "❌ Error reading transaction logs");
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
        logger.error({ err: error }, "❌ Error reading transaction logs");
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
        logger.error({ err: error }, "❌ Error clearing transaction logs");
        res.status(500).json({ success: false, error: "Failed to clear transaction logs" });
    }
};
