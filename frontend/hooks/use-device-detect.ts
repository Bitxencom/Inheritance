/**
 * useDeviceDetect — SSR-safe device detection hook
 * menggunakan package `current-device`
 *
 * Pemakaian:
 *   const { isMobile, isDesktop, isAndroid, isIos } = useDeviceDetect();
 *
 * Deteksi berdasarkan userAgent (bukan viewport width),
 * sehingga akurat juga di desktop browser yang di-resize kecil.
 */
"use client";

import { useState, useEffect } from "react";

interface DeviceInfo {
    isMobile: boolean;
    isDesktop: boolean;
    isTablet: boolean;
    isAndroid: boolean;
    isIos: boolean;
    isSSR: boolean;
}

export function useDeviceDetect(): DeviceInfo {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
        isMobile: false,
        isDesktop: true,
        isTablet: false,
        isAndroid: false,
        isIos: false,
        isSSR: false,
    });

    useEffect(() => {
        // Dynamic import agar tidak dieksekusi di sisi server (SSR)
        import("current-device").then(({ default: device }) => {
            setDeviceInfo({
                isMobile: device.mobile(),
                isDesktop: device.desktop(),
                isTablet: device.tablet(),
                isAndroid: device.android(),
                isIos: device.ios(),
                isSSR: false,
            });
        });
    }, []);

    return deviceInfo;
}
