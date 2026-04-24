import { NextResponse } from "next/server";

const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, "") || "http://localhost:7002";

export async function POST(req: Request) {
  let payload: { vaultId?: string; chain?: string; contractDataId?: string; contractAddress?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const vaultId = typeof payload.vaultId === "string" ? payload.vaultId.trim() : "";
  if (!vaultId) {
    return NextResponse.json({ success: false, error: "vaultId is required." }, { status: 400 });
  }

  const backendUrl = `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(vaultId)}/finalize-release`;

  const forwardBody: Record<string, string> = {};
  if (payload.chain) forwardBody.chain = payload.chain;
  if (payload.contractDataId) forwardBody.contractDataId = payload.contractDataId;
  if (payload.contractAddress) forwardBody.contractAddress = payload.contractAddress;

  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody),
    });
  } catch (err) {
    console.error("[finalize] Backend request failed:", err);
    return NextResponse.json({ success: false, error: "Backend unreachable." }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await backendRes.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid backend response." }, { status: 502 });
  }

  return NextResponse.json(data, { status: backendRes.status });
}
