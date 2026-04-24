/**
 * Arweave upload utilities — extracted from wanderWallet.ts.
 *
 * Handles:
 *  - IndexedDB-based resume records (persist between page reloads)
 *  - HTTP POST with XMLHttpRequest-based upload progress tracking
 *  - SSE-based relay job subscription
 */

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers for upload resume
// ─────────────────────────────────────────────────────────────────────────────

const IDB_NAME = "arweave-uploads";
const IDB_STORE = "records";
const IDB_VERSION = 1;

export interface UploadRecord {
    key: string;             // resumeKey
    payloadB64: string;      // base64url of the data bytes
    txRaw: Record<string, unknown>;  // serialised Arweave transaction (without data)
    txId: string;
    createdAt: string;       // ISO timestamp
    updatedAt: string;
}

function openUploadDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () =>
            req.result.createObjectStore(IDB_STORE, { keyPath: "key" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbPutUploadRecord(record: UploadRecord): Promise<void> {
    const db = await openUploadDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    db.close();
}

export async function idbGetUploadRecord(key: string): Promise<UploadRecord | undefined> {
    const db = await openUploadDb();
    const record = await new Promise<UploadRecord | undefined>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result as UploadRecord | undefined);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
}

export async function idbDeleteUploadRecord(key: string): Promise<void> {
    const db = await openUploadDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    db.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP POST with XMLHttpRequest upload-progress tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchWithProgressResult<T = unknown> {
    ok: boolean;
    status: number;
    data: T | null;
}

export function postJsonWithUploadProgress<T = unknown>(params: {
    url: string;
    body: unknown;
    onProgress?: (pct: number) => void;
}): Promise<FetchWithProgressResult<T>> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const json = JSON.stringify(params.body);

        xhr.open("POST", params.url, true);
        xhr.setRequestHeader("Content-Type", "application/json");

        if (params.onProgress && xhr.upload) {
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    params.onProgress!(Math.max(0, Math.min(100, (event.loaded / event.total) * 100)));
                }
            });
        }

        xhr.onload = () => {
            let data: T | null = null;
            try {
                data = JSON.parse(xhr.responseText) as T;
            } catch {
                /* non-JSON body */
            }
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));

        xhr.send(json);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE relay-job subscriber
// ─────────────────────────────────────────────────────────────────────────────

export interface RelayJobPayload {
    jobId?: string;
    progress?: number;
    status?: string;
    txId?: string;
    error?: string;
    done?: boolean;
}

/**
 * Subscribe to a relay job's SSE stream.
 * Returns a promise that resolves with the Arweave transaction ID when done
 * or rejects with an error.
 *
 * @param jobId      - The relay job ID returned by `/arweave/relay/start`
 * @param fallbackTxId - Used if the SSE payload doesn't contain a txId
 * @param onStatus   - Optional callback for status messages
 * @param onProgress - Optional callback for progress 0–100
 */
export function listenRelayJobEvents(params: {
    jobId: string;
    fallbackTxId: string;
    onStatus?: (status: string) => void;
    onProgress?: (pct: number) => void;
}): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const es = new EventSource(
            `/api/transactions/arweave/relay/${encodeURIComponent(params.jobId)}/events`,
        );

        const finish = (err?: Error, txId?: string) => {
            try { es.close(); } catch { /* ignore */ }
            if (err) reject(err);
            else resolve(txId || params.fallbackTxId);
        };

        const handlePayload = (raw: string): RelayJobPayload | null => {
            try {
                const payload = JSON.parse(raw) as RelayJobPayload;
                if (typeof payload.status === "string") params.onStatus?.(payload.status);
                if (typeof payload.progress === "number") {
                    params.onProgress?.(Math.max(0, Math.min(100, payload.progress)));
                }
                return payload;
            } catch {
                return null;
            }
        };

        es.addEventListener("progress", (event) => {
            const raw = (event as MessageEvent).data;
            if (typeof raw === "string") handlePayload(raw);
        });

        es.addEventListener("complete", (event) => {
            const raw = (event as MessageEvent).data;
            if (typeof raw !== "string") {
                finish(undefined, params.fallbackTxId);
                return;
            }
            const payload = handlePayload(raw);
            const txId =
                payload && typeof payload.txId === "string" ? payload.txId : params.fallbackTxId;
            finish(undefined, txId);
        });

        es.addEventListener("error", (event) => {
            const raw = (event as MessageEvent).data;
            if (typeof raw !== "string") {
                finish(new Error("Arweave relay connection failed."));
                return;
            }
            const payload = handlePayload(raw);
            const message =
                payload && typeof payload.error === "string"
                    ? payload.error
                    : "Arweave relay failed";
            finish(new Error(message));
        });
    });
}
