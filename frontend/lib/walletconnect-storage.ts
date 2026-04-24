/**
 * walletconnect-storage.ts
 *
 * Utility untuk mendeteksi dan membersihkan sisa session WalletConnect V2 yang sudah
 * tidak valid (stale) dari browser storage.
 *
 * Stale session umumnya terjadi karena:
 *  - URL origin berubah (misal Ngrok URL berganti setiap restart dev)
 *  - Session di relay server sudah expired tapi data lokal belum dihapus
 *  - Konflik antara localStorage lama dan cookieStorage baru
 *
 * Error khas yang muncul:
 *  "No matching key. session topic doesn't exist: <topic_id>"
 *  "No matching key. pairing topic doesn't exist: <topic_id>"
 */

const WC_STORAGE_PREFIXES = [
    "wc@2:",           // WalletConnect SignClient internal
    "wagmi.",          // Wagmi connector state
    "W3M_",            // Web3Modal internal
    "@w3m/",           // Web3Modal v5 internal
    "WALLETCONNECT_",  // Legacy WC v1 (safe to clear)
];

/**
 * Hapus semua entry WalletConnect V2 dari localStorage.
 * Return jumlah key yang dihapus.
 */
export function clearWalletConnectStorage(): number {
    if (typeof window === "undefined") return 0;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && WC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore quota/security errors
        }
    });

    if (keysToRemove.length > 0) {
        console.info(
            `[WalletConnect] Cleared ${keysToRemove.length} stale storage keys:`,
            keysToRemove
        );
    }

    return keysToRemove.length;
}

/**
 * Deteksi apakah sebuah error message merupakan WalletConnect stale session error.
 */
export function isWalletConnectStaleSessionError(error: unknown): boolean {
    const msg =
        error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : "";

    return (
        msg.includes("session topic doesn't exist") ||
        msg.includes("pairing topic doesn't exist") ||
        msg.includes("No matching key") ||
        msg.includes("Pairing already exists") ||
        msg.includes("Missing or invalid") ||
        msg.includes("Session not found")
    );
}
