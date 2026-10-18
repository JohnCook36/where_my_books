import { describe, expect, it } from 'vitest';
import { corsAllowedOrigins, corsOriginAllowed } from './cors.js';

describe('CORS allowlist', () => {
  it('rejects all browser origins by default in production', () => {
    const allowed = corsAllowedOrigins(undefined, true);
    expect(allowed).toEqual([]);
    expect(corsOriginAllowed('https://attacker.invalid', allowed)).toBe(false);
    expect(corsOriginAllowed(undefined, allowed)).toBe(true);
  });
  it('accepts only exactly configured origins', () => {
    const allowed = corsAllowedOrigins('https://books.example.test, https://other.example.test,https://books.example.test', true);
    expect(allowed).toHaveLength(2);
    expect(corsOriginAllowed('https://books.example.test', allowed)).toBe(true);
    expect(corsOriginAllowed('https://books.example.test.evil.invalid', allowed)).toBe(false);
    expect(corsOriginAllowed('http://books.example.test', allowed)).toBe(false);
    expect(corsOriginAllowed('null', allowed)).toBe(false);
  });
});
