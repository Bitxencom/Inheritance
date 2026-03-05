"use client";

/**
 * MobileWalletModal (Web3Modal + Wander Edition)
 *
 * Universal Wallet Modal yang menggabungkan:
 *  - EVM Wallets (MetaMask, Trust, Coinbase, 500+ wallets) via Web3Modal v5
 *  - Arweave via Wander Connect SDK
 *
 * Arsitektur:
 *  ┌─────────────────────────────────────────────────┐
 *  │           Universal Wallet Modal                │
 *  │                                                 │
 *  │  EVM Chains (BSC, ETH, Polygon…)                │
 *  │   └─ Web3Modal Button → 500+ wallets            │
 *  │       ├─ MetaMask (metamask.app.link)            │
 *  │       ├─ Trust Wallet (trustwallet.app.link)    │
 *  │       ├─ Coinbase (coinbasewallet://)           │
 *  │       └─ WalletConnect QR code                  │
 *  │                                                 │
 *  │  Arweave                                        │
 *  │   └─ Wander Wallet (WanderConnect SDK)          │
 *  └─────────────────────────────────────────────────┘
 */

import { useState } from "react";
import Image from "next/image";
import {
    Loader2,
    ChevronRight,
    Wallet,
    ArrowRight,
    CheckCircle2,
} from "lucide-react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
    connectWanderWallet,
    isWalletReady as isWanderReady,
    isWanderWalletInstalled,
} from "@/lib/wanderWallet";
import WanderLogo from "@/assets/logo/wander.svg";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface MobileWalletModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Dipanggil setelah Wander berhasil connect */
    onWanderConnected?: (address: string) => void;
    /** Dipanggil setelah EVM wallet berhasil connect via Web3Modal */
    onEvmConnected?: (address: string) => void;
    /**
     * Mode koneksi:
     * - "evm-only"     : Hanya menampilkan Web3Modal button
     * - "arweave-only" : Hanya menampilkan Wander button
     * - "both"         : Menampilkan keduanya (default, untuk mode hybrid)
     */
    mode?: "evm-only" | "arweave-only" | "both";
}

// -------------------------------------------------------------------
// MobileWalletModal component
// -------------------------------------------------------------------

