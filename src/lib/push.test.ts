import { describe, expect, it } from 'vitest';
import { reminderMessage } from './reminder-message';

describe('reminderMessage', () => {
  it('daily med streak', () => {
    expect(reminderMessage('daily', 9)).toEqual({
      title: 'Din streak på 9 dagar väntar 🔥',
      body: 'Logga dagens träning innan midnatt.',
    });
  });
  it('daily utan streak och utan aktivt dagligt uppdrag', () => {
    expect(reminderMessage('daily', 0, false)).toEqual({
      title: 'Dags att träna 💪',
      body: 'Logga dagens träning innan midnatt.',
    });
  });
  it('daily med streak oberoende av dagligt uppdrag', () => {
    expect(reminderMessage('daily', 2, false).title).toBe('Din streak på 2 dagar väntar 🔥');
  });
  it('daily utan streak', () => {
    expect(reminderMessage('daily', 0, true)).toEqual({
      title: 'Dags att träna 💪',
      body: 'Gör dagens extrapass och starta en ny streak.',
    });
  });
  it('weekly', () => {
    expect(reminderMessage('weekly', 3)).toEqual({
      title: 'Helgens löprunda',
      body: 'Veckouppdraget är inte klart än – du har till midnatt.',
    });
  });
});
