import { LogoutButton } from './LogoutButton';

/** Visas för ett inloggat konto som saknar profil (inte inbjudet till laget). */
export function NotMember() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-bold">Ditt konto är inte kopplat till laget</h1>
      <p className="text-zinc-400">
        Du behöver en inbjudningslänk från tränaren. Logga ut och använd länken, eller logga in med ett annat konto.
      </p>
      <LogoutButton className="h-12 rounded-xl bg-zinc-100 px-4 font-bold text-zinc-950" />
    </main>
  );
}
