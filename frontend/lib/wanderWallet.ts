// Wander Wallet (ArConnect) integration library
// Wander is a browser wallet for Arweave - https://wander.app
// Arweave fee for storage is automatically handled during transaction dispatch
//
// HYBRID MODE:
// - If browser extension is available → use extension
// - If not (mobile browser) → fallback to Wander Connect SDK (embedded wallet)

import Arweave from 'arweave';

// WanderConnect is dynamically imported to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WanderConnectType = any;

// Type definitions for arweaveWallet (injected by Wander/ArConnect wallet extensions)
// Using interface merging with Window, compatible with arweave package types
interface ArweaveWallet {
  connect: (permissions: string[], appInfo?: { name?: string; logo?: string }) => Promise<void>;
  disconnect: () => Promise<void>;
  getActiveAddress: () => Promise<string>;
  getPermissions: () => Promise<string[]>;
  sign: (transaction: unknown, options?: { saltLength?: number }) => Promise<unknown>;
  dispatch: (transaction: unknown) => Promise<{ id: string; type: string }>;
  getArweaveConfig: () => Promise<{ host: string; port: number; protocol: string }>;
}

declare global {
  interface Window {
    WanderSDK?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      WanderConnect: any;
    }
  }
}

// Helper to get arweaveWallet from window with proper typing
function getArweaveWallet(): ArweaveWallet | undefined {
  if (typeof window !== 'undefined' && 'arweaveWallet' in window) {
    return (window as unknown as { arweaveWallet: ArweaveWallet }).arweaveWallet;
  }
  return undefined;
}

/**
 * Wander Wallet configuration
 * Note: No business fee - user only pays Arweave storage fee
 */
export const WANDER_CONFIG = {
  // Required permissions for the app
  permissions: ['ACCESS_ADDRESS', 'SIGN_TRANSACTION', 'DISPATCH'] as string[],
  
  // App info for wallet connection
  appInfo: {
    name: 'Inheritance - Digital Vault',
    logo: 'https://chat.bitxen.com/logo.png',
  },
  
  // Wander Connect Client ID (free tier for now)
  clientId: 'FREE_TRIAL',
} as const;

// Store Wander Connect instance (dynamically imported)
let wanderConnectInstance: WanderConnectType | null = null;

// Track current wallet connection mode
type WalletMode = 'extension' | 'connect' | 'none';
let currentConnectionMode: WalletMode = 'none';

/**
 * Get the current wallet mode (before connection)
 */
export function getWalletMode(): WalletMode {
  if (getArweaveWallet() !== undefined) {
    return 'extension';
  }
  return 'none';
}

/**
 * Check if currently using Wander Connect (embedded wallet)
 * Returns true if the user connected via Wander Connect SDK
 */
export function isUsingWanderConnect(): boolean {
  return currentConnectionMode === 'connect';
}

/**
 * Check if Wander Wallet (ArConnect) extension is installed
 */
export function isWanderWalletInstalled(): boolean {
  return getArweaveWallet() !== undefined;
}

/**
 * Initialize Wander Connect SDK (embedded wallet)
 * This is used when browser extension is not available (e.g., mobile browser)
 */
/**
 * Preload Wander Connect SDK script
 */
export function preloadWanderConnect(): void {
  if (typeof window === 'undefined' || window.WanderSDK || document.querySelector('script[src="/wander-connect.js"]')) {
    return;
  }
  const script = document.createElement('script');
  script.src = '/wander-connect.js';
  script.async = true;
  document.body.appendChild(script);
}

/**
 * Initialize Wander Connect SDK (embedded wallet)
 * This is used when browser extension is not available (e.g., mobile browser)
 */
