"use client";

/**
 * Web3ModalProvider
 *
 * Client-side provider yang menginisialisasi Web3Modal (Reown AppKit) + Wagmi.
 * Wajib membungkus komponen yang menggunakan hook wagmi atau <w3m-button />.
 *
 * Letakkan di app/layout.tsx sebagai wrapper global.
 *
 * Catatan:
 *  - Auto-clear WalletConnect storage saat startup dihapus karena menyebabkan
 *    session WalletConnect dihapus saat redirect balik dari MetaMask mobile.
 */

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { ReactNode, useState } from "react";

import {
    wagmiAdapter,
    wagmiConfig,
    projectId,
    supportedChains,
    web3ModalMetadata,
} from "@/lib/web3modal-config";

// createAppKit harus dipanggil di luar komponen agar tidak dipanggil ulang saat re-render
console.log(
    "[Reown AppKit] Initializing with origin:",
    typeof window !== "undefined" ? window.location.origin : "(SSR)",
    "| projectId:", projectId ? projectId.slice(0, 8) + "..." : "(MISSING)",
    "| metadata.url:", web3ModalMetadata.url
);

createAppKit({
    adapters: [wagmiAdapter],
    networks: supportedChains,
    projectId,
    // Tampilkan hanya chain yang relevan untuk Bitxen
    // BSC ada di urutan pertama karena itu chain utama Bitxen
    defaultNetwork: supportedChains[0],
    metadata: web3ModalMetadata,
    // Theming
    themeMode: "dark",
    themeVariables: {
        // Sesuaikan warna modal dengan tema Bitxen
        "--w3m-accent": "#7c3aed", // purple-700 sesuai warna Wander
        "--w3m-border-radius-master": "12px",
    },
    // Fitur tambahan
    featuredWalletIds: [
        // MetaMask
        "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
        // Trust Wallet
        "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
    ],
    // Nonaktifkan fitur yang tidak relevan
    features: {
        analytics: false,
        onramp: false,
        swaps: false,
    }
});

interface Web3ModalProviderProps {
    children: ReactNode;
    initialState?: State;
}

export function Web3ModalProvider({
    children,
    initialState,
}: Web3ModalProviderProps) {
    // QueryClient untuk TanStack Query (diperlukan oleh Wagmi v3)
    const [queryClient] = useState(() => new QueryClient());

    // NOTE: Auto-clear WalletConnect storage dihapus karena menyebabkan session
    // dihapus saat redirect balik dari MetaMask mobile (halaman remount → wc@2:*
    // terhapus → wallet kelihatan disconnected).
    // clearWalletConnectStorage() tetap tersedia untuk dipanggil manual saat ada
    // error "session topic doesn't exist" yang terdeteksi secara eksplisit.

    return (
        <WagmiProvider config={wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}
