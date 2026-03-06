// Wander Wallet (ArConnect) integration library
// Wander is a browser wallet for Arweave - https://wander.app
// Arweave fee for storage is automatically handled during transaction dispatch
//
// HYBRID MODE:
// - If browser extension is available → use extension
// - If not (mobile browser) → fallback to Wander Connect SDK (embedded wallet)

import Arweave from 'arweave';

const WANDER_STORAGE_KEY = 'bitxen_wander_address';

// Re-export upload utilities from the dedicated module for consumers
// who prefer importing from a single wallet entry point.
export {
  postJsonWithUploadProgress,
  listenRelayJobEvents,
  type UploadRecord,
  type FetchWithProgressResult,
  type RelayJobPayload,
} from "./arweave-upload";

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
 * Initialize Wander Connect SDK silently (in background)
 * This injects `window.arweaveWallet` without forcing the popup to open
 */
export async function silentlyInitializeWanderConnect(): Promise<void> {
  if (typeof window === 'undefined') return;
  // If native extension is present, we don't need to do anything
  if (getArweaveWallet() && !wanderConnectInstance) {
    return;
  }

  // Ensure script is loaded
  if (!window.WanderSDK) {
    if (!document.querySelector('script[src="/wander-connect.js"]')) {
      preloadWanderConnect();
    }
    // Wait for the script to load
    await new Promise<void>((resolve) => {
      let retries = 0;
      const check = setInterval(() => {
        if (window.WanderSDK || retries > 50) {
          clearInterval(check);
          resolve();
        }
        retries++;
      }, 100);
    });
  }

  if (window.WanderSDK && window.WanderSDK.WanderConnect) {
    if (!wanderConnectInstance) {
      wanderConnectInstance = new window.WanderSDK.WanderConnect({
        clientId: WANDER_CONFIG.clientId,
      });
      // Give the SDK a moment to inject window.arweaveWallet via its iframe
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

/**
 * Initialize Wander Connect SDK (embedded wallet)
 * This is used when browser extension is not available (e.g., mobile browser)
 */
export async function initializeWanderConnect(): Promise<string> {
  // Early return hanya jika wallet SUDAH connect (punya permission ACCESS_ADDRESS).
  // Jangan early return hanya karena window.arweaveWallet ada — Wander Connect SDK
  // meng-inject arweaveWallet saat iframe load, sebelum user approve connection.
  if (wanderConnectInstance && getArweaveWallet()) {
    try {
      const permissions = await getArweaveWallet()!.getPermissions();
      if (permissions.includes('ACCESS_ADDRESS')) {
        const address = await getArweaveWallet()!.getActiveAddress();
        if (address) {
          currentConnectionMode = 'connect';
          return address;
        }
      }
      // Wallet ada tapi belum approve — lanjut buka popup
    } catch {
      // Failed to check permissions. Continue to re-init.
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

  // Create new Wander Connect instance hanya jika belum ada
  if (!wanderConnectInstance) {
    wanderConnectInstance = new window.WanderSDK.WanderConnect({
      clientId: WANDER_CONFIG.clientId,
    });
  }

  // Wait for wallet loaded event — dengan cancel detection
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Bersihkan semua resource dan settle promise satu kali saja
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('arweaveWalletLoaded', handleWalletLoaded);
      fn();
    };

    // Timeout 5 menit
    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Wander Connect initialization timed out. Please try again.')));
    }, 5 * 60 * 1000);

    // Cek apakah dialog ditutup user (cancelled)
    // Walaupun Promise dari wallet.connect() hang, kita bs detect via getter isOpen:
    //   1. Tunggu isOpen === true  (konfirmasi popup benar-benar terbuka)
    //   2. Jika lalu jadi false    (user tutup X)  → reject → dialog reopen
    setTimeout(() => {
      let confirmedOpen = false;

      pollInterval = setInterval(() => {
        if (settled) { clearInterval(pollInterval!); return; }

        // WanderConnect.isOpen adalah getter: return this.openReason !== null
        // Saat user tutup popup (X button), SDK set openReason = null → isOpen = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isOpenNow = (wanderConnectInstance as any)?.isOpen === true;

        if (isOpenNow) {
          confirmedOpen = true; // popup terbuka terkonfirmasi
        } else if (confirmedOpen) {
          // Dulu terbuka, sekarang tidak → user menutup popup
          finish(() => reject(new Error('Wander wallet connection was cancelled.')));
        }
      }, 300);
    }, 600);

    // Handler saat arweaveWallet siap (Wander SDK inject wallet ke window)
    const handleWalletLoaded = async (_e?: Event) => {
      try {
        const wallet = getArweaveWallet();
        if (!wallet) {
          finish(() => reject(new Error('Wallet not available after initialization.')));
          return;
        }

        console.log('[Wander Wallet] Calling wallet.connect()...');
        // wallet.connect() mengirim pesan ke iframe SDK dengan hasNewConnectRequest=true.
        // Karena instance selalu fresh di mobile (di-destroy sebelumnya),
        // SDK akan otomatis memanggil _open("embedded_request") → halaman konfirmasi.
        const connectPromise = wallet.connect(WANDER_CONFIG.permissions, WANDER_CONFIG.appInfo);

        // Tambahkan fallback timeout 3 detik untuk mobile jika SDK gagal auto-open.
        // Terkadang saat fresh instance, pesannya terlalu cepat sebelum iframe siap,
        // sehingga SDK tidak pernah auto-membuka panel.
        const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          await new Promise<void>((res) => {
            let elapsed = 0;
            const check = setInterval(() => {
              elapsed += 100;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sdk = wanderConnectInstance as any;

              if (sdk?.isOpen) {
                console.log('[Wander Wallet] SDK auto-opened successfully.');
                clearInterval(check);
                res();
              } else if (elapsed > 3000) {
                console.warn('[Wander Wallet] SDK failed to auto-open after 3s. Applying fallback .open().');
                if (typeof sdk?.open === 'function') {
                  try { sdk.open(); } catch (e) { /* ignore */ }
                }
                clearInterval(check);
                res();
              }
            }, 100);
          });
        }

        await connectPromise;
        console.log('[Wander Wallet] wallet.connect() resolved.'); const address = await wallet.getActiveAddress();
        if (address) {
          currentConnectionMode = 'connect';

          // Close UI if it's still open (sometimes hanging when auto-approved)
          if (wanderConnectInstance) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (wanderConnectInstance as any).close();
            } catch (e) {
              console.warn('Failed to close Wander Connect UI:', e);
            }
          }

          finish(() => resolve(address));
        } else {
          finish(() => reject(new Error('Unable to get wallet address.')));
        }
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    };

    // Cek apakah extension atau instance SDK yang sudah ready
    const isExtension = getArweaveWallet() && !wanderConnectInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkReady = wanderConnectInstance && (wanderConnectInstance as any).isWalletReady;

    if (isExtension || sdkReady) {
      // Jika wallet sudah siap (extension native, ATAU SDK iframe sudah terisi),
      // event 'arweaveWalletLoaded' tidak akan ter-dispatch lagi.
      // Maka kita langsung eksekusi handler-nya:
      handleWalletLoaded();
    } else {
      window.addEventListener('arweaveWalletLoaded', handleWalletLoaded as EventListener);
    }
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

    // PENTING: Jika kita menghancurkan instance SDK (misalnya karena kita butuh fresh state di mobile),
    // kita HARUS menghapus `window.arweaveWallet` yang di-inject oleh SDK sebelumnya.
    // Alasannya: konstruktor WanderConnect SDK memiliki bug/fitur dimana jika `window.arweaveWallet`
    // sudah ada (dari instance lama), ia TIDAK akan me-re-inject API, sehingga metode wallet.connect()
    // akan mencoba mengirim postMessage ke Iframe yang sudah dihancurkan (hang/dead).
    if (typeof window !== 'undefined' && 'arweaveWallet' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).arweaveWallet;
      } catch (e) {
        // Fallback jika tidak bisa di-delete
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).arweaveWallet = undefined;
      }
    }
  }
}

