"use client";

/**
 * Web3ModalProvider
 *
 * Client-side provider yang menginisialisasi Web3Modal (Reown AppKit) + Wagmi.
 * Wajib membungkus komponen yang menggunakan hook wagmi atau <w3m-button />.
 *
 * Letakkan di app/layout.tsx sebagai wrapper global.
 *
 * Fitur tambahan:
 *  - Auto-clear stale WalletConnect V2 sessions saat startup.
 *    Stale session terjadi ketika URL origin berubah (misal Ngrok restart)
 *    atau session di relay server sudah expired. Tanpa ini, error
 *    "session topic doesn't exist" akan muncul setiap kali reconnect.
 */

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { ReactNode, useState, useEffect } from "react";

import {
    wagmiAdapter,
    wagmiConfig,
    projectId,
    supportedChains,
    web3ModalMetadata,
} from "@/lib/web3modal-config";
import {
    clearWalletConnectStorage,
} from "@/lib/walletconnect-storage";

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

    // Bersihkan stale WalletConnect sessions saat pertama kali komponen dimount.
    // Ini mencegah error "session topic doesn't exist" yang terjadi ketika URL
    // origin berubah (Ngrok restart) atau relay server session sudah expired.
    //
    // Catatan: Kita HANYA clear ketika ada indikasi session stale (ada key WC di
    // localStorage), bukan setiap waktu, agar tidak mengganggu session yang valid.
    useEffect(() => {
        try {
            // Cek apakah ada WC session di localStorage yang mungkin konflik
            // dengan cookieStorage yang sekarang kita gunakan sebagai primary storage.
            const hasLegacyWcStorage = Array.from({ length: localStorage.length }, (_, i) =>
                localStorage.key(i) ?? ""
            ).some((key) => key.startsWith("wc@2:") || key.startsWith("wagmi.store"));

            if (hasLegacyWcStorage) {
                const cleared = clearWalletConnectStorage();
                if (cleared > 0) {
                    console.info(
                        "[Web3ModalProvider] Cleared stale WalletConnect sessions from localStorage.",
                        "Reload may be needed if wallet appears disconnected."
                    );
                }
            }
        } catch {
            // Abaikan jika localStorage tidak tersedia (SSR, private mode, dll)
        }
    }, []);

    return (
        <WagmiProvider config={wagmiConfig} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}
