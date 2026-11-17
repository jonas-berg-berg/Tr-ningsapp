import { describe, expect, it } from 'vitest';
import { logInsertResult, parseKm } from './log-result';

describe('logInsertResult', () => {
  it('ok utan fel', () => {
    expect(logInsertResult(null)).toEqual({ ok: true });
  });

  it('unique_violation (23505) räknas som ok, så dubbeltryck blir idempotenta', () => {
    expect(logInsertResult({ code: '23505', message: 'duplicate key' })).toEqual({ ok: true });
  });

  it('RLS-nekande (42501) ger ett svenskt felmeddelande', () => {
    expect(logInsertResult({ code: '42501', message: 'new row violates row-level security policy' })).toEqual({
      ok: false,
      error: 'Det går inte att registrera det här passet.',
    });
  });

  it('andra fel ger ett generellt meddelande utan tekniska detaljer', () => {
    const r = logInsertResult({ code: '08006', message: 'connection failure' });
    expect(r.ok).toBe(false);
    expect(r).toEqual({ ok: false, error: 'Något gick fel. Försök igen.' });
  });
});

describe('parseKm', () => {
  it('accepterar komma och punkt', () => {
    expect(parseKm('3,5')).toBe(3.5);
    expect(parseKm('8.25')).toBe(8.25);
    expect(parseKm(' 10 ')).toBe(10);
    expect(parseKm(4)).toBe(4);
  });

  it('kräver > 0 och ≤ 100', () => {
    expect(parseKm('0')).toBeNull();
    expect(parseKm('-2')).toBeNull();
    expect(parseKm('100')).toBe(100);
    expect(parseKm('100,1')).toBeNull();
  });

  it('nekar skräp', () => {
    expect(parseKm('')).toBeNull();
    expect(parseKm('abc')).toBeNull();
    expect(parseKm('3,5,1')).toBeNull();
    expect(parseKm('1e3')).toBeNull();
    expect(parseKm(Number.NaN)).toBeNull();
    expect(parseKm(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
