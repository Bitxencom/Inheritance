/**
 * Mobile Wallet Connection Utilities
 *
 * Handles deep-linking to EVM wallets on mobile devices.
 * Works without any external library by leveraging native deep links.
 *
 * Supported wallets:
 *  - MetaMask  (metamask.app.link)
 *  - Trust Wallet (trustwallet.app.link)
 *  - Coinbase Wallet (coinbasewallet://)
 *  - Wander (arweave – via WanderConnect SDK already installed)
 */

export interface MobileWallet {
    id: string;
    name: string;
    icon: string; // path to public/ asset
    /** Universal link that opens the wallet app or its store page */
    universalLink: (dappUrl: string) => string;
    /** Custom URI scheme deep-link (fallback) */
    deepLink?: (dappUrl: string) => string;
    /** Mobile store fallback links */
    storeLinks: {
        ios: string;
        android: string;
    };
}

export const MOBILE_EVM_WALLETS: MobileWallet[] = [
    {
        id: "metamask",
        name: "MetaMask",
        icon: "/metamask-fox.svg",
        universalLink: (dappUrl) =>
            `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, "")}`,
        deepLink: (dappUrl) =>
            `metamask://dapp/${dappUrl.replace(/^https?:\/\//, "")}`,
        storeLinks: {
            ios: "https://apps.apple.com/us/app/metamask/id1438144202",
            android:
                "https://play.google.com/store/apps/details?id=io.metamask",
        },
    },
    {
        id: "trust",
        name: "Trust Wallet",
        icon: "/trust-wallet.svg",
        universalLink: (dappUrl) =>
            `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(dappUrl)}`,
        storeLinks: {
            ios: "https://apps.apple.com/us/app/trust-crypto-bitcoin-wallet/id1288339409",
            android:
                "https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp",
        },
    },
    {
        id: "coinbase",
        name: "Coinbase Wallet",
        icon: "/coinbase-wallet.svg",
        universalLink: (dappUrl) =>
            `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(dappUrl)}`,
        deepLink: (dappUrl) =>
            `coinbasewallet://dapp?url=${encodeURIComponent(dappUrl)}`,
        storeLinks: {
            ios: "https://apps.apple.com/us/app/coinbase-wallet/id1278383455",
            android:
                "https://play.google.com/store/apps/details?id=org.toshi",
        },
    },
];

/**
 * Opens an EVM wallet on mobile device via universal link / deep link.
 * Falls back to the store page if the app is not installed.
 */
export function openMobileWallet(
    wallet: MobileWallet,
    dappUrl: string
): void {
    const link = wallet.universalLink(dappUrl);
    window.location.href = link;
}

/**
 * Get the current dapp URL (safe for SSR).
 */
export function getDappUrl(): string {
    if (typeof window === "undefined") return "";
    return window.location.origin + window.location.pathname;
}
