"use client";

import { UI_CONFIG } from "@/lib/ui-config";

/**
 * Hook to read permanent sidebar hide configuration
 * Only reads from code configuration, cannot be changed via UI
 */
export function useSidebarPermanentHide() {
  return {
    isHidden: UI_CONFIG.sidebarPermanentlyHidden,
  };
}

/**
 * Hook to read permanent topbar hide configuration
 * Only reads from code configuration, cannot be changed via UI
 */
export function useTopbarPermanentHide() {
  return {
    isHidden: UI_CONFIG.topbarPermanentlyHidden,
  };
}

