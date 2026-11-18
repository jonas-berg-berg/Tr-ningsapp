import { describe, expect, it } from 'vitest';
import { passwordResetError, validateNewPassword } from './password-reset';

const COACH = '00000000-0000-0000-0000-0000000000cc';
const PLAYER = '00000000-0000-0000-0000-00000000000a';

describe('validateNewPassword', () => {
  it('minst 8 tecken', () => {
    expect(validateNewPassword('1234567')).toBe('Lösenordet måste vara minst 8 tecken.');
    expect(validateNewPassword('12345678')).toBeNull();
  });
  it('högst 72 tecken (gräns i Supabase Auth)', () => {
    expect(validateNewPassword('x'.repeat(72))).toBeNull();
    expect(validateNewPassword('x'.repeat(73))).toBe('Lösenordet får vara högst 72 tecken.');
  });
});

describe('passwordResetError', () => {
  const ok = { coachId: COACH, targetId: PLAYER, targetRole: 'player' as const, password: 'nyttlosen' };
  it('godkänner en spelare med giltigt lösenord', () => {
    expect(passwordResetError(ok)).toBeNull();
  });
  it('ogiltigt id', () => {
    expect(passwordResetError({ ...ok, targetId: 'x' })).toBe('Något gick fel. Försök igen.');
  });
  it('inte sig själv', () => {
    expect(passwordResetError({ ...ok, targetId: COACH })).toBe('Du kan inte byta ditt eget lösenord här.');
  });
  it('spelaren måste finnas och vara spelare', () => {
    expect(passwordResetError({ ...ok, targetRole: null })).toBe('Spelaren finns inte.');
    expect(passwordResetError({ ...ok, targetRole: 'coach' })).toBe('Bara spelares lösenord kan bytas här.');
  });
  it('lösenordet valideras', () => {
    expect(passwordResetError({ ...ok, password: 'kort' })).toBe('Lösenordet måste vara minst 8 tecken.');
  });
});
