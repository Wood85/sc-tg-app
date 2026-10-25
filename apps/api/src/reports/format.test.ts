import { describe, expect, it } from 'vitest';
import { formatGroupMessage, splitMessage } from './format.ts';

describe('formatGroupMessage', () => {
  it('groups works and materials by category without amounts', () => {
    const text = formatGroupMessage({
      address: 'Багратиони 196И',
      location: '10 этаж',
      workDate: '2026-10-24',
      participants: ['Иван Петров', 'Сергей Ким'],
      works: [
        { category: 'ventilation', name: 'Отверстие под приточку ⌀100', unit: 'шт', qty: 2 },
        { category: 'conditioning', name: 'Монтаж блоков', unit: 'шт', qty: 2 },
        { category: 'ventilation', name: 'Прокладка воздуховода 110×60', unit: 'м', qty: 10, addonName: 'Оклейка в изоляцию', addonQty: 6 },
      ],
      materials: [{ category: 'ventilation', name: 'Труба ⌀110', unit: 'м', qty: 0.3 }],
      comment: 'Приточка без монтажа',
      atHeight: true,
    });

    expect(text).toBe(
      [
        '📍 <b>Багратиони 196И</b> · 10 этаж',
        '📅 24.10.2026 · 👷 Иван Петров, Сергей Ким',
        '🪜 Работы на высоте выше 4,5 м',
        '',
        '🔧 <b>Работы</b>',
        '❄️ Кондиционирование',
        '• Монтаж блоков — 2 шт',
        '🌀 Вентиляция',
        '• Отверстие под приточку ⌀100 — 2 шт',
        '• Прокладка воздуховода 110×60 — 10 м (оклейка в изоляцию — 6 м)',
        '',
        '📦 <b>Материалы</b>',
        '🌀 Вентиляция',
        '• Труба ⌀110 — 0,3 м',
        '',
        '💬 Приточка без монтажа',
      ].join('\n'),
    );
  });

  it('escapes user input and skips empty sections', () => {
    const text = formatGroupMessage({
      address: 'Дом <5>',
      location: '',
      workDate: '2026-01-02',
      participants: ['A&B'],
      works: [],
      materials: [],
      comment: '',
      atHeight: false,
    });
    expect(text).toBe('📍 <b>Дом &lt;5&gt;</b>\n📅 02.01.2026 · 👷 A&amp;B');
  });
});

describe('splitMessage', () => {
  it('keeps short text in one chunk', () => {
    expect(splitMessage('a\nb', 10)).toEqual(['a\nb']);
  });

  it('splits on line boundaries within the limit', () => {
    expect(splitMessage('aaaa\nbbbb\ncccc', 9)).toEqual(['aaaa\nbbbb', 'cccc']);
  });
});