export async function initializeWanderConnect(): Promise<string> {
  // If already initialized and wallet is ready, return address
  if (wanderConnectInstance && getArweaveWallet()) {
    try {
      const address = await getArweaveWallet()!.getActiveAddress();
      currentConnectionMode = 'connect';
      return address;
    } catch {
      // Failed to get address, maybe disconnected. Continue to re-init.
    }
  }

  // Load script manually if not present
  if (!window.WanderSDK) {
    if (!document.querySelector('script[src="/wander-connect.js"]')) {
        await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/wander-connect.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Wander Connect SDK'));
        document.body.appendChild(script);
        });
    } else {
        // Script loading but not ready, wait a bit
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (window.WanderSDK) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
  }

  if (!window.WanderSDK || !window.WanderSDK.WanderConnect) {
     throw new Error('Wander Connect SDK loaded but object is missing.');
  }

  const WanderConnect = window.WanderSDK.WanderConnect;
  
  // Create new Wander Connect instance
  wanderConnectInstance = new WanderConnect({
    clientId: WANDER_CONFIG.clientId,
  });

  // Force open UI immediately to trigger sign-in popup
  const tryOpen = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (wanderConnectInstance && typeof (wanderConnectInstance as any).open === 'function') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (wanderConnectInstance as any).open();
          return true;
        } catch (e) {
          console.warn('Failed to auto-open Wander Connect UI:', e);
          return false;
        }
    }
    return false;
  };

  if (!tryOpen()) {
    // Retry a few times if immediate open fails
    let retries = 0;
    const interval = setInterval(() => {
        if (tryOpen() || retries > 5) clearInterval(interval);
        retries++;
    }, 500);
  }

  // Wait for wallet loaded event
  return new Promise((resolve, reject) => {
    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      reject(new Error('Wander Connect initialization timed out. Please try again.'));
    }, 5 * 60 * 1000);

    // Listen for wallet loaded event
    const handleWalletLoaded = async (e: Event) => {
      clearTimeout(timeout);
      window.removeEventListener('arweaveWalletLoaded', handleWalletLoaded);

      try {
        // Always try to connect forcefully to trigger popup
        const wallet = getArweaveWallet();
        if (wallet) {
          // Force connect to trigger popup
          await wallet.connect(WANDER_CONFIG.permissions, WANDER_CONFIG.appInfo);
          
          const address = await wallet.getActiveAddress();
          if (address) {
            currentConnectionMode = 'connect';
            
            // Close the Wander Connect popup automatically after successful connection
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (wanderConnectInstance && typeof (wanderConnectInstance as any).close === 'function') {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (wanderConnectInstance as any).close();
                } catch (e) {
                    console.warn('Failed to close Wander Connect UI:', e);
                }
            }

            resolve(address);
          } else {
            reject(new Error('Unable to get wallet address.'));
          }
        } else {
          reject(new Error('Wallet not available after initialization.'));
        }
      } catch (error) {
        reject(error);
      }
    };

    window.addEventListener('arweaveWalletLoaded', handleWalletLoaded);
  });
}

/**
 * Destroy Wander Connect instance
 * Call this when user disconnects or app unmounts
 */
export async function destroyWanderConnect(): Promise<void> {
  if (wanderConnectInstance) {
    if (typeof wanderConnectInstance.destroy === 'function') {
      try {
        await wanderConnectInstance.destroy();
      } catch (e) {
        console.error('Error destroying Wander Connect:', e);
      }
    }
    wanderConnectInstance = null;
    currentConnectionMode = 'none';
  }
}

/**
 * Connect to Wander Wallet
 * - Uses browser extension if available
 * - Falls back to Wander Connect (embedded wallet) if not
 */
