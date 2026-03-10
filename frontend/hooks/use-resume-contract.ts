"use client";

import { useState, useCallback } from "react";
import type { PendingVault } from "@/lib/vault-storage";
import { updateVaultTxId } from "@/lib/vault-storage";
import type { ChainId, HybridDispatchResult } from "@/lib/metamaskWallet";

export type ResumePhase = "idle" | "fetching" | "computing" | "confirm" | "registering" | "success" | "error";

/**
 * Hook for resuming contract registration when Arweave upload succeeded
 * but the Bitxen smart contract step failed or was cancelled.
 */
export function useResumeContract() {
  const [phase, setPhase] = useState<ResumePhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resume = useCallback(async (vault: PendingVault): Promise<HybridDispatchResult | null> => {
    setPhase("fetching");
    setStatus("Fetching vault data from Arweave...");
    setError(null);

    try {
      // Step 1: Fetch the original payload from Arweave
      const arweaveUrl = `https://arweave.net/${vault.arweaveTxId}`;
      const response = await fetch(arweaveUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch vault data from Arweave (${response.status}). ` +
          `The transaction may not be confirmed yet. Please try again later.`
        );
      }
      const arweavePayload = await response.json();

      // Step 2: Compute commitment from the payload
      setPhase("computing");
      setStatus("Computing registration parameters...");

      const { keccak_256 } = await import("@noble/hashes/sha3.js");
      const { calculateCommitment } = await import("@/lib/clientVaultCrypto");
      const { registerOnContract, getEVMProvider } = await import("@/lib/metamaskWallet");

      // Get EVM address
      const evmProvider = await getEVMProvider();
      if (!evmProvider) {
        throw new Error("No EVM wallet found. Please connect MetaMask or another EVM wallet.");
      }

      const accounts = (await evmProvider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No EVM wallet connected. Please connect your wallet.");
      }
      const ownerAddress = accounts[0];

      // Compute dataHash
      const dataJson = JSON.stringify(arweavePayload);
      const dataHashBytes = keccak_256(new TextEncoder().encode(dataJson));
      const dataHash = "0x" + Array.from(dataHashBytes as Uint8Array)
        .map((b: number) => b.toString(16).padStart(2, "0")).join("");

      // Extract contractEncryptedKey from payload metadata
      const contractEncryptedKey = arweavePayload?.metadata?.contractEncryptedKey;
      if (!contractEncryptedKey) {
        throw new Error("Could not find encryption key in Arweave payload. The data may be corrupted.");
      }

      // Compute wrappedKeyHash
      const wrappedKeyHashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(contractEncryptedKey)
      );
      const wrappedKeyHash = "0x" + Array.from(new Uint8Array(wrappedKeyHashBytes))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      // Calculate commitment
      const commitment = calculateCommitment({
        dataHash,
        wrappedKeyHash,
        ownerAddress,
      });

      // Derive options from vault data
      const isPermanent = vault.willType === "one-time";
      let releaseDate = BigInt(0);
      if (vault.triggerType === "date" && vault.triggerDate) {
        const [year, month, day] = vault.triggerDate.split("-").map(Number);
        const triggerMs = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        releaseDate = BigInt(Math.floor(triggerMs / 1000));
      }

      const chainId = (vault.blockchainChain || "bsc") as ChainId;

      // Step 3: Register on contract
      setPhase("confirm");
      setStatus("Please confirm the transaction in your wallet...");

      const result = await registerOnContract(
        vault.arweaveTxId,
        arweavePayload,
        vault.vaultId,
        chainId,
        {
          isPermanent,
          releaseDate,
          commitment,
          secret: "0x" + "0".repeat(64),
          onProgress: (s) => {
            setStatus(s);
            if (s.toLowerCase().includes("confirm")) setPhase("confirm");
            else setPhase("registering");
          },
        },
      );

      // Step 4: Update vault in localStorage
      updateVaultTxId(vault.vaultId, vault.arweaveTxId, {
        storageType: "bitxenArweave",
        blockchainTxHash: result.contractTxHash,
        blockchainChain: result.chainId,
        contractDataId: result.contractDataId,
        contractAddress: result.contractAddress,
      });

      setPhase("success");
      setStatus("Contract registration complete!");
      return result;
    } catch (err) {
      console.error("Resume contract registration failed:", err);
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setPhase("error");
      setError(message);
      setStatus(null);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setStatus(null);
    setError(null);
  }, []);

  return { phase, status, error, resume, reset };
}
