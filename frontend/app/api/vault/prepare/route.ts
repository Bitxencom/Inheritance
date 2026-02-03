import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Backend encryption is deprecated. Use client-side encryption and call /api/vault/prepare-client.",
    },
    { status: 410 },
  );
}
