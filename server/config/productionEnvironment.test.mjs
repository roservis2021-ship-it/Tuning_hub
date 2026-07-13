import { describe, expect, it } from 'vitest';
import { assertProductionEnvironment, productionEnvironmentErrors } from './productionEnvironment.mjs';

const valid = {
  NODE_ENV: 'production', OPENAI_API_KEY: 'configured-openai-key', STRIPE_SECRET_KEY: 'configured-stripe-key',
  STRIPE_WEBHOOK_SECRET: 'configured-webhook-secret', PUBLIC_APP_URL: 'https://app.example.com',
  API_ALLOWED_ORIGINS: 'https://app.example.com', STRIPE_ALLOWED_ORIGINS: 'https://app.example.com',
  NOTIFICATION_SCHEDULER_SECRET: 'configured-scheduler-secret', FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
  OPENAI_MAX_OUTPUT_TOKENS: '4000', OPENAI_PREMIUM_MAX_OUTPUT_TOKENS: '4000', OPENAI_SPECIALIST_DAILY_LIMIT: '20',
};

describe('production environment gate', () => {
  it('accepts an explicit HTTPS production configuration', () => {
    expect(productionEnvironmentErrors(valid)).toEqual([]);
    expect(() => assertProductionEnvironment(valid)).not.toThrow();
  });

  it('rejects placeholders, localhost origins and unsafe AI limits', () => {
    const errors = productionEnvironmentErrors({ ...valid, OPENAI_API_KEY: 'sk-xxxxxxxx', API_ALLOWED_ORIGINS: '*', PUBLIC_APP_URL: 'http://localhost:5173', OPENAI_MAX_OUTPUT_TOKENS: '12000' });
    expect(errors.join(' ')).toContain('OPENAI_API_KEY');
    expect(errors.join(' ')).toContain('HTTPS');
    expect(errors.join(' ')).toContain('6000');
  });

  it('does not block local development', () => {
    expect(productionEnvironmentErrors({ NODE_ENV: 'test' })).toEqual([]);
  });
});
