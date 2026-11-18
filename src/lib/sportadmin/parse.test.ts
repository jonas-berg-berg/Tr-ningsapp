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

describe('parseFeed – härdning', () => {
  const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\n${body}END:VCALENDAR\r\n`;
  it('hoppar över VEVENT utan UID', () => {
    const ics = wrap('BEGIN:VEVENT\r\nDTSTART:20261201T100000Z\r\nSUMMARY:Utan uid\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:ok\r\nDTSTART:20261201T100000Z\r\nSUMMARY:Med uid\r\nEND:VEVENT\r\n');
    expect(parseFeed(ics).map((e) => e.uid)).toEqual(['ok']);
  });
  it('hoppar över VEVENT utan eller med ogiltig DTSTART', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Ingen start\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b\r\nDTSTART:garbage\r\nSUMMARY:Trasig\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:c\r\nDTSTART:20261201T100000Z\r\nSUMMARY:Bra\r\nEND:VEVENT\r\n');
    expect(parseFeed(ics).map((e) => e.uid)).toEqual(['c']);
  });
  it('packar upp { params, val } för textfält', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:p\r\nDTSTART:20261201T100000Z\r\nSUMMARY;LANGUAGE=sv:Träning med param\r\nLOCATION;X-FOO=1:Hallen\r\nDESCRIPTION;LANGUAGE=sv:Beskrivning\r\nEND:VEVENT\r\n');
    const [e] = parseFeed(ics);
    expect(e.summary).toBe('Träning med param');
    expect(e.location).toBe('Hallen');
    expect(e.description).toBe('Beskrivning');
  });
});
