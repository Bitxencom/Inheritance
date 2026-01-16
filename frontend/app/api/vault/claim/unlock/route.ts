import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const { vaultId, securityQuestionAnswers, fractionKeys } = payload;

  if (!vaultId || !fractionKeys) {
    return NextResponse.json(
      { success: false, error: "Please provide both the Vault ID and your Fraction Keys." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/vaults/${vaultId}/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        securityQuestionAnswers,
        // Only send non-empty fraction keys
        fractionKeys: Object.values(fractionKeys).filter(
          (value: unknown) =>
            typeof value === "string" && value.trim() !== "",
        ),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        vaultContent: data.vaultContent || null,
        vaultTitle: data.vaultTitle || null,
        documents: data.documents || [],
        message: data.message || "Vault unlocked successfully.",
      });
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || "Unable to unlock vault. Please check your keys and try again.";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: response.status || 500 },
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
