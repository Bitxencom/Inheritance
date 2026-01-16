import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

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

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is missing." },
      { status: 400 },
    );
  }

  const maxRetries = 3;
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let lastData: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 [claim/verify] Attempt ${attempt}/${maxRetries} to backend`);
      
      const response = await fetch(
        `${backendBaseUrl}/api/v1/vaults/${vaultId}/security-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // Forward arweaveTxId to backend if provided (for version-specific lookup)
          body: JSON.stringify({ arweaveTxId }),
        },
      );

      const data = await response.json().catch(() => ({}));
      lastResponse = response;
      lastData = data;

      // Success case - return immediately
      if (response.ok && data.success) {
        console.log(`✅ [claim/verify] Success on attempt ${attempt}`);
        return NextResponse.json({
          success: true,
          securityQuestions: data.securityQuestions || [],
          willType: data.willType || "one-time",
          trigger: data.trigger || null,
          latestTxId: data.latestTxId || null,
          message: data.message || "Security questions verified.",
        });
      }

      // For 4xx client errors (except 404), don't retry - it's likely a real validation error
      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        console.log(`⚠️ [claim/verify] Client error ${response.status}, not retrying`);
        break;
      }

      // For 5xx server errors or 404 (might be cold-start), retry
      console.log(`⚠️ [claim/verify] Error ${response.status} on attempt ${attempt}, will retry...`);
      
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
