import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const vaultId =
      payload && typeof payload === "object" && "vaultId" in payload
        ? String((payload as { vaultId?: unknown }).vaultId || "").trim()
        : "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const requestBody =
        vaultId.length > 0 && payload && typeof payload === "object"
          ? (() => {
              const body = { ...(payload as Record<string, unknown>) };
              delete body.vaultId;
              return body;
            })()
          : payload;

      const response = await fetch(
        vaultId.length > 0
          ? `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(vaultId)}/prepare-client`
          : `${backendBaseUrl}/api/v1/vaults/prepare-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to prepare vault");
      }

      return NextResponse.json(data);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error("❌ Prepare client-encrypted vault error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
