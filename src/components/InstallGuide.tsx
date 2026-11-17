'use client';

import { useSyncExternalStore, useState } from 'react';

const KEY = 'installGuideDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function shouldShow(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return !standalone && !readDismissed();
}

const noopSubscribe = () => () => {};

/** Guidar iPhone-spelare till hemskärmen (notiser fungerar bara därifrån). */
export function InstallGuide() {
  const eligible = useSyncExternalStore(noopSubscribe, shouldShow, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Privat läge m.m.: dölj bara för den här visningen.
    }
    setDismissed(true);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4" aria-label="Lägg till på hemskärmen">
      <h2 className="text-base font-bold">Lägg appen på hemskärmen</h2>
      <p className="text-sm text-zinc-400">
        På iPhone fungerar påminnelser bara när appen öppnas från hemskärmen.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Tryck på Dela-knappen (fyrkanten med pilen) i Safari.</li>
        <li>Välj ”Lägg till på hemskärmen”.</li>
        <li>Öppna Träningsappen från hemskärmen och slå på notiser.</li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="h-10 self-start rounded-lg bg-zinc-800 px-4 text-sm font-semibold"
      >
        Okej, dölj
      </button>
    </section>
  );
}
