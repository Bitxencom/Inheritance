import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

interface VerifyFractionKeysRequest {
  vaultId: string;
  fractionKeys: {
    key1: string;
    key2: string;
    key3: string;
  };
}

export async function POST(req: Request) {
  let payload: VerifyFractionKeysRequest;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const { vaultId, fractionKeys } = payload;

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  if (!fractionKeys || !fractionKeys.key1 || !fractionKeys.key2 || !fractionKeys.key3) {
    return NextResponse.json(
      { success: false, error: "Please provide all required Fraction Keys." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/verify-fraction-keys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fractionKeys,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Unable to verify Fraction Keys.";
      return NextResponse.json(
        { 
          success: false, 
          error: message,
        },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message || "Fraction Keys verified.",
    });
  } catch (error) {
    console.error("❌ Backend verify-fraction-keys service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting backend verify service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
