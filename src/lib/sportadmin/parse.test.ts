import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toStockholmDate } from '../dates';
import { parseFeed } from './parse';

const fixture = readFileSync('tests/fixtures/sportadmin.ics', 'utf8');

describe('parseFeed', () => {
  const ev = parseFeed(fixture);
  it('läser alla fem händelser', () => {
    expect(ev).toHaveLength(5);
  });
  it('tolkar Stockholmstid till UTC', () => {
    const t = ev.find((e) => e.summary.startsWith('Träning'))!;
    expect(t.startsAt.toISOString()).toBe('2026-11-17T18:00:00.000Z');
    expect(t.endsAt.toISOString()).toBe('2026-11-17T19:40:00.000Z');
    expect(t.location).toBe('Lerums Idrottshall');
  });
  it('hittar två matcher 2026-12-06', () => {
    expect(ev.filter((e) => toStockholmDate(e.startsAt) === '2026-12-06')).toHaveLength(2);
  });
  it('alla har uid', () => {
    expect(ev.every((e) => e.uid.length > 0)).toBe(true);
  });
  it('behåller riktig radbrytning i description', () => {
    const d = ev.find((e) => e.description?.includes('Uppvärmning'))!;
    expect(d.description).toContain('\n');
    expect(d.description).not.toContain('\\n');
  });
  it('sätter null för tomma fält', () => {
    const t = ev.find((e) => e.summary.startsWith('Fotografering'))!;
    expect(t.description).toBeNull();
  });
});
