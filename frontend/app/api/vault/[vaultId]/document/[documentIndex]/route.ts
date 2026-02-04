import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Backend document download is deprecated. Unlock and decrypt documents on the client instead.",
    },
    { status: 410 },
  );
}
