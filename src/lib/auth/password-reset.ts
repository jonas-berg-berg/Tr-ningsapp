import { UUID_RE } from '../actions/form-state';

const GENERIC = 'Något gick fel. Försök igen.';

/** Felmeddelande för ett nytt lösenord, eller null om det duger. */
export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Lösenordet måste vara minst 8 tecken.';
  // Supabase Auth (bcrypt) tar högst 72 tecken.
  if (password.length > 72) return 'Lösenordet får vara högst 72 tecken.';
  return null;
}

/**
 * Får tränaren sätta ett nytt lösenord för kontot? `targetRole` läses med
 * tränarens egen klient (RLS), null om profilen inte finns. Returnerar ett
 * svenskt felmeddelande eller null.
 */
export function passwordResetError(input: {
  coachId: string;
  targetId: string;
  targetRole: 'player' | 'coach' | null;
  password: string;
}): string | null {
  if (!UUID_RE.test(input.targetId)) return GENERIC;
  if (input.targetId === input.coachId) return 'Du kan inte byta ditt eget lösenord här.';
  if (input.targetRole === null) return 'Spelaren finns inte.';
  if (input.targetRole !== 'player') return 'Bara spelares lösenord kan bytas här.';
  return validateNewPassword(input.password);
}
