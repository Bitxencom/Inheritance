"use client";

import { useState, useCallback, useRef } from "react";

import type { DispatchResult } from "@/lib/wanderWallet";

export type UploadPhase = "idle" | "confirm" | "upload" | "finalize" | "success" | "error";

export interface ArweaveUploadStatus {
    progress: number;
    status: string;
    phase: UploadPhase;
    isUploading: boolean;
    error: string | null;
}

/**
 * Hook to handle Arweave uploads via Wander Wallet (ArConnect).
 * Centralizes progress tracking, status messages, and wallet connection.
 */
export function useArweaveUpload() {
    const [progress, setProgress] = useState<number>(0);
    const [status, setStatus] = useState<string>("");
    const [phase, setPhase] = useState<UploadPhase>("idle");
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const progressRef = useRef<number>(0);

    const determinePhase = (statusMsg: string, progressVal: number): UploadPhase => {
        const normalized = statusMsg.toLowerCase();
        if (normalized.includes("waiting") || normalized.includes("confirm") || normalized.includes("signature")) {
            return "confirm";
        }
        if (normalized.includes("uploading") || normalized.includes("chunk") || normalized.includes("resuming") || normalized.includes("preparing")) {
            return "upload";
        }
        if (normalized.includes("successful") || progressVal >= 100) {
            return "success";
        }
        return "upload";
    };

    const upload = useCallback(async (
        data: unknown,
        vaultId?: string,
        tags?: Record<string, string>
    ): Promise<DispatchResult> => {
        setIsUploading(true);
        setError(null);
        setProgress(0);
        progressRef.current = 0;
        setPhase("idle");
        setStatus("Initializing Arweave upload...");

        try {
            const { dispatchToArweave, isWalletReady, connectWanderWallet } = await import("@/lib/wanderWallet");

            const ready = await isWalletReady();
            if (!ready) {
                setStatus("Connecting to Wander Wallet...");
                setPhase("confirm");
                await connectWanderWallet();
            }

            const result = await dispatchToArweave(
                data,
                vaultId,
                tags,
                (p) => {
                    setProgress(p);
                    progressRef.current = p;
                    if (p > 0 && p < 100) setPhase("upload");
                    if (p >= 100) setPhase("finalize");
                },
                (s) => {
                    setStatus(s);
                    setPhase((prev) => {
                        const next = determinePhase(s, progressRef.current);
                        // Don't go back from finalize to upload
                        return (prev === "finalize" && next === "upload") ? "finalize" : next;
                    });
                }
            );

            setStatus("Upload successful!");
            setPhase("success");
            setProgress(100);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            setStatus("Upload failed");
            setPhase("error");
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, [progress]);

    const reset = useCallback(() => {
        setProgress(0);
        setStatus("");
        setPhase("idle");
        setIsUploading(false);
        setError(null);
    }, []);

    return {
        upload,
        progress,
        status,
        phase,
        isUploading,
        error,
        reset,
    };
}
