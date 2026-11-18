'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="h-10 shrink-0 rounded-lg bg-zinc-800 px-3 text-sm font-semibold">
      {copied === true ? 'Kopierad!' : copied === false ? 'Markera och kopiera' : 'Kopiera'}
    </button>
  );
}

/** Länk som går att markera, med Kopiera-knapp bredvid. */
export function CopyLink({ link }: { link: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Inbjudningslänk"
        className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
      />
      <CopyButton text={link} />
    </div>
  );
}
