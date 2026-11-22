'use client';

import { useEffect } from 'react';

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-xl font-black">Något gick fel</h1>
      <p className="text-zinc-400">Sidan kunde inte visas just nu. Försök igen om en liten stund.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="h-12 rounded-xl bg-club px-6 font-bold text-white"
      >
        Försök igen
      </button>
    </main>
  );
}
