// Payment Methods Configuration
// Toggle payment methods on/off here

export interface PaymentMethodConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: string;
}

export const PAYMENT_METHODS_CONFIG = {
  /**
   * Wander Wallet - Arweave native payment
   * Uses AR token directly for storage fees
   */
  wander: {
    id: "wander",
    name: "Wander Wallet",
    description: "Arweave (AR)",
    enabled: true, // ✅ Enabled
  },
} as const;

// Type for payment method keys
export type PaymentMethodId = keyof typeof PAYMENT_METHODS_CONFIG;

/**
 * Get list of enabled payment methods
 */
export function getEnabledPaymentMethods(): PaymentMethodId[] {
  return (Object.keys(PAYMENT_METHODS_CONFIG) as PaymentMethodId[]).filter(
    (key) => PAYMENT_METHODS_CONFIG[key].enabled
  );
}

/**
 * Check if a specific payment method is enabled
 */
export function isPaymentMethodEnabled(method: PaymentMethodId): boolean {
  return PAYMENT_METHODS_CONFIG[method]?.enabled ?? false;
}

/**
 * Get the default payment method (first enabled method)
 */
export function getDefaultPaymentMethod(): PaymentMethodId {
  const enabledMethods = getEnabledPaymentMethods();
  return enabledMethods[0] ?? "wander";
}

/**
 * Get payment method config by id
 */
export function getPaymentMethodConfig(method: PaymentMethodId) {
  return PAYMENT_METHODS_CONFIG[method];
}
