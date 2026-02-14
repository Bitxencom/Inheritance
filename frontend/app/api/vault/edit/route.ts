import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  const payload = await req.json();
  const { vaultId, encryptedVault, metadata } = payload as {
    vaultId?: string;
    encryptedVault?: { cipherText?: string; iv?: string; checksum?: string; keyMode?: string };
    metadata?: Record<string, unknown>;
  };

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  if (!encryptedVault?.cipherText || !encryptedVault?.iv || !encryptedVault?.checksum) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid encryptedVault. Missing cipherText, iv, or checksum.",
      },
      { status: 400 },
    );
  }

  const encVer =
    metadata && typeof metadata.encryptionVersion === "string"
      ? metadata.encryptionVersion
      : null;
  if (!encVer || (encVer !== "v2-client" && encVer !== "v3-envelope")) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid metadata. encryptionVersion must be 'v2-client' or 'v3-envelope'.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/${vaultId}/prepare-client`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encryptedVault,
          metadata,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Unable to prepare the updated vault for upload.";
      return NextResponse.json(
        { success: false, error: message },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        data.message ||
        "Vault update prepared successfully.",
      details: data.details || null,
      shouldDispatch: data.shouldDispatch,
    });
  } catch (error) {
    console.error("❌ Backend prepare-client (edit) service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting the backend prepare-client service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
