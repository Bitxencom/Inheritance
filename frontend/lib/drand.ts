"use client";

import { HttpChainClient, HttpCachingChain, fetchBeacon } from "drand-client";

// Mainnet Drand Quicknet (2s interval)
const QUICKNET_CHAIN_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_PUBLIC_KEY = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";
const QUICKNET_URL = "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
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

/**
 * Fetches a Drand beacon for a specific ronde.
 */
export async function getDrandBeacon(ronde: number) {
    const options = {
        disableBeaconVerification: false,
        noCache: false,
        chainVerificationParams: {
            chainHash: QUICKNET_CHAIN_HASH,
            publicKey: QUICKNET_PUBLIC_KEY,
        }
    };
    const chainClient = new HttpChainClient(new HttpCachingChain(QUICKNET_URL), options);
    return await fetchBeacon(chainClient, ronde);
}

/**
 * Gets the current Drand ronde.
 */
export function getCurrentDrandRonde(): number {
    return timestampToDrandRonde(Math.floor(Date.now() / 1000));
}
