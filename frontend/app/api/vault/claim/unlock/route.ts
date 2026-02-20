import { NextResponse } from "next/server";
import { CHAIN_CONFIG, type ChainId } from "@/lib/metamaskWallet";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

async function findLatestArweaveTxIdForVault(vaultId: string): Promise<string | null> {
  try {
    const safeVaultId = typeof vaultId === "string" ? vaultId.trim() : "";
    if (!safeVaultId) return null;

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query ($vaultId: String!) {
            transactions(
              first: 1
              sort: HEIGHT_DESC
              tags: [
                { name: "Doc-Id", values: [$vaultId] }
                { name: "App-Name", values: ["doc-storage"] }
                { name: "Type", values: ["doc"] }
              ]
            ) {
              edges {
                node {
                  id
                }
              }
            }
          }
        `,
        variables: { vaultId: safeVaultId },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const id = data?.data?.transactions?.edges?.[0]?.node?.id;
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  } catch {
    return null;
  }
}

// Helper to resolve numeric chainId from string key
const resolveChainId = (chainKey: string | undefined): number | null => {
  if (!chainKey) return null;
  const config = CHAIN_CONFIG[chainKey as ChainId];
  return config ? config.chainId : null;
};

export async function POST(req: Request) {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const { vaultId, securityQuestionAnswers, fractionKeys, arweaveTxId } = payload;

  if (typeof vaultId !== "string" || vaultId.trim().length === 0 || !fractionKeys) {
    return NextResponse.json(
      { success: false, error: "Please provide both the Vault ID and your Fraction Keys." },
      { status: 400 },
    );
  }

  const normalizedVaultId = vaultId.trim();

  const isTxNotFoundFromGateway = (message: unknown) =>
    typeof message === "string" &&
    message.includes("Failed to fetch blockchain transaction data for txId=") &&
    message.includes("HTTP 404");

  const callBackend = async (txOverride: string | undefined) => {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(normalizedVaultId)}/unlock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          securityQuestionAnswers,
          fractionKeys: Object.values(fractionKeys).filter(
            (value: unknown) => typeof value === "string" && value.trim() !== "",
          ),
          ...(txOverride ? { arweaveTxId: txOverride } : {}),
        }),
      },
    );
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  try {
    const maxRetries = 3;
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;
    let lastData: Record<string, unknown> = {};

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const primary = await callBackend(
          typeof arweaveTxId === "string" && arweaveTxId.trim().length > 0 ? arweaveTxId.trim() : undefined,
        );

        lastResponse = primary.response;
        lastData = primary.data;

        if (primary.response.ok && primary.data.success) {
          const resolvedTxId =
            typeof arweaveTxId === "string" && arweaveTxId.trim().length > 0
              ? arweaveTxId.trim()
              : await findLatestArweaveTxIdForVault(normalizedVaultId);

          const meta = (primary.data.metadata as Record<string, unknown>) || {};
          
          // Fallback extraction from metadata
          const contractDataId = (primary.data.contractDataId as string) || (meta.contractDataId as string) || null;
          const contractAddress = (primary.data.contractAddress as string) || (meta.contractAddress as string) || null;
          const releaseEntropy = (primary.data.releaseEntropy as string) || (meta.releaseEntropy as string) || null;
          
          let chainId = (primary.data.chainId as number) || null;
          if (!chainId && typeof meta.blockchainChain === "string") {
             chainId = resolveChainId(meta.blockchainChain);
          }

          return NextResponse.json({
            success: true,
            encryptedVault: primary.data.encryptedVault || null,
            decryptedVault: primary.data.decryptedVault || null,
            metadata: primary.data.metadata || null,
            legacy: primary.data.legacy || null,
            message: primary.data.message || "Vault unlocked successfully.",
            releaseEntropy,
            contractDataId,
            contractAddress,
            chainId,
            latestTxId: resolvedTxId,
          });
        }

        if (isTxNotFoundFromGateway(primary.data?.error) || isTxNotFoundFromGateway(primary.data?.message)) {
          const candidates: Array<string | undefined> = [];

          if (typeof arweaveTxId === "string" && arweaveTxId.trim().length > 0) {
            candidates.push(undefined);
          }

          const latestFromTags = await findLatestArweaveTxIdForVault(normalizedVaultId);
          if (
            typeof latestFromTags === "string" &&
            latestFromTags.trim().length > 0 &&
            latestFromTags.trim() !== (typeof arweaveTxId === "string" ? arweaveTxId.trim() : "")
          ) {
            candidates.push(latestFromTags.trim());
          }

          for (const candidate of candidates) {
            const fb = await callBackend(candidate);
            lastResponse = fb.response;
            lastData = fb.data;

            if (fb.response.ok && fb.data.success) {
              const successfulTxId = candidate ?? (await findLatestArweaveTxIdForVault(normalizedVaultId));

              const meta = (fb.data.metadata as Record<string, unknown>) || {};
              // Fallback extraction from metadata
              const contractDataId = (fb.data.contractDataId as string) || (meta.contractDataId as string) || null;
              const contractAddress = (fb.data.contractAddress as string) || (meta.contractAddress as string) || null;
              const releaseEntropy = (fb.data.releaseEntropy as string) || (meta.releaseEntropy as string) || null;
              
              let chainId = (fb.data.chainId as number) || null;
              if (!chainId && typeof meta.blockchainChain === "string") {
                 chainId = resolveChainId(meta.blockchainChain);
              }

              return NextResponse.json({
                success: true,
                encryptedVault: fb.data.encryptedVault || null,
                decryptedVault: fb.data.decryptedVault || null,
                metadata: fb.data.metadata || null,
                legacy: fb.data.legacy || null,
                message: fb.data.message || "Vault unlocked successfully.",
                releaseEntropy,
                contractDataId,
                contractAddress,
                chainId,
                latestTxId: successfulTxId,
              });
            }
          }

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            continue;
          }

          return NextResponse.json(
            {
              success: false,
              error:
                "Transaksi Arweave untuk vault ini belum tersedia di gateway (masih diproses / belum terkonfirmasi). Silakan coba lagi beberapa menit.",
            },
            { status: 409 },
          );
        }

        if (primary.response.status >= 400 && primary.response.status < 500 && primary.response.status !== 404) {
          break;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    if (lastResponse) {
      const errorMessage =
        typeof lastData.error === "string"
          ? lastData.error
          : "Unable to unlock vault. Please check your keys and try again.";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: lastResponse.status || 500 },
      );
    }

    const message =
      lastError?.message || "An error occurred while contacting the backend unlock service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  } catch (error) {
    console.error("❌ Backend unlock service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting the backend unlock service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
