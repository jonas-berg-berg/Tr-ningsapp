import { describe, expect, it } from 'vitest';
import { isCalendarUrl, maskUrl } from './url';

describe('isCalendarUrl', () => {
  it('godtar https och webcal', () => {
    expect(isCalendarUrl('https://portalweb.sportadmin.se/webcal?id=abc')).toBe(true);
    expect(isCalendarUrl('webcal://portalweb.sportadmin.se/webcal?id=abc')).toBe(true);
  });
  it('nekar http, andra scheman och skräp', () => {
    expect(isCalendarUrl('http://portalweb.sportadmin.se/webcal?id=abc')).toBe(false);
    expect(isCalendarUrl('javascript:alert(1)')).toBe(false);
    expect(isCalendarUrl('https://')).toBe(false);
    expect(isCalendarUrl('portalweb.sportadmin.se')).toBe(false);
  });
});

describe('maskUrl', () => {
  it('visar de första 30 tecknen och en ellips', () => {
    const url = 'https://portalweb.sportadmin.se/webcal?id=0123456789abcdef-hemligt';
    expect(maskUrl(url)).toBe('https://portalweb.sportadmin.s…');
    expect(maskUrl(url)).not.toContain('hemligt');
  });
  it('korta värden visas aldrig hela', () => {
    expect(maskUrl('https://a.se')).toBe('https:…');
  });
});
