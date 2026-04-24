// Background service worker required by manifest V3
chrome.runtime.onInstalled.addListener(() => {
    console.log("Bitxen Inheritance Unlock extension installed");
});

// Listen for finalize-result messages from the Bitxen frontend (externally_connectable)
chrome.runtime.onMessageExternal.addListener(
    (message: unknown, _sender, sendResponse) => {
        if (
            message &&
            typeof message === "object" &&
            (message as { type?: string }).type === "BITXEN_FINALIZE_RESULT"
        ) {
            const payload = message as {
                type: string;
                success: boolean;
                releaseEntropy?: string;
                error?: string;
            };

            // Store result in chrome.storage.local so the popup can pick it up
            chrome.storage.local.set({
                "extension-finalize-result": {
                    success: payload.success,
                    releaseEntropy: payload.releaseEntropy ?? null,
                    error: payload.error ?? null,
                    timestamp: Date.now(),
                },
            });

            sendResponse({ ok: true });
        }
        return true; // keep channel open for async response
    }
);
