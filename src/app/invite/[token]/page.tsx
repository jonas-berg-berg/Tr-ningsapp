import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { InviteForm } from './InviteForm';
import { findOpenInvite, INVALID_INVITE } from './invite';

export default function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-12">
      <Suspense fallback={<p className="text-zinc-400">Hämtar inbjudan…</p>}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}

async function InviteContent({ params }: Pick<PageProps<'/invite/[token]'>, 'params'>) {
  const { token } = await params;
  // Inbjudan läses per anrop (tidsgränsen räknas från "nu"), aldrig vid förrendering.
  await connection();
  const invite = await findOpenInvite(token);

  return (
    <>
      {invite ? (
        <>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Välkommen {invite.displayName}!</h1>
            <p className="mt-1 text-zinc-400">Välj användarnamn och lösenord till Träningsappen.</p>
          </div>
          <InviteForm token={token} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{INVALID_INVITE}</h1>
          <p className="text-zinc-400">Be tränaren om en ny länk, eller logga in om du redan har ett konto.</p>
          <Link href="/login" className="font-semibold text-white underline">
            Till inloggningen ›
          </Link>
        </div>
      )}
    </>
  );
}
