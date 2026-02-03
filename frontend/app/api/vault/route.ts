import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json(
    { success: false, error: "This endpoint is deprecated. Use /api/vault/prepare-client" },
    { status: 410 }
  );
}
