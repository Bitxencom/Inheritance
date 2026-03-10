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
import { useAppKit, useAppKitState } from "@reown/appkit/react";
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
    getConnectedAddress
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
    const { open: openAppKit, close: closeAppKit } = useAppKit();
    const { open: isAppKitOpen } = useAppKitState();
    const { disconnect: disconnectEvm } = useDisconnect();
    const { address: evmAddress, isConnected: isEvmConnected, isReconnecting: isEvmReconnecting } = useAccount();

    const [isConnectingWander, setIsConnectingWander] = useState(false);
    const [isConnectingEvm, setIsConnectingEvm] = useState(false);
    const [isInitializingWander, setIsInitializingWander] = useState(false);
    const [wanderAddress, setWanderAddress] = useState<string | null>(null);
    const [wanderError, setWanderError] = useState<string | null>(null);
    const [evmError, setEvmError] = useState<string | null>(null);

    // Guard ref: mencegah useEffect re-open dialog secara tidak sengaja.
    // Hanya di-set true ketika user memang menekan tombol Connect EVM Wallet.
    const didOpenAppKit = useRef(false);

    // Stable callback refs — mencegah callback dari parent yang tidak di-memoize
    // menyebabkan dependency array useEffect berubah referensi setiap render,
    // yang akan mereset spinner "Checking wallet connection..." terus-menerus.
    const onWanderConnectedRef = useRef(onWanderConnected);
    const onBothConnectedRef = useRef(onBothConnected);
    useEffect(() => { onWanderConnectedRef.current = onWanderConnected; });
    useEffect(() => { onBothConnectedRef.current = onBothConnected; });

    const showEvm = mode === "evm-only" || mode === "both";
    const showArweave = mode === "arweave-only" || mode === "both";

    // Dalam mode "both", EVM hanya aktif setelah Wander terkoneksi
    const isEvmLocked = mode === "both" && !wanderAddress;

    const isInitializing = isInitializingWander || (showEvm && isEvmReconnecting);

    // ----------------------------------------------------------------
    // Auto-Recovery Session (Wander)
    // ----------------------------------------------------------------
    // Jika modal dibuka (atau saat mount), kita cek form storage apakah user
    // sudah pernah connect sebelumnya. Jika ya, populate alamatnya.
    // PENTING: onWanderConnected TIDAK ada di dependency array — gunakan ref di atas.
    // Tanpa ini, setiap parent re-render akan restart effect dan loop spinner.
    useEffect(() => {
        if (open) {
            if (showArweave && !wanderAddress) {
                let mounted = true;
                setIsInitializingWander(true);
                // Safety timeout: jika getConnectedAddress() hang (SDK not ready),
                // paksa reset spinner setelah 3 detik agar UI tidak stuck.
                const timeoutId = setTimeout(() => {
                    if (mounted) setIsInitializingWander(false);
                }, 3000);
                getConnectedAddress().then(addr => {
                    clearTimeout(timeoutId);
                    if (mounted) {
                        if (addr) {
                            setWanderAddress(addr);
                            onWanderConnectedRef.current?.(addr);
                        }
                        setIsInitializingWander(false);
                    }
                }).catch(() => {
                    clearTimeout(timeoutId);
                    if (mounted) setIsInitializingWander(false);
                    // Ignore failure during auto-recovery
                });
                return () => { mounted = false; clearTimeout(timeoutId); };
            }
        } else {
            // Reset state saat modal ditutup
            setIsInitializingWander(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, showArweave, wanderAddress]);

    // ----------------------------------------------------------------
    // Auto-proceed ketika kedua wallet sudah terkoneksi
    // ----------------------------------------------------------------
    // Jika modal dibuka dan ternyata Wander + EVM keduanya sudah connect
    // (dari session sebelumnya), langsung panggil onBothConnected tanpa
    // memaksa user menekan tombol "Continue" secara manual.
    const autoProceededRef = useRef(false);
    useEffect(() => {
        if (!open) {
            autoProceededRef.current = false;
            return;
        }
        if (mode !== "both") return;
        if (autoProceededRef.current) return;
        if (isInitializing) return;
        if (wanderAddress && isEvmConnected && evmAddress) {
            autoProceededRef.current = true;
            onBothConnectedRef.current?.(evmAddress);
            onOpenChange(false);
        }
    }, [open, mode, isInitializing, wanderAddress, isEvmConnected, evmAddress, onOpenChange]);

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

            // AUTO-RECOVERY SAFETY: Seringkali popup Wander muncul tapi UI "Preparing"
            // kita malah menutupi atau membuat user bingung. Kita pasang timer 
            // agar overlay "Preparing" otomatis hilang setelah 8 detik meskipun 
            // proses connect masih pending (user sedang memilih wallet/approve).
            const safetyTimer = setTimeout(() => {
                setIsConnectingWander(false);
            }, 8000);

            // Buka Wander popup — promise resolve saat user approve,
            // reject saat user cancel atau error (via MutationObserver di wanderWallet.ts)
            const address = await connectWanderWallet();

            clearTimeout(safetyTimer);
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

        // PENTING: Jangan gunakan setTimeout() sebelum openAppKit().
        // Browser mobile (iOS Safari / Android Chrome) mewajibkan deep-link (intent/wc:)
        // dieksekusi dalam konteks siklus "User Gesture" (klik langsung) secara instan.
        // Jika ada setTimeout, popup atau app-switch akan diblokir oleh sistem keamanan OS,
        // mengakibatkan UI nyangkut di "Continue in MetaMask".
        onOpenChange(false);

        try {
            // Tandai bahwa AppKit memang sengaja dibuka dari user
            didOpenAppKit.current = true;
            await openAppKit();
            // Modal AppKit terbuka. State perubahan akan ditangani oleh useEffect `isAppKitOpen`
        } catch (err) {
            // Jika openAppKit() langsung throw, reset flag
            didOpenAppKit.current = false;

            if (isWalletConnectStaleSessionError(err)) {
                // Stale session: hapus data WC lama dari localStorage dan coba sekali lagi
                console.warn("[EVM Connect] Stale WalletConnect session detected. Clearing storage and retrying…", err);
                clearWalletConnectStorage();
                try {
                    didOpenAppKit.current = true;
                    await openAppKit();
                } catch (retryErr) {
                    didOpenAppKit.current = false;
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

    // Re-open Radix Dialog ketika AppKit ditutup.
    // Kami melacak transisi dari `true` ke `false` untuk mencegah trigger instan
    // ketika AppKit dipanggil dan statenya belum sinkron.
    const wasAppKitOpen = useRef(false);
    useEffect(() => {
        if (isAppKitOpen) {
            wasAppKitOpen.current = true;
        } else if (!isAppKitOpen && wasAppKitOpen.current) {
            wasAppKitOpen.current = false;
            didOpenAppKit.current = false;

            // AppKit baru saja ditutup (user cancel atau connect success).
            // Re-open dialog jika saat ini tertutup.
            if (!open) {
                const t = setTimeout(() => onOpenChange(true), 300);
                return () => clearTimeout(t);
            }
        }
    }, [isAppKitOpen, open, onOpenChange]);

    // Safety net: Re-open modal secara otomatis BILA EVM baru saja berstatus connected !
    // Sangat berguna di mobile untuk deep-link redirect karena AppKit 
    // terkadang tidak mendaftarkan "open" state dengan sempurna.
    const prevEvmConnected = useRef(isEvmConnected);
    useEffect(() => {
        if (!prevEvmConnected.current && isEvmConnected) {
            // State berubah jadi connected!
            if (!open) {
                const t = setTimeout(() => onOpenChange(true), 400);
                return () => clearTimeout(t);
            }
        }
        prevEvmConnected.current = isEvmConnected;
    }, [isEvmConnected, open, onOpenChange]);

    // Force close AppKit jika EVM sudah terkoneksi tapi modal dari AppKit masih tersangkut terbuka.
    // BUG mobile: Deep link redirect terkadang membuat fallback UI "Continue in MetaMask" stuck 
    // meskipun Wagmi secara pasif sudah berhasil menghidrasi state `isConnected` dari localStorage/cookie.
    useEffect(() => {
        if (isEvmConnected && isAppKitOpen) {
            closeAppKit();
        }
    }, [isEvmConnected, isAppKitOpen, closeAppKit]);

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
        <>
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
                        {isInitializing ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm font-medium text-muted-foreground">Checking wallet connection...</p>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* OVERLAY SPINNER KETIKA POPUP WANDER BELUM MUNCUL */}
            {isConnectingWander && !open && !wanderAddress && (
                <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-none">
                    <div className="flex flex-col justify-center items-center gap-5 bg-card p-8 rounded-3xl shadow-2xl border border-border outline-none w-[280px] pointer-events-auto animate-in zoom-in-95 duration-300">
                        <div className="relative flex items-center justify-center w-14 h-14">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-20 animate-ping"></span>
                            <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30">
                                <Loader2 className="h-7 w-7 animate-spin text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold text-foreground tracking-tight text-lg">Preparing...</h3>
                            <p className="text-xs text-muted-foreground px-4 leading-relaxed">
                                Opening Wander Wallet. Please check for a popup.
                            </p>
                        </div>

                        {/* Fallback button if stuck */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsConnectingWander(false)}
                            className="text-[10px] text-muted-foreground hover:text-foreground mt-2"
                        >
                            Cancel or Retry
                        </Button>
                    </div>
                </div>
            )}
        </>
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
