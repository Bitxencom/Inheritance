/**
 * UI Configuration - Permanently Hidden
 * 
 * Set here to permanently hide sidebar and topbar.
 * Can only be changed via code, cannot be changed via UI.
 */

export const UI_CONFIG = {
  /**
   * Set true to permanently hide sidebar
   * Set false to show sidebar (default)
   */
  sidebarPermanentlyHidden: true,

  /**
   * Set true to permanently hide topbar
   * Set false to show topbar (default)
   */
  topbarPermanentlyHidden: true,
} as const;

