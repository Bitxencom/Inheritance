import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Server-side fraction key verification is deprecated. Validate by decrypting the vault on the client instead.",
    },
    { status: 410 },
  );
}
