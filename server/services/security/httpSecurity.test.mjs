import { describe, expect, it } from 'vitest';
import { applyHttpSecurityHeaders, SlidingWindowRateLimiter } from './httpSecurity.mjs';

describe('HTTP security', () => {
  it('blocks after the configured sliding-window limit and returns a retry delay', () => {
    const limiter = new SlidingWindowRateLimiter(); expect(limiter.consume('user', 2, 1_000, 0).allowed).toBe(true); expect(limiter.consume('user', 2, 1_000, 100).allowed).toBe(true);
    const blocked = limiter.consume('user', 2, 1_000, 200); expect(blocked.allowed).toBe(false); expect(blocked.retryAfterSeconds).toBe(1); expect(limiter.consume('user', 2, 1_000, 1_001).allowed).toBe(true);
  });

  it('only reflects explicitly allowed CORS origins', () => {
    const headers = new Map(); const response = { setHeader: (name, value) => headers.set(name, value) };
    expect(applyHttpSecurityHeaders({ headers: { origin: 'https://tuning.example' } }, response, 'https://tuning.example', 'production')).toBe(true);
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://tuning.example');
    const deniedHeaders = new Map(); expect(applyHttpSecurityHeaders({ headers: { origin: 'https://evil.example' } }, { setHeader: (name, value) => deniedHeaders.set(name, value) }, 'https://tuning.example', 'production')).toBe(false);
    expect(deniedHeaders.has('Access-Control-Allow-Origin')).toBe(false);
  });
});
