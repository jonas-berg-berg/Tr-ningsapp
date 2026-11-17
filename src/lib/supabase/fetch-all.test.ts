import { describe, expect, it } from 'vitest';
import { fetchAll } from './fetch-all';

describe('fetchAll', () => {
  it('hämtar sida efter sida tills en sida är kortare än sidstorleken', async () => {
    const all = Array.from({ length: 5 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    }, 2);
    expect(rows).toEqual(all);
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('kastar vid fel', async () => {
    await expect(fetchAll(async () => ({ data: null, error: { message: 'x' } }))).rejects.toThrow('x');
  });
});
