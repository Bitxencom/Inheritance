import { NextRequest, NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

// Using POST instead of GET to avoid URL length limit issues with large fraction keys
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ vaultId: string; documentIndex: string }> },
) {
  const { vaultId, documentIndex } = await params;
  
  let body: { fractionKeys?: string[]; securityQuestionAnswers?: Array<{ question?: string; answer: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { fractionKeys, securityQuestionAnswers } = body;

  if (!vaultId || !documentIndex) {
    return NextResponse.json(
      { success: false, error: "Vault ID and document index are required." },
      { status: 400 },
    );
  }

  if (!fractionKeys || !Array.isArray(fractionKeys) || fractionKeys.length < 3) {
    return NextResponse.json(
      { success: false, error: "At least 3 fraction keys are required." },
      { status: 400 },
    );
  }

  try {
    // Send fraction keys in request body to backend (POST)
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/document/${documentIndex}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fractionKeys,
          securityQuestionAnswers,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error || "Failed to download document." },
        { status: response.status },
      );
    }

    // Get blob from response
    const blob = await response.blob();
    
    // Get content type and filename from headers
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "document";
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ""));
      }
    }

    // Return file with appropriate headers
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("❌ Backend download document service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting backend download service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
