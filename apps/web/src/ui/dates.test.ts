import { describe, expect, it } from 'vitest';
import { addDays, addMonths, dateLabel, monthGrid, monthRange, monthTitle } from './dates.ts';

describe('monthGrid', () => {
  it('starts weeks on Monday and pads to full weeks', () => {
    // 1 октября 2026 — четверг: перед ним три пустые клетки (пн, вт, ср).
    const october = monthGrid({ year: 2026, month: 9 });
    expect(october.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(october.length % 7).toBe(0);
    expect(october.filter(Boolean)).toHaveLength(31);
    // 25 октября 2026 — воскресенье, последний столбец.
    expect(october.indexOf('2026-10-25') % 7).toBe(6);
  });

  it('handles months starting on Monday and Sunday, and leap years', () => {
    expect(monthGrid({ year: 2026, month: 5 })[0]).toBe('2026-06-01'); // понедельник
    expect(monthGrid({ year: 2026, month: 1 }).indexOf('2026-02-01')).toBe(6); // воскресенье
    expect(monthGrid({ year: 2024, month: 1 }).filter(Boolean).at(-1)).toBe('2024-02-29');
  });
});

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('gives the first and last day of a month', () => {
    expect(monthRange({ year: 2026, month: 9 })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange({ year: 2024, month: 1 })).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
});

describe('labels', () => {
  const today = '2026-10-25';

  it('names today and yesterday, otherwise shows the weekday', () => {
    expect(dateLabel('2026-10-25', today)).toBe('Сегодня, 25 октября');
    expect(dateLabel('2026-10-24', today)).toBe('Вчера, 24 октября');
    expect(dateLabel('2026-10-23', today)).toBe('Пт, 23 октября');
    expect(dateLabel('2025-12-31', today)).toBe('Ср, 31 декабря 2025');
  });

  it('titles months in the nominative case', () => {
    expect(monthTitle({ year: 2026, month: 9 })).toBe('Октябрь 2026');
  });
});
