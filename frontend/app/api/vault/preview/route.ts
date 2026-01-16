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
  const { vaultId, fractionKeys, securityQuestionAnswers } = payload as {
    vaultId?: string;
    fractionKeys?: Record<string, string>;
    securityQuestionAnswers?: Array<{ question: string; answer: string }>;
  };

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Please provide a Vault ID." },
      { status: 400 },
    );
  }

  if (!fractionKeys) {
    return NextResponse.json(
      { success: false, error: "Fraction Keys are required." },
      { status: 400 },
    );
  }

  const nonEmptyFractionKeys = Object.values(fractionKeys).filter(
    (value) => typeof value === "string" && value.trim() !== "",
  );

  if (nonEmptyFractionKeys.length < 3) {
    return NextResponse.json(
      {
        success: false,
        error: "Please provide at least 3 Fraction Keys to view the vault.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fractionKeys: nonEmptyFractionKeys,
          securityQuestionAnswers: securityQuestionAnswers || [],
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      // Ensure error message is clear
      const errorMessage =
        typeof data.error === "string"
          ? data.error
          : typeof data.message === "string"
            ? data.message
            : `Unable to retrieve vault content. Status: ${response.status}`;
      
      console.error("❌ Backend preview error:", {
        status: response.status,
        error: errorMessage,
        data,
      });
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      willDetails: data.willDetails || null,
      message: data.message || "Vault content loaded.",
    });
  } catch (error) {
    console.error("❌ Backend preview vault service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting backend preview service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
