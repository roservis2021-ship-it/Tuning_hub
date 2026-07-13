export interface CheckoutSessionStatus {
  checkoutType: 'plan_action' | 'extra_build';
  purchaseStatus: 'pending' | 'active' | 'cancelled' | 'expired' | 'failed';
  entitlementActive: boolean;
  requiresAccount?: boolean;
  activationStatus: string;
}

export function getCheckoutSessionStatus(sessionId: string, claimToken?: string): Promise<CheckoutSessionStatus>;
export function claimPremiumPurchase(input: { purchaseId: string; claimToken: string }): Promise<{ claimed: boolean; entitlementId: string }>;
export function createCheckoutSession(input: { vehicleName?: string; buildId?: string; checkoutType?: 'plan_action' | 'extra_build' }): Promise<{ id: string; url: string; purchaseId: string }>;
export function createEmbeddedCheckoutSession(input: { vehicleName?: string; buildId?: string; checkoutType?: 'plan_action' | 'extra_build' }): Promise<{ id: string; clientSecret: string; purchaseId: string }>;
