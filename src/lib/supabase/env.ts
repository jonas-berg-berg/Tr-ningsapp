/**
 * Läser en obligatorisk miljövariabel. Värdet skickas in redan uppslaget
 * (`process.env.NEXT_PUBLIC_X`) eftersom Next bara bäddar in NEXT_PUBLIC_-värden
 * i klientkoden vid statisk åtkomst.
 */
export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Miljövariabeln ${name} saknas. Lägg till den i .env.local (se .env.example).`);
  }
  return value;
}
