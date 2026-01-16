import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  const payload = await req.json();
  const { vaultId, willDetails, fractionKeys, securityQuestionAnswers } = payload as {
    vaultId?: string;
    willDetails?: { 
      title?: string; 
      content?: string;
      documents?: Array<{
        name: string;
        size: number;
        type: string;
        content?: string;
      }>;
    };
    fractionKeys?: Record<string, string>;
    securityQuestionAnswers?: Array<{
      question?: string;
      answer: string;
    }>;
  };

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  if (!willDetails?.title || !willDetails?.content) {
    return NextResponse.json(
      {
        success: false,
        error: "Please provide a title and content for your vault.",
      },
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
        error: "You need at least 3 Fraction Keys to authorize changes.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/edit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          willDetails: {
            title: willDetails.title,
            content: willDetails.content,
            documents: willDetails.documents || [],
          },
          fractionKeys: nonEmptyFractionKeys,
          securityQuestionAnswers: securityQuestionAnswers || [],
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Unable to save changes to the vault.";
      return NextResponse.json(
        { success: false, error: message },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        data.message ||
        "Vault updated successfully.",
      details: data.details || null,
      shouldDispatch: data.shouldDispatch,
    });
  } catch (error) {
    console.error("❌ Backend edit vault service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting the backend edit service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}


