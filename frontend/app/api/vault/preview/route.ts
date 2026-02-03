import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Backend preview (server-side decryption) is deprecated. Use /unlock and decrypt on the client instead.",
    },
    { status: 410 },
  );
}
