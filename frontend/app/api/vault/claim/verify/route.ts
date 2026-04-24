import { NextResponse } from "next/server";

const normalizeBackendBaseUrl = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const unwrapped =
    trimmed.startsWith("`") && trimmed.endsWith("`")
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unwrapped.replace(/\/$/, "");
};

const backendBaseUrl =
  normalizeBackendBaseUrl(process.env.DEHERITANCE_BACKEND_BASE_URL) ||
  normalizeBackendBaseUrl(process.env.BACKEND_BASE_URL) ||
  (String(process.env.DOCKER_ENV ?? "").toLowerCase() === "true"
    ? "http://backend:7020"
    : "http://localhost:7020");

type VerifyClaimRequest = {
  vaultId?: string;
  arweaveTxId?: string | null;
};

export async function POST(req: Request) {
  let payload: VerifyClaimRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const vaultId = typeof payload.vaultId === "string" ? payload.vaultId.trim() : "";
  const arweaveTxId =
    typeof payload.arweaveTxId === "string" ? payload.arweaveTxId.trim() : undefined;

  if (!vaultId) {
    return NextResponse.json(
      { success: false, error: "Vault ID is required." },
      { status: 400 },
    );
  }

  const maxRetries = 3;
  let lastResponse: Response | null = null;
  let lastData: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${backendBaseUrl}/api/v1/vaults/${encodeURIComponent(vaultId)}/security-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ arweaveTxId }),
        },
      );

      const data = await response.json().catch(() => ({}));
      lastResponse = response;
      lastData = data;

      if (response.ok && (data as { success?: boolean }).success) {
        const typed = data as {
          success: true;
          securityQuestions?: string[];
          requiredIndexes?: unknown;
          claimNonce?: unknown;
          unlockPolicy?: unknown;
          willType?: string;
          trigger?: unknown;
          latestTxId?: string | null;
          message?: string;
        };

        return NextResponse.json({
          success: true,
          securityQuestions: typed.securityQuestions || [],
          requiredIndexes: Array.isArray(typed.requiredIndexes)
            ? typed.requiredIndexes
                .map((x) => Number(x))
                .filter(Number.isFinite)
            : [],
          claimNonce:
            typeof typed.claimNonce === "string"
              ? (typed.claimNonce || null)
              : null,
          unlockPolicy:
            typed.unlockPolicy &&
            typeof typed.unlockPolicy === "object"
              ? typed.unlockPolicy
              : null,
          willType: typed.willType || "one-time",
          trigger: typed.trigger || null,
          latestTxId: typed.latestTxId || null,
          message: typed.message || "Security questions loaded.",
        });
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        break;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed to connect to ${backendBaseUrl}:`, error);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
  }

  if (!lastResponse) {
    return NextResponse.json(
      { success: false, error: "Service unavailable. Could not connect to backend server." },
      { status: 503 }
    );
  }

  const statusFromBackend = lastResponse.status;
  const data = (lastData || {}) as { error?: string; message?: string };
  const fallbackMessage =
    "Failed to load security questions. Please ensure the Vault ID is correct and the vault is confirmed.";
  const message =
    typeof data.error === "string"
      ? data.error
      : typeof data.message === "string"
        ? data.message
        : fallbackMessage;

  return NextResponse.json({ success: false, error: message }, { status: statusFromBackend });
}
