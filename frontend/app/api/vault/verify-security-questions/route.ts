import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

interface VerifySecurityQuestionsRequest {
  vaultId: string;
  securityQuestionAnswers: Array<{
    question: string;
    answer: string;
  }>;
}

export async function POST(req: Request) {
  let payload: VerifySecurityQuestionsRequest;
  try {
    payload = await req.json();
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const { vaultId, securityQuestionAnswers } = payload;

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  if (!securityQuestionAnswers || securityQuestionAnswers.length === 0) {
    return NextResponse.json(
      { success: false, error: "Please answer the security questions." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/verify-security-questions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          securityQuestionAnswers,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Unable to verify answers. Please try again.";
      return NextResponse.json(
        { 
          success: false, 
          error: message,
          fallbackRequired: data.fallbackRequired || false,
          incorrectIndexes: data.incorrectIndexes || [],
          correctIndexes: data.correctIndexes || [],
        },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message || "Security answers verified.",
    });
  } catch (error) {
    console.error("❌ Backend verify-security-questions service failed:", error);
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
