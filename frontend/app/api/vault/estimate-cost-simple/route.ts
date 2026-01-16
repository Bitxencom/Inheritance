import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  const payload = await req.json();
  const { dataSizeBytes } = payload as {
    dataSizeBytes?: number;
  };

  if (!dataSizeBytes || typeof dataSizeBytes !== "number" || dataSizeBytes <= 0) {
    return NextResponse.json(
      { success: false, error: "dataSizeBytes must be a positive number" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${backendBaseUrl}/api/v1/vaults/estimate-cost-simple`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataSizeBytes,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Failed to calculate cost estimate.";
      return NextResponse.json(
        { success: false, error: message },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: data.message || "Cost estimate calculated successfully.",
      estimate: data.estimate || null,
    });
  } catch (error) {
    console.error("❌ Backend estimate-cost-simple service failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "An error occurred while contacting backend estimate-cost service.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
