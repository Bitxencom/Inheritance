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
 *
 * Mobile fixes:
 *  - Dialog ditutup dulu sebelum membuka Wander popup, karena Radix aria-modal
 *    memblokir touch events di luar dialog (termasuk iframe Wander di body).
 *  - Delay 250ms setelah dialog close agar animasi & repaint selesai → tidak blank.
 *  - Dialog reopen otomatis setelah Wander selesai (sukses/cancel/error).
 *  - Cancel detection via MutationObserver di wanderWallet.ts.
 */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
    Loader2,
    ChevronRight,
    Wallet,
    ArrowRight,
    ArrowDown,
    CheckCircle2,
    LogOut,
} from "lucide-react";
import { useWeb3Modal, useWeb3ModalState } from "@web3modal/wagmi/react";
import { useAccount, useDisconnect } from "wagmi";

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
    disconnectWanderWallet,
    isWalletReady as isWanderReady,
} from "@/lib/wanderWallet";
import WanderLogo from "@/assets/logo/wander.svg";
import {
    clearWalletConnectStorage,
    isWalletConnectStaleSessionError,
} from "@/lib/walletconnect-storage";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface MobileWalletModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Dipanggil setelah Wander berhasil connect */
    onWanderConnected?: (address: string) => void;
    /** Dipanggil setelah EVM wallet terkoneksi — modal tetap terbuka */
    onEvmConnected?: (address: string) => void;
    /** Dipanggil saat user klik tombol Continue setelah keduanya connect (mode both) */
    onBothConnected?: (evmAddress: string) => void;
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
    onBothConnected,
    mode = "both",
}: MobileWalletModalProps) {
    const { open: openWeb3Modal, close: closeWeb3Modal } = useWeb3Modal();
    const { open: isWeb3ModalOpen } = useWeb3ModalState();
    const { disconnect: disconnectEvm } = useDisconnect();
    const { address: evmAddress, isConnected: isEvmConnected } = useAccount();

    const [isConnectingWander, setIsConnectingWander] = useState(false);
    const [isConnectingEvm, setIsConnectingEvm] = useState(false);
    const [wanderAddress, setWanderAddress] = useState<string | null>(null);
    const [wanderError, setWanderError] = useState<string | null>(null);
    const [evmError, setEvmError] = useState<string | null>(null);

    // Guard ref: mencegah useEffect re-open dialog secara tidak sengaja.
    // Hanya di-set true ketika user memang menekan tombol Connect EVM Wallet.
    const didOpenWeb3Modal = useRef(false);

    const showEvm = mode === "evm-only" || mode === "both";
    const showArweave = mode === "arweave-only" || mode === "both";

    // Dalam mode "both", EVM hanya aktif setelah Wander terkoneksi
    const isEvmLocked = mode === "both" && !wanderAddress;

    // ----------------------------------------------------------------
    // Handle klik tombol Wander — STEP 1
    // ----------------------------------------------------------------
    const handleWanderConnect = async () => {
        setWanderError(null);
        setIsConnectingWander(true);

        // CRITICAL (mobile fix): Radix <Dialog> menerapkan aria-modal yang memblokir
        // semua pointer/touch events di luar dialog — termasuk iframe Wander Connect
        // yang dirender langsung di <body>. Tutup dialog kita dulu, baru buka Wander.
        onOpenChange(false);

        // Tunggu animasi close dialog (~150ms) + margin ~100ms agar browser selesai
        // melepaskan aria-modal DOM lock dan repaint. Tanpa ini, iframe Wander blank.
        await new Promise<void>((resolve) => setTimeout(resolve, 250));

        try {
            // Cek apakah wallet sudah connect sebelumnya
            const alreadyReady = await isWanderReady();
            if (alreadyReady) {
                const { getConnectedAddress } = await import("@/lib/wanderWallet");
                const addr = await getConnectedAddress();
                if (addr) {
                    setWanderAddress(addr);
                    onWanderConnected?.(addr);
                    // Reopen dialog jika mode both untuk lanjut ke step EVM
                    if (mode === "both") {
                        onOpenChange(true);
                    }
                    return;
                }
            }

            // Buka Wander popup — promise resolve saat user approve,
            // reject saat user cancel atau error (via MutationObserver di wanderWallet.ts)
            const address = await connectWanderWallet();
            setWanderAddress(address);
            onWanderConnected?.(address);

            // Reopen dialog jika mode both untuk lanjut ke step EVM
            if (mode === "both") {
                onOpenChange(true);
            }
        } catch (err) {
            // Wander cancelled atau error — tampilkan pesan dan reopen dialog
            const msg = err instanceof Error ? err.message : "Failed to connect Wander Wallet";
            // Jangan tampilkan pesan "cancelled" sebagai error yang menakutkan
            if (!msg.toLowerCase().includes("cancel")) {
                setWanderError(msg);
            }
            onOpenChange(true);
        } finally {
            setIsConnectingWander(false);
        }
    };

    // ----------------------------------------------------------------
    // Handle klik tombol EVM — STEP 2 (hanya aktif setelah Wander connect)
    // ----------------------------------------------------------------
    const handleEvmConnect = async () => {
        setEvmError(null);
        setIsConnectingEvm(true);

        // Seperti Wander, kita harus menutup Radix <Dialog> dulu agar event listener
        // dari WalletConnect/Web3Modal (seperti app-switch visibilitychange, deep-link dll)
        // tidak terblokir oleh focus trap (aria-modal) dari Radix.
        onOpenChange(false);
        await new Promise<void>((resolve) => setTimeout(resolve, 250));

        try {
            // Tandai bahwa Web3Modal memang sengaja dibuka dari user — dipakai oleh useEffect di bawah
            didOpenWeb3Modal.current = true;
            await openWeb3Modal();
            // Modal Web3Modal terbuka. State perubahan akan ditangani oleh useEffect `isWeb3ModalOpen`
        } catch (err) {
            // Jika openWeb3Modal() langsung throw, reset flag
            didOpenWeb3Modal.current = false;

            if (isWalletConnectStaleSessionError(err)) {
                // Stale session: hapus data WC lama dari localStorage dan coba sekali lagi
                console.warn("[EVM Connect] Stale WalletConnect session detected. Clearing storage and retrying…", err);
                clearWalletConnectStorage();
                try {
                    didOpenWeb3Modal.current = true;
                    await openWeb3Modal();
                } catch (retryErr) {
                    didOpenWeb3Modal.current = false;
                    setEvmError(
                        retryErr instanceof Error
                            ? retryErr.message
                            : "Failed to connect EVM wallet after clearing stale session"
                    );
                    onOpenChange(true);
                }
            } else {
                setEvmError(err instanceof Error ? err.message : "Failed to connect EVM wallet");
                // Kembalikan ke dialog kita jika terjadi fallback error open
                onOpenChange(true);
            }
        } finally {
            setIsConnectingEvm(false);
        }
    };

    // Re-open Radix Dialog ketika Web3Modal ditutup — HANYA jika Web3Modal sebelumnya
    // benar-benar dibuka oleh user (didOpenWeb3Modal.current === true).
    // Ini mencegah loop: tanpa guard ini, kondisi !isWeb3ModalOpen && !open terpenuhi
    // sejak awal, sehingga setiap kali user menutup dialog utama akan langsung reopen.
    useEffect(() => {
        if (!isWeb3ModalOpen && !open && mode === "both" && wanderAddress && didOpenWeb3Modal.current) {
            // Reset flag agar tidak trigger lagi
            didOpenWeb3Modal.current = false;
            const t = setTimeout(() => onOpenChange(true), 200);
            return () => clearTimeout(t);
        }
    }, [isWeb3ModalOpen, mode, open, onOpenChange, wanderAddress]);

    // Force close Web3Modal jika EVM sudah terkoneksi tapi modal dari Web3Modal masih tersangkut terbuka.
    // BUG mobile: Deep link redirect terkadang membuat fallback UI "Continue in MetaMask" stuck 
    // meskipun Wagmi secara pasif sudah berhasil menghidrasi state `isConnected` dari localStorage/cookie.
    useEffect(() => {
        if (isEvmConnected && isWeb3ModalOpen) {
            closeWeb3Modal();
        }
    }, [isEvmConnected, isWeb3ModalOpen, closeWeb3Modal]);

    // Konfirmasi setelah keduanya connect — panggil onBothConnected
    const handleBothConnected = () => {
        if (evmAddress) {
            onBothConnected?.(evmAddress);
            onOpenChange(false);
        }
    };

    // Disconnect Wander
    const handleWanderDisconnect = async () => {
        try {
            await disconnectWanderWallet();
        } catch {
            // ignore
        }
        setWanderAddress(null);
        setWanderError(null);
    };

    // Disconnect EVM wallet
    const handleEvmDisconnect = () => {
        disconnectEvm();
        setEvmError(null);
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
                            ? "Connect Arweave wallet first, then your EVM wallet. Both are required for hybrid payment."
                            : mode === "evm-only"
                                ? "Connect your EVM wallet (MetaMask, Trust Wallet, etc.) to interact with the Bitxen smart contract."
                                : "Connect your Wander wallet to upload data to Arweave."}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 pb-5 space-y-3">

                    {/* ─── STEP 1: ARWEAVE — Wander Wallet ─── */}
                    {showArweave && (
                        <div className="space-y-1.5">
                            {mode === "both" && (
                                <div className="flex items-center gap-2 px-1">
                                    <span className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                                        wanderAddress
                                            ? "bg-purple-500 text-white"
                                            : "bg-muted text-muted-foreground border"
                                    )}>
                                        {wanderAddress ? <CheckCircle2 className="h-3 w-3" /> : "1"}
                                    </span>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Arweave Storage (Wander)
                                    </p>
                                </div>
                            )}

                            {wanderAddress ? (
                                /* Connected */
                                <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20 p-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="h-5 w-5 text-purple-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                                                Wander Connected
                                            </p>
                                            <p className="text-xs font-mono text-muted-foreground truncate">
                                                {`${wanderAddress.slice(0, 4)}......${wanderAddress.slice(-4)}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleWanderDisconnect}
                                            title="Disconnect Wander"
                                            className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <LogOut className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Not connected */
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
                                            {isConnectingWander ? "Connecting…" : "Connect Wander Wallet"}
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
                                <p className="text-xs text-destructive px-2 pt-0.5">{wanderError}</p>
                            )}
                        </div>
                    )}

                    {/* Divider with step arrow */}
                    {showEvm && showArweave && (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-border" />
                            <ArrowDown className={cn(
                                "h-8 w-8 transition-colors border border-slate-200 dark:border-slate-800 rounded-full p-1",
                                wanderAddress ? "text-primary" : "text-muted-foreground/40"
                            )} />
                            <div className="flex-1 h-px bg-border" />
                        </div>
                    )}

                    {/* ─── STEP 2: EVM WALLET — Web3Modal Button ─── */}
                    {showEvm && (
                        <div className="space-y-1.5">
                            {mode === "both" && (
                                <div className="flex items-center gap-2 px-1">
                                    <span className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                                        isEvmConnected && evmAddress
                                            ? "bg-emerald-500 text-white"
                                            : isEvmLocked
                                                ? "bg-muted text-muted-foreground/40 border"
                                                : "bg-muted text-muted-foreground border"
                                    )}>
                                        {isEvmConnected && evmAddress ? <CheckCircle2 className="h-3 w-3" /> : "2"}
                                    </span>
                                    <p className={cn(
                                        "text-[10px] font-semibold uppercase tracking-widest",
                                        isEvmLocked ? "text-muted-foreground/40" : "text-muted-foreground"
                                    )}>
                                        EVM Wallet · Bitxen Contract
                                    </p>
                                    {isEvmLocked && (
                                        <span className="ml-auto text-[9px] text-muted-foreground/50 italic">
                                            Connect Arweave first
                                        </span>
                                    )}
                                </div>
                            )}

                            {isEvmConnected && evmAddress ? (
                                /* Already connected */
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                                EVM Wallet Connected
                                            </p>
                                            <p className="text-xs font-mono text-muted-foreground truncate">
                                                {`${evmAddress.slice(0, 4)}......${evmAddress.slice(-4)}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleEvmDisconnect}
                                            title="Disconnect EVM Wallet"
                                            className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <LogOut className="h-3.5 w-3.5" />
                                        </button>
                                        {mode !== "both" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => { onEvmConnected?.(evmAddress); onOpenChange(false); }}
                                                className="flex-shrink-0 h-7 text-xs"
                                            >
                                                Use
                                                <ArrowRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Not connected */
                                <button
                                    onClick={handleEvmConnect}
                                    disabled={isConnectingEvm || isEvmLocked}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl transition-all text-left",
                                        "border bg-card",
                                        isEvmLocked
                                            ? "border-border opacity-40 cursor-not-allowed"
                                            : "border-border hover:bg-muted/60 hover:border-primary/40",
                                        isConnectingEvm && "opacity-60 cursor-not-allowed"
                                    )}
                                >
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
                                        <ChevronRight className={cn(
                                            "h-4 w-4",
                                            isEvmLocked ? "text-muted-foreground/30" : "text-muted-foreground"
                                        )} />
                                    )}
                                </button>
                            )}

                            {evmError && (
                                <p className="text-xs text-destructive px-2 pt-0.5">{evmError}</p>
                            )}
                        </div>
                    )}

                    {/* Konfirmasi setelah keduanya connect (mode both) */}
                    {mode === "both" && isEvmConnected && evmAddress && wanderAddress && (
                        <Button
                            onClick={handleBothConnected}
                            className="h-12 w-full bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 mt-4"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Both Wallets Connected — Continue
                        </Button>
                    )}

                    {/* Info note */}
                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-2 pt-1">
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
