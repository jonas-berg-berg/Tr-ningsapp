import { describe, expect, it } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
  it('returnerar värdet när det finns', () => {
    expect(requireEnv('x', 'NAME')).toBe('x');
  });

  it('kastar ett tydligt fel som nämner variabeln när den saknas', () => {
    expect(() => requireEnv(undefined, 'SUPABASE_SERVICE_ROLE_KEY')).toThrow(/SUPABASE_SERVICE_ROLE_KEY saknas/);
    expect(() => requireEnv('', 'X')).toThrow(/X saknas/);
  });
});
