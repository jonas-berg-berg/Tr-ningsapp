'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/actions/sign-out';

/**
 * Avslutar enhetens push-prenumeration (så att nästa användare på samma
 * telefon inte får den förras påminnelser). Bästa försök: fel ignoreras.
 */
async function unsubscribePush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);
    await sub.unsubscribe();
  } catch {
    // Ignorera: utloggningen ska alltid gå igenom.
  }
}

export function LogoutButton({ className = 'text-sm text-zinc-400 underline' }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={`${className} disabled:opacity-60`}
      onClick={() =>
        startTransition(async () => {
          await unsubscribePush();
          await signOut();
        })
      }
    >
      {pending ? 'Loggar ut…' : 'Logga ut'}
    </button>
  );
}
