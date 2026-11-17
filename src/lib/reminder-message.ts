/** Notistexter för påminnelserna. Ren modul (ingen server-only) så att den kan testas. */
export function reminderMessage(kind: 'daily' | 'weekly', streak: number): { title: string; body: string } {
  if (kind === 'weekly') {
    return { title: 'Helgens löprunda', body: 'Veckouppdraget är inte klart än – du har till midnatt.' };
  }
  if (streak > 0) {
    return {
      title: `Din streak på ${streak} ${streak === 1 ? 'dag' : 'dagar'} väntar 🔥`,
      body: 'Logga dagens träning innan midnatt.',
    };
  }
  return { title: 'Dags att träna 💪', body: 'Gör dagens extrapass och starta en ny streak.' };
}
