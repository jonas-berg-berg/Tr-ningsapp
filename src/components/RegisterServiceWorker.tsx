'use client';

import { useEffect } from 'react';

/** Registrerar service workern (krävs för push och för att appen ska kunna installeras). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