export async function connectWanderWallet(): Promise<string> {
  // If extension is available, use it
  if (isWanderWalletInstalled()) {
    try {
      const wallet = getArweaveWallet()!;
      await wallet.connect(
        WANDER_CONFIG.permissions,
        WANDER_CONFIG.appInfo
      );

      const address = await wallet.getActiveAddress();
      
      if (!address) {
        throw new Error('Unable to detect a connected wallet address.');
      }

      currentConnectionMode = 'extension';
      return address;
    } catch (error) {
      if ((error as Error).message?.includes('User cancelled')) {
        throw new Error('Connection request was cancelled.');
      }
      throw new Error(`We couldn't connect to Wander Wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // No extension available, use Wander Connect (embedded wallet)
  return initializeWanderConnect();
}

/**
 * Get connected wallet address
 */
export async function getConnectedAddress(): Promise<string | null> {
  // Try extension first
  if (isWanderWalletInstalled()) {
    try {
      const wallet = getArweaveWallet()!;
      const permissions = await wallet.getPermissions();
      if (permissions.includes('ACCESS_ADDRESS')) {
        const address = await wallet.getActiveAddress();
        if (address) {
          currentConnectionMode = 'extension';
          return address;
        }
      }
    } catch {
      // Ignore extension errors, try fallback
    }
  }

  // If Wunder Connect was initialized, check it
  if (wanderConnectInstance && getArweaveWallet()) {
    try {
      const address = await getArweaveWallet()!.getActiveAddress();
      if (address) {
        currentConnectionMode = 'connect';
        return address;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Disconnect from Wander Wallet
 */
export async function disconnectWanderWallet(): Promise<void> {
  try {
    if (isWanderWalletInstalled()) {
      await getArweaveWallet()!.disconnect();
    }
    
    // Always cleanup Wander Connect
    await destroyWanderConnect();
  } catch (error) {
    console.error('Failed to disconnect:', error);
  }
}

/**
 * Check if wallet is connected and has required permissions
 */
export async function isWalletReady(): Promise<boolean> {
  try {
    // Check extension or injected wallet (Wander Connect injects arweaveWallet too)
    if (getArweaveWallet()) {
        const wallet = getArweaveWallet()!;
        const permissions = await wallet.getPermissions();
        const hasAllPermissions = WANDER_CONFIG.permissions.every(p => permissions.includes(p));
        
        if (!hasAllPermissions) {
          return false;
        }
    
        const address = await wallet.getActiveAddress();
        return !!address;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Dispatch data to Arweave via Wander Wallet
 * User pays storage fee directly from their wallet
 */
export interface DispatchResult {
  txId: string;
  type: string;
}

// Initialize Arweave for transaction creation (we use mainnet config by default)
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

async function postJsonWithUploadProgress<T>(params: {
  url: string;
  body: unknown;
  onProgress?: (progress: number) => void;
}): Promise<{ ok: boolean; status: number; data: T }> {
  if (typeof XMLHttpRequest === "undefined") {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
  }

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", params.url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.responseType = "text";

    const report = (value: number) => {
      const clamped = Math.max(0, Math.min(99.9, value));
      params.onProgress?.(clamped);
    };

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;
        report((event.loaded / event.total) * 100);
      };
    }

    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload was aborted."));
    xhr.onload = () => {
      const status = xhr.status;
      const ok = status >= 200 && status < 300;
      const rawText = typeof xhr.responseText === "string" ? xhr.responseText : "";
      let data: T;
      try {
        data = (rawText ? JSON.parse(rawText) : {}) as T;
      } catch {
        data = {} as T;
      }
      params.onProgress?.(100);
      resolve({ ok, status, data });
    };

    try {
      xhr.send(JSON.stringify(params.body));
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Failed to start upload."));
    }
  });
}

type ArweaveUploadResumeRecord = {
  key: string;
  vaultId?: string;
  payloadHash: string;
  payloadB64: string;
  txRaw?: unknown;
  uploaderRaw?: unknown;
  txId?: string;
  updatedAt: string;
};

const ARWEAVE_UPLOAD_DB = "bitxen_arweave_uploads";
const ARWEAVE_UPLOAD_STORE = "uploads";
const ARWEAVE_UPLOAD_DB_VERSION = 1;

function openArweaveUploadDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ARWEAVE_UPLOAD_DB, ARWEAVE_UPLOAD_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARWEAVE_UPLOAD_STORE)) {
        db.createObjectStore(ARWEAVE_UPLOAD_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function idbGetUploadRecord(key: string): Promise<ArweaveUploadResumeRecord | null> {
  const db = await openArweaveUploadDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(ARWEAVE_UPLOAD_STORE, "readonly");
      const store = tx.objectStore(ARWEAVE_UPLOAD_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as ArweaveUploadResumeRecord | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Failed to read IndexedDB"));
    });
  } finally {
    db.close();
  }
}

async function idbPutUploadRecord(record: ArweaveUploadResumeRecord): Promise<void> {
  const db = await openArweaveUploadDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ARWEAVE_UPLOAD_STORE, "readwrite");
      const store = tx.objectStore(ARWEAVE_UPLOAD_STORE);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("Failed to write IndexedDB"));
    });
  } finally {
    db.close();
  }
}

async function idbDeleteUploadRecord(key: string): Promise<void> {
  const db = await openArweaveUploadDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ARWEAVE_UPLOAD_STORE, "readwrite");
      const store = tx.objectStore(ARWEAVE_UPLOAD_STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("Failed to delete IndexedDB"));
    });
  } finally {
    db.close();
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256B64Url(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  const digestBytes = new Uint8Array(digest);
  const b64 = bytesToB64(digestBytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function makeResumeKey(vaultId: string | undefined, payloadHash: string): string {
  const safeVault = typeof vaultId === "string" && vaultId.trim().length > 0 ? vaultId.trim() : "no_vault";
  return `arweave_upload:${safeVault}:${payloadHash}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchToArweave(
  data: unknown,
  vaultId?: string,
  tags?: Record<string, string>,
  onProgress?: (progress: number) => void,
  onStatus?: (status: string) => void,
): Promise<DispatchResult> {
  const isReady = await isWalletReady();
  if (!isReady) {
    throw new Error('Wallet not connected. Please connect your wallet to proceed.');
  }

  try {
    onStatus?.("Preparing Arweave transaction...");
    const encoder = new TextEncoder();
    const isBinaryPayload = data instanceof Uint8Array || data instanceof ArrayBuffer;
    const payloadBytes =
      data instanceof Uint8Array
        ? data
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : encoder.encode(JSON.stringify(data));

    const payloadHash = await sha256B64Url(payloadBytes);
    const resumeKey = makeResumeKey(vaultId, payloadHash);

    let resumeRecord: ArweaveUploadResumeRecord | null = null;
    try {
      resumeRecord = await idbGetUploadRecord(resumeKey);
    } catch {
      resumeRecord = null;
    }

    const savedPayloadBytes =
      resumeRecord?.payloadHash === payloadHash && typeof resumeRecord.payloadB64 === "string"
        ? b64ToBytes(resumeRecord.payloadB64)
        : null;

    const effectivePayloadBytes = savedPayloadBytes ?? payloadBytes;

    const resumeIfPossible = async (): Promise<DispatchResult | null> => {
      if (!resumeRecord) return null;
      const dataBytes = effectivePayloadBytes;
      try {
        const uploader =
          resumeRecord.uploaderRaw
            ? await arweave.transactions.getUploader(resumeRecord.uploaderRaw as never, dataBytes)
            : resumeRecord.txRaw
              ? await arweave.transactions.getUploader(
                  arweave.transactions.fromRaw(resumeRecord.txRaw as never) as never,
                  dataBytes,
                )
              : null;

        if (!uploader) return null;

        const txId =
          typeof resumeRecord.txId === "string" && resumeRecord.txId.trim().length > 0
            ? resumeRecord.txId.trim()
            : typeof (uploader as unknown as { tx?: { id?: unknown } }).tx?.id === "string"
              ? ((uploader as unknown as { tx: { id: string } }).tx.id as string)
              : typeof (uploader as unknown as { transaction?: { id?: unknown } }).transaction?.id === "string"
                ? ((uploader as unknown as { transaction: { id: string } }).transaction.id as string)
                : null;

        if (!txId) return null;

        onStatus?.("Resuming Arweave upload...");

        const maxChunkRetries = 8;
        while (!(uploader as unknown as { isComplete: boolean }).isComplete) {
          let attempt = 0;
          while (true) {
            try {
              await (uploader as unknown as { uploadChunk: () => Promise<void> }).uploadChunk();
              break;
            } catch (e) {
              attempt += 1;
              if (attempt >= maxChunkRetries) throw e;
              const backoffMs = Math.min(10_000, 500 * Math.pow(2, attempt - 1));
              onStatus?.(`Upload chunk failed, retrying (${attempt}/${maxChunkRetries})...`);
              await sleep(backoffMs);
            }
          }

          const uploaderJson =
            typeof (uploader as unknown as { toJSON?: unknown }).toJSON === "function"
              ? (uploader as unknown as { toJSON: () => unknown }).toJSON()
              : null;
          if (uploaderJson) {
            try {
              await idbPutUploadRecord({
                ...resumeRecord,
                payloadB64: bytesToB64(dataBytes),
                txId,
                uploaderRaw: uploaderJson,
                updatedAt: new Date().toISOString(),
              });
            } catch {
            }
          }

          const pct =
            typeof (uploader as unknown as { pctComplete?: unknown }).pctComplete === "number"
              ? (uploader as unknown as { pctComplete: number }).pctComplete
              : typeof (uploader as unknown as { uploadedChunks?: unknown }).uploadedChunks === "number" &&
                  typeof (uploader as unknown as { totalChunks?: unknown }).totalChunks === "number" &&
                  (uploader as unknown as { totalChunks: number }).totalChunks > 0
                ? ((uploader as unknown as { uploadedChunks: number }).uploadedChunks /
                    (uploader as unknown as { totalChunks: number }).totalChunks) *
                  100
                : 0;
          onProgress?.(Math.max(0, Math.min(100, pct)));
        }

        const lastStatus =
          typeof (uploader as unknown as { lastResponseStatus?: unknown }).lastResponseStatus === "number"
            ? (uploader as unknown as { lastResponseStatus: number }).lastResponseStatus
            : 0;
        if (lastStatus && lastStatus !== 200 && lastStatus !== 202) {
          throw new Error(`Failed to upload transaction to blockchain storage (Status: ${lastStatus})`);
        }

        onStatus?.("Upload successful.");
        try {
          await idbDeleteUploadRecord(resumeKey);
        } catch {
        }

        return { txId, type: "BASE" };
      } catch {
        return null;
      }
    };

    const resumed = await resumeIfPossible();
    if (resumed) return resumed;

    const transaction = await arweave.createTransaction({
      data: effectivePayloadBytes,
    });

    const defaultTags: Record<string, string> = {
      'Content-Type': isBinaryPayload ? 'application/octet-stream' : 'application/json',
      'App-Name': 'doc-storage',
      Type: isBinaryPayload ? 'bin' : 'doc',
      Ts: Date.now().toString(),
    };

    const mergedTags = { ...defaultTags, ...(tags || {}) };
    Object.entries(mergedTags).forEach(([name, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        transaction.addTag(name, value);
      }
    });
    
    // Add Doc-Id tag (obfuscated vault ID) required for lookup
    if (vaultId) {
      transaction.addTag('Doc-Id', vaultId);
    }

    onStatus?.("Waiting for wallet signature...");
    if (!transaction.last_tx || transaction.last_tx.length < 43) {
      (transaction as unknown as { last_tx: string }).last_tx =
        await arweave.transactions.getTransactionAnchor();
    }
    if (!transaction.reward || transaction.reward === "0") {
      transaction.reward = await arweave.transactions.getPrice(effectivePayloadBytes.byteLength);
    }
    onStatus?.("Preparing upload (chunking data)...");
    await transaction.prepareChunks(effectivePayloadBytes);
    onStatus?.("Waiting for wallet signature...");

    const wallet = getArweaveWallet();
    if (!wallet) {
      throw new Error('Wallet not connected. Please connect your wallet to proceed.');
    }

    if (effectivePayloadBytes.byteLength <= 250_000 && typeof wallet.dispatch === "function") {
      onStatus?.("Waiting for wallet confirmation...");
      const dispatched = await wallet.dispatch(transaction as unknown as never);
      onProgress?.(100);
      onStatus?.("Upload successful.");
      return {
        txId: dispatched.id,
        type: typeof dispatched.type === "string" && dispatched.type.trim().length > 0 ? dispatched.type : "DISPATCH",
      };
    }

    const signedRaw = (await wallet.sign(transaction)) as unknown;
    if (!signedRaw || typeof signedRaw !== "object") {
      throw new Error("Wallet signature response is invalid");
    }

    const normalizeB64Url = (value: string) =>
      value.trim().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    const signed = signedRaw as Record<string, unknown>;
    const signedNormalized: Record<string, unknown> = { ...signed };
    for (const key of ["id", "owner", "signature", "last_tx", "data_root"]) {
      const v = signedNormalized[key];
      if (typeof v === "string") {
        signedNormalized[key] = normalizeB64Url(v);
      }
    }

    const signedTx = arweave.transactions.fromRaw(signedNormalized);

    (transaction as unknown as { last_tx: string }).last_tx = signedTx.last_tx;
    transaction.reward = signedTx.reward || transaction.reward;
    transaction.data_root = signedTx.data_root || transaction.data_root;
    transaction.setSignature({
      id: signedTx.id,
      owner: signedTx.owner,
      reward: signedTx.reward,
      tags: signedTx.tags,
      signature: signedTx.signature,
    });

    const txToPost = transaction;

    try {
      const isValid = await arweave.transactions.verify(txToPost);
      if (!isValid) {
        throw new Error("verify() returned false");
      }
    } catch (e) {
      throw new Error(
        `Arweave signature verification failed (client-side): ${
          e instanceof Error ? e.message : "Unknown error"
        }`,
      );
    }

    // 3. Post transaction to the network
    onStatus?.("Uploading to Arweave...");
    const txRawForResume =
      typeof (txToPost as unknown as { toJSON?: unknown }).toJSON === "function"
        ? (txToPost as unknown as { toJSON: () => unknown }).toJSON()
        : (txToPost as unknown as { getRaw?: unknown }).getRaw && typeof (txToPost as unknown as { getRaw: () => unknown }).getRaw === "function"
          ? (txToPost as unknown as { getRaw: () => unknown }).getRaw()
          : null;

    const baseRecord: ArweaveUploadResumeRecord = {
      key: resumeKey,
      vaultId,
      payloadHash,
      payloadB64: bytesToB64(effectivePayloadBytes),
      txRaw: txRawForResume ?? undefined,
      txId: txToPost.id,
      uploaderRaw: undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await idbPutUploadRecord(baseRecord);
    } catch {
    }
    onStatus?.("Uploading to Arweave (relay)...");
    onProgress?.(0);

    const relayBody = {
      txRaw: txRawForResume ?? signedNormalized,
      dataB64: baseRecord.payloadB64,
    };

    if (typeof EventSource === "undefined") {
      const relayResponse = await postJsonWithUploadProgress<{
        success?: unknown;
        error?: unknown;
        txId?: unknown;
      }>({ url: `/api/transactions/arweave/relay`, body: relayBody, onProgress });

      const relayData = relayResponse.data;
      if (!relayResponse.ok || !relayData?.success) {
        const message =
          typeof relayData?.error === "string"
            ? relayData.error
            : `Arweave relay failed (HTTP ${relayResponse.status})`;
        throw new Error(message);
      }

      const relayedTxId =
        typeof relayData?.txId === "string" && relayData.txId.trim().length > 0
          ? relayData.txId.trim()
          : txToPost.id;

      onStatus?.("Upload successful.");
      try {
        await idbDeleteUploadRecord(resumeKey);
      } catch {
      }
      return {
        txId: relayedTxId,
        type: "BASE",
      };
    }

    let clientPct = 0;
    let serverPct = 0;
    const emitCombinedProgress = (forceComplete = false) => {
      if (!onProgress) return;
      if (forceComplete) {
        onProgress(100);
        return;
      }
      const combined = clientPct * 0.2 + serverPct * 0.8;
      onProgress(Math.max(0, Math.min(99.9, combined)));
    };

    const startResponse = await postJsonWithUploadProgress<{
      success?: unknown;
      error?: unknown;
      jobId?: unknown;
    }>({
      url: `/api/transactions/arweave/relay/start`,
      body: relayBody,
      onProgress: (pct) => {
        clientPct = pct;
        emitCombinedProgress();
      },
    });

    const startData = startResponse.data;
    if (!startResponse.ok || !startData?.success) {
      const message =
        typeof startData?.error === "string"
          ? startData.error
          : `Arweave relay start failed (HTTP ${startResponse.status})`;
      throw new Error(message);
    }

    const jobId = typeof startData?.jobId === "string" ? startData.jobId.trim() : "";
    if (!jobId) {
      throw new Error("Arweave relay start failed: missing jobId");
    }

    const relayedTxId = await new Promise<string>((resolve, reject) => {
      const es = new EventSource(`/api/transactions/arweave/relay/${encodeURIComponent(jobId)}/events`);

      const finalize = (err?: Error, txId?: string) => {
        try {
          es.close();
        } catch {
        }
        if (err) reject(err);
        else resolve(txId || txToPost.id);
      };

      const handlePayload = (raw: string) => {
        try {
          const payload = JSON.parse(raw) as {
            progress?: unknown;
            status?: unknown;
            txId?: unknown;
            error?: unknown;
          };
          if (typeof payload.status === "string") onStatus?.(payload.status);
          if (typeof payload.progress === "number") {
            serverPct = payload.progress;
            emitCombinedProgress();
          }
          return payload;
        } catch {
          return null;
        }
      };

      es.addEventListener("progress", (event) => {
        const raw = (event as MessageEvent).data;
        if (typeof raw !== "string") return;
        handlePayload(raw);
      });

      es.addEventListener("complete", (event) => {
        const raw = (event as MessageEvent).data;
        if (typeof raw !== "string") {
          emitCombinedProgress(true);
          finalize(undefined, txToPost.id);
          return;
        }
        const payload = handlePayload(raw);
        emitCombinedProgress(true);
        const txId = payload && typeof payload.txId === "string" ? payload.txId : txToPost.id;
        finalize(undefined, txId);
      });

      es.addEventListener("error", (event) => {
        const raw = (event as MessageEvent).data;
        if (typeof raw !== "string") {
          finalize(new Error("Arweave relay connection failed."));
          return;
        }
        const payload = handlePayload(raw);
        const message =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Arweave relay failed";
        finalize(new Error(message));
      });
    });

    onStatus?.("Upload successful.");
    try {
      await idbDeleteUploadRecord(resumeKey);
    } catch {
    }
    return {
      txId: relayedTxId,
      type: "BASE",
    };

  } catch (error) {
    console.error('Dispatch error:', error);
    if ((error as Error).message?.includes('User cancelled')) {
      throw new Error('Transaction was cancelled.');
    }
    throw new Error(`Failed to dispatch to blockchain storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function dispatchBitxenIndexToArweave(params: {
  vaultId: string;
  contentTxId: string;
  chainKey: string;
  chainId: number;
  contractAddress: string;
  contractDataId: string;
}): Promise<DispatchResult> {
  const safeVaultId = typeof params.vaultId === "string" ? params.vaultId.trim() : "";
  if (!safeVaultId) {
    throw new Error("Vault ID is required");
  }

  const doc = {
    schema: "bitxen-index-v1",
    vaultId: safeVaultId,
    storageType: "bitxenArweave",
    bitxen: {
      chainId: params.chainId,
      chainKey: params.chainKey,
      contractAddress: params.contractAddress,
      contractDataId: params.contractDataId,
    },
    arweave: {
      contentTxId: params.contentTxId,
    },
  };

  return dispatchToArweave(doc, safeVaultId, { Type: "bitxen-index" });
}

/**
 * Check transaction status from Arweave
 */
export interface TransactionStatus {
  status: number;
  confirmed: {
    block_height: number;
    block_indep_hash: string;
    number_of_confirmations: number;
  } | null;
}

export async function checkTransactionStatus(txId: string): Promise<TransactionStatus> {
  try {
    const status = await arweave.transactions.getStatus(txId);
    return status;
  } catch (error) {
    console.error('Failed to check transaction status:', error);
    throw new Error('Failed to check transaction status.');
  }
}

// Legacy exports for backward compatibility
export const WANDER_PAYMENT_CONFIG = {
  fees: {
    basicVault: 'auto', // Automatic fee from Arweave
  },
  permissions: WANDER_CONFIG.permissions,
  appInfo: WANDER_CONFIG.appInfo,
};

// Legacy function - no longer does payment, just checks wallet is ready
export async function sendArPayment(): Promise<{ status: 'pending' }> {
  // No separate payment needed - fee handled by Arweave during dispatch
  const isReady = await isWalletReady();
  if (!isReady) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  return { status: 'pending' };
}