/**
 * Connect to Wander Wallet
 * - Uses browser extension if available
 * - Falls back to Wander Connect (embedded wallet) if not
 */
export async function connectWanderWallet(): Promise<string> {
  // PENTING: Jika wanderConnectInstance sudah ada, berarti kita sudah tahu
  // wallet ini adalah Wander Connect SDK (bukan native extension). Bypass
  // isWanderWalletInstalled() check karena SDK meng-inject window.arweaveWallet
  // saat iframe load pertama, sehingga cek itu akan selalu true setelah attempt
  // pertama — menyebabkan attempt ke-2 masuk ke path extension yg salah (hang).
  if (wanderConnectInstance) {
    // Pada mobile, silentlyInitializeWanderConnect() (dari auto-recovery) membuat
    // instance dengan state internal (authInfo, openReason, dll) yang terkontaminasi.
    // Akibatnya, wallet.connect() di dalam initializeWanderConnect() langsung resolve
    // tanpa memunculkan halaman konfirmasi — user malah melihat dashboard.
    // Solusi: destroy instance lama agar initializeWanderConnect() buat fresh instance.
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      // Destroy staled instance, then fall through to re-initialize below
      // but we MUST bypass the extension check because window.arweaveWallet 
      // is still globally defined by the now-dead SDK.
      await destroyWanderConnect();

      const address = await initializeWanderConnect();
      if (typeof localStorage !== 'undefined') localStorage.setItem(WANDER_STORAGE_KEY, address);
      return address;
    } else {
      const address = await initializeWanderConnect();
      if (typeof localStorage !== 'undefined') localStorage.setItem(WANDER_STORAGE_KEY, address);
      return address;
    }
  }

  // Pertama kali: jika native extension tersedia, gunakan extension
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
      if (typeof localStorage !== 'undefined') localStorage.setItem(WANDER_STORAGE_KEY, address);
      return address;
    } catch (error) {
      if ((error as Error).message?.includes('User cancelled')) {
        throw new Error('Connection request was cancelled.');
      }
      throw new Error(`We couldn't connect to Wander Wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // No extension available, use Wander Connect (embedded wallet)
  const address = await initializeWanderConnect();
  if (typeof localStorage !== 'undefined') localStorage.setItem(WANDER_STORAGE_KEY, address);
  return address;
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

  // Auto-recovery fallback via localStorage
  if (typeof localStorage !== 'undefined') {
    const savedAddress = localStorage.getItem(WANDER_STORAGE_KEY);
    if (savedAddress) {
      // Silently init WanderConnect so window.arweaveWallet becomes available for future dispatch
      try {
        await silentlyInitializeWanderConnect();
      } catch (e) {
        console.warn('Silent init failed', e);
      }
      currentConnectionMode = wanderConnectInstance ? 'connect' : (getArweaveWallet() ? 'extension' : 'none');
      return savedAddress;
    }
  }

  return null;
}

/**
 * Disconnect from Wander Wallet
 */
export async function disconnectWanderWallet(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(WANDER_STORAGE_KEY);
  }
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

    // Auto-recovery check
    if (typeof localStorage !== 'undefined' && localStorage.getItem(WANDER_STORAGE_KEY)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

import { formatWalletAddress, sleep } from './crypto-utils';
export { formatWalletAddress };

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

    let wallet = getArweaveWallet();
    if (!wallet) {
      // Attempt silent recovery initialization before throwing
      if (typeof localStorage !== 'undefined' && localStorage.getItem(WANDER_STORAGE_KEY)) {
        await silentlyInitializeWanderConnect();
        wallet = getArweaveWallet();
      }

      if (!wallet) {
        throw new Error('Wallet not connected. Please connect your wallet to proceed.');
      }
    }

    // Force direct transaction for all sizes to ensure instant visibility on gateway
    // if (effectivePayloadBytes.byteLength <= 250_000 && typeof wallet.dispatch === "function") {
    //   onStatus?.("Waiting for wallet confirmation...");
    //   const dispatched = await wallet.dispatch(transaction as unknown as never);
    //   onProgress?.(100);
    //   onStatus?.("Upload successful.");
    //   return {
    //     txId: dispatched.id,
    //     type: typeof dispatched.type === "string" && dispatched.type.trim().length > 0 ? dispatched.type : "DISPATCH",
    //   };
    // }

    // wallet.sign() mutates the transaction object in-place (ArConnect/Wander behavior).
    // We just call it and continue using the same `transaction` object.
    // Do NOT rebuild the transaction from raw JSON — that would corrupt the chunk tree
    // prepared by prepareChunks() and cause arweave.transactions.verify() to fail.
    await wallet.sign(transaction);

    const txToPost = transaction;

    try {
      const isValid = await arweave.transactions.verify(txToPost);
      if (!isValid) {
        throw new Error("verify() returned false");
      }
    } catch (e) {
      throw new Error(
        `Arweave signature verification failed (client-side): ${e instanceof Error ? e.message : "Unknown error"
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
      txRaw: txRawForResume,
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
