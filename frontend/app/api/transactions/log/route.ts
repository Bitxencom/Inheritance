import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_BASE_URL || "http://localhost:7002";

/**
 * POST /api/transactions/log
 * Proxy to backend transaction logging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/transactions/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Transaction log error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to log transaction",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions/log
 * Get all transaction logs
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/transactions`, {
      method: "GET",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Transaction get error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get transactions",
      },
      { status: 500 }
    );
  }
}
