"use client";

// Mainnet Drand Quicknet (2s interval)
const QUICKNET_GENESIS_TIME = 1692803367000; // in ms
const QUICKNET_PERIOD = 3000; // 3 seconds

/**
 * Calculates the Drand ronde for a specific timestamp (in seconds).
 */
export function timestampToDrandRonde(timestampInSeconds: number): number {
    const timestampMs = timestampInSeconds * 1000;
    if (timestampMs < QUICKNET_GENESIS_TIME) {
        return 1;
    }
    const elapsed = timestampMs - QUICKNET_GENESIS_TIME;
    return Math.floor(elapsed / QUICKNET_PERIOD) + 1;
}
