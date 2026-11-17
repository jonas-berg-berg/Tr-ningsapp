import Link from 'next/link';

const LINKS = [
  { href: '/tranare', label: 'Översikt' },
  { href: '/tranare/spelare', label: 'Spelare' },
  { href: '/tranare/uppdrag', label: 'Uppdrag' },
  { href: '/tranare/lagmal', label: 'Lagmål' },
  { href: '/tranare/kalender', label: 'Kalender' },
  { href: '/tranare/installningar', label: 'Inställningar' },
] as const;

// Varje sida kontrollerar själv att användaren är tränare (layouts renderas inte om vid navigering).
export default function CoachLayout({ children }: LayoutProps<'/tranare'>) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Tränarvy</p>
          <Link href="/" className="text-sm text-zinc-400 underline">
            Till spelarvyn
          </Link>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Tränarmeny">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
