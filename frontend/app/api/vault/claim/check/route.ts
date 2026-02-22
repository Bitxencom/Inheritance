import { NextResponse } from "next/server";

const MIN_CONFIRMATION_DEPTH = 0;

const normalizeBackendBaseUrl = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const unwrapped =
    trimmed.startsWith("`") && trimmed.endsWith("`")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unwrapped.replace(/\/$/, "");
};

const backendBaseUrl =
  normalizeBackendBaseUrl(process.env.DEHERITANCE_BACKEND_BASE_URL) ||
  normalizeBackendBaseUrl(process.env.BACKEND_BASE_URL) ||
  (String(process.env.DOCKER_ENV ?? "").toLowerCase() === "true"
    ? "http://backend:7020"
    : "http://localhost:7020");

type CheckClaimRequest = {
  vaultId?: string;
  arweaveTxId?: string | null;
};

async function getArweaveConfirmations(txId: string): Promise<number> {
  try {
    // 1️⃣ Ambil block height transaksi
    const gqlResponse = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($id: ID!) {
            transaction(id: $id) {
              block {
                height
              }
            }
          }
        `,
        variables: { id: txId }
      })
    });

    if (!gqlResponse.ok) {
      console.log("GraphQL error");
      return 0;
    }

    const gqlData = await gqlResponse.json();
    const txBlockHeight =
      gqlData?.data?.transaction?.block?.height ?? null;

    // kalau belum masuk block
    if (txBlockHeight === null) return 0;

    // 2️⃣ Ambil current network height (REST API, bukan GraphQL)
    const heightResponse = await fetch("https://arweave.net/info");
    if (!heightResponse.ok) return 0;

    const heightData = await heightResponse.json();
    const currentHeight = heightData?.height ?? null;

    if (currentHeight === null) return 0;

    // 3️⃣ Hitung confirmations
    return Math.max(0, currentHeight - txBlockHeight);

  } catch (err) {
    console.error(err);
    return 0;
  }
}

export async function POST(req: Request) {
  let payload: CheckClaimRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const vaultId = typeof payload.vaultId === "string" ? payload.vaultId.trim() : "";
  const arweaveTxId =
    typeof payload.arweaveTxId === "string" ? payload.arweaveTxId.trim() : undefined;

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  const maxRetries = 3;
  let lastResponse: Response | null = null;
  let lastData: unknown = null;
  let confirmationDepth: number = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use the existing endpoint but only check status, don't process questions
      const response = await fetch(
        `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(vaultId)}/security-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ arweaveTxId }),
        },
      );

      const data = await response.json().catch(() => ({}));
      lastResponse = response;
      lastData = data;

      if (response.ok && (data as { success?: boolean }).success) {
        const typed = data as {
          success: true;
          securityQuestions?: string[];
          requiredIndexes?: unknown;
          claimNonce?: unknown;
          unlockPolicy?: unknown;
          willType?: string;
          trigger?: unknown;
          latestTxId?: string | null;
          message?: string;
        };

        // Check blockchain confirmation depth for all vaults
        const txId = typed.latestTxId || arweaveTxId;
        let isConfirmed = true;

        if (txId) {
          confirmationDepth = await getArweaveConfirmations(txId);
          if (confirmationDepth >= MIN_CONFIRMATION_DEPTH) {
            isConfirmed = true;
          } else {
            isConfirmed = false
          }
        }

        // Check if vault is hybrid (for metadata purposes)
        let isHybrid = false;
        if (txId) {
          try {
            const payloadText = await fetch(`https://arweave.net/${txId}`).then(r => r.ok ? r.text() : null);
            if (payloadText) {
              try {
                const payloadJson = JSON.parse(payloadText);
                const metadata = payloadJson?.metadata || {};
                isHybrid = !!(metadata.blockchainChain || metadata.contractAddress || metadata.contractEncryptedKey);
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          } catch (err) {
            // ignore fetch failures
          }
        }

        // For check endpoint, we only return status info, not the questions
        return NextResponse.json({
          success: true,
          isConfirmed,
          willType: typed.willType || "one-time",
          trigger: typed.trigger || null,
          latestTxId: typed.latestTxId || null,
          isHybrid,
          message: isConfirmed
            ? "Vault is confirmed and ready."
            : `Vault has ${confirmationDepth} confirmations. Minimum ${MIN_CONFIRMATION_DEPTH} required.`,
        });
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        break;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed to connect to ${backendBaseUrl}:`, error);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
  }

  if (!lastResponse) {
    return NextResponse.json(
      { success: false, error: "Service unavailable. Could not connect to backend server." },
      { status: 503 }
    );
  }

  const statusFromBackend = lastResponse.status;
  const data = (lastData || {}) as { error?: string; message?: string; trigger?: unknown };
  const fallbackMessage =
    "Vault ID not found. Please ensure the Vault ID is correct.";
  const message =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : fallbackMessage;

  // Return structured response for frontend handling
  return NextResponse.json({
    success: false,
    isConfirmed: false,
    error: message,
    trigger: data.trigger || null
  }, { status: statusFromBackend });
}
