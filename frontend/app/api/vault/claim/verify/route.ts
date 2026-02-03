import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  console.log("🔍 [claim/verify] Request received");
  
  let payload;
  try {
    const text = await req.text();
    console.log("🔍 [claim/verify] Request body text length:", text.length);
    
    if (!text || text.trim() === "") {
      console.error("❌ [claim/verify] Empty request body");
      return NextResponse.json(
        { success: false, error: "Request body is empty." },
        { status: 400 },
      );
    }
    
    try {
      payload = JSON.parse(text);
    } catch (parseError) {
      console.error("❌ [claim/verify] JSON parse error:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("❌ [claim/verify] Failed to read request body:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read request body." },
      { status: 400 },
    );
  }
  
  console.log("🔍 [claim/verify] Payload received:", JSON.stringify(payload));
  const { vaultId, arweaveTxId } = payload;

  if (typeof vaultId !== "string" || vaultId.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Vault ID is missing." },
      { status: 400 },
    );
  }

  const normalizedVaultId = vaultId.trim();

  const callBackend = async (txOverride: string | undefined) => {
    const body = txOverride ? { arweaveTxId: txOverride } : {};
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(normalizedVaultId)}/security-questions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const isTxNotFoundFromGateway = (message: unknown) =>
    typeof message === "string" &&
    message.includes("Failed to fetch blockchain transaction data for txId=") &&
    message.includes("HTTP 404");

  const maxRetries = 3;
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let lastData: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 [claim/verify] Attempt ${attempt}/${maxRetries} to backend`);
      
      const primary = await callBackend(
        typeof arweaveTxId === "string" && arweaveTxId.trim().length > 0 ? arweaveTxId.trim() : undefined,
      );
      lastResponse = primary.response;
      lastData = primary.data;

      // Success case - return immediately
      if (primary.response.ok && primary.data.success) {
        console.log(`✅ [claim/verify] Success on attempt ${attempt}`);
        return NextResponse.json({
          success: true,
          securityQuestions: primary.data.securityQuestions || [],
          willType: primary.data.willType || "one-time",
          trigger: primary.data.trigger || null,
          latestTxId: primary.data.latestTxId || null,
          message: primary.data.message || "Security questions verified.",
        });
      }

      if (isTxNotFoundFromGateway(primary.data?.error) || isTxNotFoundFromGateway(primary.data?.message)) {
        console.log("⚠️ [claim/verify] TxID not found on gateway, attempting fallbacks...");

        const fallbackCandidates: Array<string | undefined> = [];

        if (typeof arweaveTxId === "string" && arweaveTxId.trim().length > 0) {
          fallbackCandidates.push(undefined);
        }

        const latestFromTags = await findLatestArweaveTxIdForVault(normalizedVaultId);
        if (
          typeof latestFromTags === "string" &&
          latestFromTags.trim().length > 0 &&
          latestFromTags.trim() !== (typeof arweaveTxId === "string" ? arweaveTxId.trim() : "")
        ) {
          fallbackCandidates.push(latestFromTags.trim());
        }

        for (const candidate of fallbackCandidates) {
          const fb = await callBackend(candidate);
          lastResponse = fb.response;
          lastData = fb.data;

          if (fb.response.ok && fb.data.success) {
            return NextResponse.json({
              success: true,
              securityQuestions: fb.data.securityQuestions || [],
              willType: fb.data.willType || "one-time",
              trigger: fb.data.trigger || null,
              latestTxId: fb.data.latestTxId || null,
              message: fb.data.message || "Security questions verified.",
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

      // For 4xx client errors (except 404), don't retry - it's likely a real validation error
      if (primary.response.status >= 400 && primary.response.status < 500 && primary.response.status !== 404) {
        console.log(`⚠️ [claim/verify] Client error ${primary.response.status}, not retrying`);
        break;
      }

      // For 5xx server errors or 404 (might be cold-start), retry
      console.log(`⚠️ [claim/verify] Error ${primary.response.status} on attempt ${attempt}, will retry...`);
      
      // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    } catch (error) {
      console.error(`❌ [claim/verify] Network error on attempt ${attempt}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  // All retries exhausted - return the last error
  if (lastResponse) {
    const message =
      typeof lastData.error === "string"
        ? lastData.error
        : "Unable to retrieve security questions. Please verify the Vault ID.";
    return NextResponse.json(
      { success: false, error: message },
      { status: lastResponse.status || 500 },
    );
  }

  // Network error case
  const message = lastError?.message || "An error occurred while contacting the backend verify service.";
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 },
  );
}
