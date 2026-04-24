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
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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

      const raw = await response.text();
      const data: unknown = (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return null;
        }
      })();

      if (!response.ok) {
        const message =
          (data &&
            typeof data === "object" &&
            (typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : typeof (data as { message?: unknown }).message === "string"
                ? (data as { message: string }).message
                : "")) ||
          raw ||
          "Failed to prepare vault";
        return NextResponse.json(
          { success: false, error: message },
          { status: response.status || 500 },
        );
      }

      if (data && typeof data === "object") {
        return NextResponse.json(data);
      }

      return NextResponse.json(
        { success: true, data: raw },
        { status: 200 },
      );
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error("❌ Prepare client-encrypted vault error:", error);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Request timeout while preparing vault. Please try again.",
          },
          { status: 504 },
        );
      }
      const msg = error.message.toLowerCase();
      if (msg.includes("entity too large") || msg.includes("request entity too large")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Payload terlalu besar. Kurangi ukuran attachment atau naikkan batas upload server.",
          },
          { status: 413 },
        );
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
