import { timingSafeEqual } from 'node:crypto';

/** Kontrollerar `Authorization: Bearer <secret>` med konstant tid. Tom hemlighet nekas alltid. */
export function isAuthorizedCron(req: Request, secret: string): boolean {
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