export function MobileWalletModal({
    open,
    onOpenChange,
    onWanderConnected,
    onEvmConnected,
    mode = "both",
}: MobileWalletModalProps) {
    const { open: openWeb3Modal } = useWeb3Modal();
    const { address: evmAddress, isConnected: isEvmConnected } = useAccount();

    const [isConnectingWander, setIsConnectingWander] = useState(false);
    const [isConnectingEvm, setIsConnectingEvm] = useState(false);
    const [wanderAddress, setWanderAddress] = useState<string | null>(null);
    const [wanderError, setWanderError] = useState<string | null>(null);

    const showEvm = mode === "evm-only" || mode === "both";
    const showArweave = mode === "arweave-only" || mode === "both";

    // Handle klik tombol EVM — membuka Web3Modal (500+ wallets, deep link, QR)
    const handleEvmConnect = async () => {
        setIsConnectingEvm(true);
        try {
            await openWeb3Modal();
            // Web3Modal bersifat modal terpisah.
            // useWeb3ModalAccount() akan auto-update ketika user memilih wallet.
            // Setelah modal ditutup, cek apakah address tersedia.
            if (evmAddress) {
                onEvmConnected?.(evmAddress);
            }
        } finally {
            setIsConnectingEvm(false);
        }
    };

    // Handle klik tombol Wander
    const handleWanderConnect = async () => {
        setWanderError(null);
        setIsConnectingWander(true);
        try {
            // Implement deep linking fallback to Wander app for mobile devices
            if (typeof window !== 'undefined' && !isWanderWalletInstalled() && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
                const currentHostPath = window.location.host + window.location.pathname;
                window.location.href = `https://wander.app/dapp/${currentHostPath}`;
                return;
            }

            const alreadyReady = await isWanderReady();
            if (alreadyReady) {
                const { getConnectedAddress } = await import("@/lib/wanderWallet");
                const addr = await getConnectedAddress();
                if (addr) {
                    setWanderAddress(addr);
                    onWanderConnected?.(addr);
                    onOpenChange(false);
                    return;
                }
            }
            const address = await connectWanderWallet();
            setWanderAddress(address);
            onWanderConnected?.(address);
            onOpenChange(false);
        } catch (err) {
            setWanderError(
                err instanceof Error ? err.message : "Failed to connect Wander Wallet"
            );
        } finally {
            setIsConnectingWander(false);
        }
    };

    // Setelah EVM wallet connect via Web3Modal, beritahu parent dan tutup modal
    const handleEvmConfirm = () => {
        if (evmAddress) {
            onEvmConnected?.(evmAddress);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
                <DialogHeader className="px-5 pt-5 pb-3">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Wallet className="h-4 w-4 text-primary" />
                        Connect Wallet
                    </DialogTitle>
                    <DialogDescription className="text-xs leading-relaxed">
                        {mode === "both"
                            ? "Connect both wallets to complete the hybrid payment. EVM wallet is used for the Bitxen smart contract, Wander for Arweave storage."
                            : mode === "evm-only"
                                ? "Connect your EVM wallet (MetaMask, Trust Wallet, etc.) to interact with the Bitxen smart contract."
                                : "Connect your Wander wallet to upload data to Arweave."}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 pb-5 space-y-4">
                    {/* ─── EVM WALLET — Web3Modal Button ─── */}
                    {showEvm && (
                        <div className="space-y-2">
                            {mode === "both" && (
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                                    EVM Chains (BSC · ETH · Polygon · Base · Arbitrum)
                                </p>
                            )}

                            {isEvmConnected && evmAddress ? (
                                /* Sudah connect — tampilkan info dan tombol konfirmasi */
                                <div className="rounded-xl border border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20 p-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                                EVM Wallet Connected
                                            </p>
                                            <p className="text-xs font-mono text-muted-foreground truncate">
                                                {evmAddress}
                                            </p>
                                        </div>
                                        {mode !== "both" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleEvmConfirm}
                                                className="flex-shrink-0 h-7 text-xs"
                                            >
                                                Use
                                                <ArrowRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Belum connect — tombol Web3Modal */
                                <button
                                    onClick={handleEvmConnect}
                                    disabled={isConnectingEvm}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl",
                                        "border border-border bg-card",
                                        "hover:bg-muted/60 hover:border-primary/40 transition-all",
                                        "text-left disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {/* Logo grid kecil mewakili banyak wallet */}
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex-shrink-0 flex items-center justify-center shadow-sm">
                                        <Wallet className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">
                                            {isConnectingEvm ? "Opening…" : "Connect EVM Wallet"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            MetaMask · Trust · Coinbase · 500+ wallets
                                        </p>
                                    </div>
                                    {isConnectingEvm ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Divider */}
                    {showEvm && showArweave && (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                and
                            </span>
                            <div className="flex-1 h-px bg-border" />
                        </div>
                    )}

                    {/* ─── ARWEAVE — Wander Wallet ─── */}
                    {showArweave && (
                        <div className="space-y-2">
                            {mode === "both" && (
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                                    Arweave
                                </p>
                            )}

                            {wanderAddress ? (
                                /* Sudah connect */
                                <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20 p-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="h-5 w-5 text-purple-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                                                Wander Connected
                                            </p>
                                            <p className="text-xs font-mono text-muted-foreground truncate">
                                                {wanderAddress}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Belum connect */
                                <button
                                    onClick={handleWanderConnect}
                                    disabled={isConnectingWander}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl",
                                        "border border-purple-200 bg-purple-50/30 dark:border-purple-900/50 dark:bg-purple-950/10",
                                        "hover:bg-purple-100/60 hover:border-purple-400 dark:hover:bg-purple-900/30 transition-all",
                                        "text-left disabled:opacity-60 disabled:cursor-not-allowed"
                                    )}
                                >
                                    <div className="h-10 w-10 rounded-full bg-white dark:bg-purple-900 flex-shrink-0 p-2 shadow-sm">
                                        <Image
                                            src={WanderLogo}
                                            alt="Wander Wallet"
                                            width={40}
                                            height={40}
                                            className="h-full w-full object-contain"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">
                                            {isConnectingWander
                                                ? "Connecting…"
                                                : "Connect Wander Wallet"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Arweave permanent storage
                                        </p>
                                    </div>
                                    {isConnectingWander ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-purple-400" />
                                    )}
                                </button>
                            )}

                            {wanderError && (
                                <p className="text-xs text-destructive text-center px-2 pt-1">
                                    {wanderError}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Konfirmasi setelah keduanya connect (mode both) */}
                    {mode === "both" && isEvmConnected && evmAddress && wanderAddress && (
                        <Button
                            onClick={() => {
                                onEvmConnected?.(evmAddress);
                                onOpenChange(false);
                            }}
                            className="w-full"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Both Wallets Connected — Continue
                        </Button>
                    )}

                    {/* Info note */}
                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-2">
                        Your private keys stay in your wallet at all times. Bitxen never
                        has access to your funds.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// -------------------------------------------------------------------
// MobileWalletButton — trigger button + modal sekaligus
// -------------------------------------------------------------------

interface MobileWalletButtonProps {
    label?: string;
    mode?: MobileWalletModalProps["mode"];
    onWanderConnected?: (address: string) => void;
    onEvmConnected?: (address: string) => void;
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export function MobileWalletButton({
    label = "Connect Wallet",
    mode = "both",
    onWanderConnected,
    onEvmConnected,
    disabled,
    className,
    children,
}: MobileWalletButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className={className}
            >
                {children ?? (
                    <>
                        <Wallet className="h-4 w-4" />
                        {label}
                    </>
                )}
            </Button>

            <MobileWalletModal
                open={open}
                onOpenChange={setOpen}
                mode={mode}
                onWanderConnected={onWanderConnected}
                onEvmConnected={onEvmConnected}
            />
        </>
    );
}
