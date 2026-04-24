import { createHmac } from "crypto";
import { Request } from "express";

import { verifySecurityAnswerHash } from "../../services/crypto-utils.js";

// Internal HMAC key untuk komputasi claim nonce & required indexes.
// Nilai ini statis dan tidak lagi dikonfigurasi via environment variable.
const UNLOCK_POLICY_HMAC_KEY = "unlock-policy-v1-hmac-key";

// ──────────────────────────────────────────────────
// Unlock policy
// ──────────────────────────────────────────────────
export const unlockPolicyV1 = {
    policyVersion: 1,
    requiredCorrect: 3,
    minPoints: 50,
} as const;

// ──────────────────────────────────────────────────
// Rate limiting (in-memory)
// ──────────────────────────────────────────────────
const verifyAttemptStore = new Map<
    string,
    { count: number; windowStartedAt: number; lockedUntil?: number }
>();

const VERIFY_WINDOW_MS = 1 * 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 60;
const VERIFY_LOCK_MS = 1 * 60 * 1000;

export const getClientIp = (req: { ip?: string; headers?: Record<string, unknown> }): string => {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return typeof req.ip === "string" && req.ip.trim() ? req.ip : "unknown";
};

export const rateLimitVerify = (req: Request, vaultId: string) => {
    const ip = getClientIp(req);
    const key = `${vaultId}::${ip}`;
    const now = Date.now();
    const existing = verifyAttemptStore.get(key);

    if (existing?.lockedUntil && existing.lockedUntil > now) {
        return { ok: false as const, retryAfterMs: existing.lockedUntil - now };
    }
    if (!existing || now - existing.windowStartedAt > VERIFY_WINDOW_MS) {
        verifyAttemptStore.set(key, { count: 1, windowStartedAt: now });
        return { ok: true as const };
    }

    const nextCount = existing.count + 1;
    if (nextCount > VERIFY_MAX_ATTEMPTS) {
        verifyAttemptStore.set(key, {
            count: nextCount,
            windowStartedAt: existing.windowStartedAt,
            lockedUntil: now + VERIFY_LOCK_MS,
        });
        return { ok: false as const, retryAfterMs: VERIFY_LOCK_MS };
    }

    verifyAttemptStore.set(key, { ...existing, count: nextCount });
    return { ok: true as const };
};

// ──────────────────────────────────────────────────
// Claim nonce & required indexes
// ──────────────────────────────────────────────────
const toBase64Url = (buffer: Buffer): string =>
    buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

export const computeClaimNonce = (params: {
    vaultId: string;
    latestTxId: string | null | undefined;
}): string => {
    const h = createHmac("sha256", UNLOCK_POLICY_HMAC_KEY);
    h.update(`claimNonce:v1:${params.vaultId}:${params.latestTxId ?? ""}`, "utf8");
    return toBase64Url(h.digest()).slice(0, 43);
};

export const selectRequiredIndexes = (params: {
    totalQuestions: number;
    claimNonce: string;
}): number[] => {
    const total = Math.max(0, Math.floor(params.totalQuestions));
    const target = Math.min(3, total);
    const scored = Array.from({ length: total }, (_, index) => {
        const h = createHmac("sha256", UNLOCK_POLICY_HMAC_KEY);
        h.update(`requiredIndexes:v1:${params.claimNonce}:${index}`, "utf8");
        return { index, score: h.digest("hex") };
    });
    scored.sort((a, b) => a.score.localeCompare(b.score));
    return scored
        .slice(0, target)
        .map((x) => x.index)
        .sort((a, b) => a - b);
};

// ──────────────────────────────────────────────────
// Security answer verification helpers
// ──────────────────────────────────────────────────
export type StoredHash = {
    q?: string;
    a?: string;
    question?: string;
    answerHash?: string;
    hashes?: string[];
    mode?: string;
    normalizationProfile?: string;
    profileVersion?: number;
    scoreTier?: string;
    points?: number;
};

const getHashCandidatesForEntry = (
    entry: Record<string, unknown>,
): { hashes: string[]; normalizationProfile: "none" | "default" } => {
    const hashesRaw = entry.hashes;
    if (Array.isArray(hashesRaw)) {
        const hashes = hashesRaw.filter((h): h is string => typeof h === "string" && h.length > 0);
        if (hashes.length > 0) {
            const normalizationProfileRaw = entry.normalizationProfile;
            const normalizationProfile =
                normalizationProfileRaw === "none" || normalizationProfileRaw === "default"
                    ? normalizationProfileRaw
                    : entry.mode === "exact"
                        ? "none"
                        : "default";
            return { hashes, normalizationProfile };
        }
    }
    const single = entry.a ?? entry.answerHash;
    if (typeof single === "string" && single.length > 0) {
        return { hashes: [single], normalizationProfile: "default" };
    }
    return { hashes: [], normalizationProfile: "default" };
};

export const verifyAnswerAgainstEntry = (answer: string, entry: Record<string, unknown>): boolean => {
    const { hashes, normalizationProfile } = getHashCandidatesForEntry(entry);
    if (hashes.length === 0) return false;
    for (const h of hashes) {
        if (verifySecurityAnswerHash(answer, h, { normalizationProfile })) return true;
    }
    return false;
};

export const getEntryPoints = (
    entry: Record<string, unknown>,
): { points: number | null; tier: "low" | "medium" | "high" | null } => {
    const pointsRaw = entry.points;
    if (typeof pointsRaw === "number" && Number.isFinite(pointsRaw)) {
        const points = Math.floor(pointsRaw);
        if (points === 10) return { points, tier: "low" };
        if (points === 20) return { points, tier: "medium" };
        if (points === 30) return { points, tier: "high" };
    }

    const tierRaw = entry.scoreTier;
    if (typeof tierRaw === "string") {
        const norm = tierRaw.trim().toLowerCase();
        if (norm === "low") return { points: 10, tier: "low" };
        if (norm === "medium") return { points: 20, tier: "medium" };
        if (norm === "high") return { points: 30, tier: "high" };
    }

    return { points: null, tier: null };
};

// ──────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────
export const formatSize = (bytes: number, unit: "KB" | "MB"): string => {
    const value = unit === "KB" ? bytes / 1024 : bytes / (1024 * 1024);
    return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
};
