/**
 * useDeviceDetect — wrapper SSR-safe di atas use-mobile-detect-hook
 *
 * Pemakaian:
 *   const { isMobile, isDesktop, isAndroid, isIos } = useDeviceDetect();
 *
 * Deteksi berdasarkan userAgent (bukan viewport width),
 * sehingga akurat juga di desktop browser yang di-resize kecil.
 */
"use client";

import { useState, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useMobileDetect = require("use-mobile-detect-hook");

interface DeviceInfo {
    isMobile: boolean;
    isDesktop: boolean;
    isAndroid: boolean;
    isIos: boolean;
    isSSR: boolean;
}

export function useDeviceDetect(): DeviceInfo {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
        isMobile: false,
        isDesktop: true,
        isAndroid: false,
        isIos: false,
        isSSR: false,
    });

    useEffect(() => {
        const detect = useMobileDetect();
        setDeviceInfo({
            isMobile: detect.isMobile(),
            isDesktop: detect.isDesktop(),
            isAndroid: detect.isAndroid(),
            isIos: detect.isIos(),
            isSSR: detect.isSSR(),
        });
    }, []);

    return deviceInfo;
}
