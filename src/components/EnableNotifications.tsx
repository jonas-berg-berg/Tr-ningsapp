'use client';

import { useEffect, useState } from 'react';

type State = 'unsupported' | 'loading' | 'off' | 'on' | 'blocked' | 'busy' | 'error';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function EnableNotifications() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') return setState('blocked');
      if (permission !== 'granted') return setState('off');
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return setState('error');
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      // Icke-ok (t.ex. 401 när sessionen gått ut) är ett misslyckande, inte "på".
      setState(res.ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  }

  async function disable() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const res = await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        // Avsluta lokalt ändå: då slutar notiserna komma till enheten, och servern
        // rensar raden när push-tjänsten svarar 410. Men visa att något gick fel.
        await sub.unsubscribe();
        if (!res.ok) return setState('error');
      }
      setState('off');
    } catch {
      setState('error');
    }
  }

  if (state === 'unsupported' || state === 'loading') return null;

  const row = 'flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-4 py-3';
  const btn = 'h-10 shrink-0 rounded-lg px-4 text-sm font-bold disabled:opacity-50';

  if (state === 'blocked') {
    return (
      <div className={row}>
        <p className="text-sm text-zinc-400">Notiser är blockerade. Slå på dem i telefonens eller webbläsarens inställningar.</p>
      </div>
    );
  }

  return (
    <div className={row}>
      <div>
        <p className="text-sm font-semibold">Påminnelser: {state === 'on' ? 'på' : 'av'}</p>
        {state === 'error' && <p className="text-xs text-red-300">Det gick inte. Försök igen.</p>}
      </div>
      {state === 'on' ? (
        <button type="button" onClick={disable} className={`${btn} bg-zinc-800`}>
          Stäng av
        </button>
      ) : (
        <button type="button" onClick={enable} disabled={state === 'busy'} className={`${btn} bg-zinc-100 text-zinc-950`}>
          Slå på notiser
        </button>
      )}
    </div>
  );
}
