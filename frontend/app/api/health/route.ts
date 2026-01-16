import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    const response = await fetch(`${backendBaseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        status: "error",
        message: `Backend health check failed: HTTP ${response.status}`,
        services: {
          backend: {
            available: false,
            error: `HTTP ${response.status}`,
          },
          arweave: {
            available: false,
            error: "Cannot check blockchain storage because backend is unavailable",
          },
        },
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      status: data.status || "ok",
      message: data.services?.arweave?.available
        ? (data.services?.arweave?.walletFunded 
            ? "All services available and wallet is funded"
            : "All services available, but wallet is not funded")
        : "Backend available, but blockchain storage is not accessible",
      services: {
        backend: {
          available: true,
          environment: data.environment,
        },
        arweave: {
          available: data.services?.arweave?.available || false,
          gateway: data.services?.arweave?.gateway,
          hasJwk: data.services?.arweave?.hasJwk || false,
          walletFunded: data.services?.arweave?.walletFunded || false,
          walletBalance: data.services?.arweave?.walletBalance || null,
          walletAddress: data.services?.arweave?.walletAddress || null,
          error: data.services?.arweave?.error || null,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Handle timeout or connection error
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({
        success: false,
        status: "error",
        message: "Backend did not respond within 5 seconds",
        services: {
          backend: {
            available: false,
            error: "Timeout - Backend not responding",
          },
          arweave: {
            available: false,
            error: "Cannot check blockchain storage because backend is unavailable",
          },
        },
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      status: "error",
      message: `Cannot connect to backend: ${errorMessage}`,
      services: {
        backend: {
          available: false,
          error: errorMessage,
        },
        arweave: {
          available: false,
          error: "Cannot check blockchain storage because backend is unavailable",
        },
      },
    }, { status: 503 });
  }
}


