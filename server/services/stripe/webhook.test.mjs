import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { entitlementIdFor, getPaymentTransition, verifyStripeWebhook } from './webhook.mjs';

const secret = 'whsec_test_secret';
const timestamp = 1_720_000_000;

function signedEvent(overrides = {}) {
  const event = {
    id: 'evt_1', type: 'checkout.session.completed', created: timestamp,
    data: { object: { id: 'cs_1', client_reference_id: 'user_1', payment_status: 'paid', amount_total: 499, currency: 'eur', metadata: { uid: 'user_1', purchaseId: 'purchase_1', checkoutType: 'plan_action' } } },
    ...overrides,
  };
  const rawBody = JSON.stringify(event);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return { rawBody, header: `t=${timestamp},v1=${signature}` };
}

describe('Stripe webhook verification', () => {
  it('accepts a correctly signed raw body', () => {
    const fixture = signedEvent();
    expect(verifyStripeWebhook(fixture.rawBody, fixture.header, secret, { nowSeconds: timestamp }).id).toBe('evt_1');
  });

  it('rejects a modified body and an expired signature', () => {
    const fixture = signedEvent();
    expect(() => verifyStripeWebhook(`${fixture.rawBody} `, fixture.header, secret, { nowSeconds: timestamp })).toThrow();
    expect(() => verifyStripeWebhook(fixture.rawBody, fixture.header, secret, { nowSeconds: timestamp + 301 })).toThrow();
  });
});

describe('Stripe payment transitions', () => {
  it('activates only a paid checkout and generates a deterministic entitlement id', () => {
    const fixture = signedEvent();
    const transition = getPaymentTransition(JSON.parse(fixture.rawBody));
    expect(transition?.status).toBe('active');
    expect(transition && entitlementIdFor(transition)).toBe('premium_user_1');
    expect(transition && entitlementIdFor({ ...transition, purchaseId: 'another_attempt' })).toBe('premium_user_1');
  });

  it('keeps incomplete payments pending and maps failure lifecycle states', () => {
    const fixture = signedEvent();
    const base = JSON.parse(fixture.rawBody);
    expect(getPaymentTransition({ ...base, data: { object: { ...base.data.object, payment_status: 'unpaid' } } })?.status).toBe('pending');
    expect(getPaymentTransition({ ...base, type: 'checkout.session.async_payment_failed' })?.status).toBe('failed');
    expect(getPaymentTransition({ ...base, type: 'checkout.session.expired' })?.status).toBe('expired');
    expect(getPaymentTransition({ ...base, type: 'customer.subscription.deleted' })?.status).toBe('cancelled');
  });

  it('accepts a server-created guest purchase without granting a user identity', () => {
    const fixture = signedEvent();
    const event = JSON.parse(fixture.rawBody);
    delete event.data.object.metadata.uid;
    event.data.object.client_reference_id = 'purchase_1';
    const transition = getPaymentTransition(event);
    expect(transition?.uid).toBe('');
    expect(transition?.purchaseId).toBe('purchase_1');
  });

  it('ignores unrelated Stripe events', () => {
    const fixture = signedEvent();
    expect(getPaymentTransition({ ...JSON.parse(fixture.rawBody), type: 'payment_intent.created' })).toBeNull();
  });
});
