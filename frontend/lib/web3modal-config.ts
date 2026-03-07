/**
 * web3modal-config.ts
 *
 * Konfigurasi terpusat untuk Web3Modal v5 + Wagmi v3.
 *
 * Chain yang didukung disesuaikan dengan CHAIN_CONFIG di lib/chains.ts:
 *  - BSC Testnet (development)
 *  - BSC Mainnet
 *  - Ethereum Mainnet
 *  - Polygon Mainnet
 *  - Base Mainnet
 *  - Arbitrum One
 *
 * Cara mendapatkan Project ID:
 *  1. Buka https://cloud.walletconnect.com
 *  2. Buat project baru
 *  3. Salin Project ID ke .env.local sebagai NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
 */

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
    mainnet,
    polygon,
    bsc,
    bscTestnet,
    base,
    arbitrum,
} from "@reown/appkit/networks";

// WalletConnect Project ID — WAJIB diisi dari environment variable
export const projectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

if (!projectId && typeof window !== "undefined") {
    console.warn(
        "[Web3Modal] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set.\n" +
        "Get your free Project ID at: https://cloud.walletconnect.com"
    );
}

// Metadata aplikasi yang ditampilkan di dalam dompet saat user connect.
export const web3ModalMetadata = {
    name: "Bitxen",
    description: "Digital Inheritance & Crypto Gifting Platform",
    url:
        typeof window !== "undefined"
            ? window.location.origin
            : "https://bitxen.com",
    icons: ["https://bitxen.com/icon.png"],
};

// Chains yang didukung sesuai dengan CHAIN_CONFIG di lib/chains.ts
export const supportedChains = [
    bscTestnet, // Development
    bsc,        // Production utama Bitxen
    mainnet,    // Ethereum
    polygon,
    base,
    arbitrum,
] as [any, ...any[]];

// Wagmi config menggunakan WagmiAdapter dari Reown AppKit
// Ini secara otomatis menambahkan WalletConnect, MetaMask, Coinbase connectors
import { cookieStorage, createStorage } from "wagmi";

export const wagmiAdapter = new WagmiAdapter({
    storage: createStorage({
        storage: cookieStorage
    }),
    ssr: true,
    projectId,
    networks: supportedChains
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
