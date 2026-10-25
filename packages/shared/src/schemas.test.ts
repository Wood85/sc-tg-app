import { describe, expect, it } from 'vitest';
import { priceItemInputSchema } from './schemas.ts';

describe('priceItemInputSchema', () => {
  const base = { category: 'conditioning', name: 'Закладка трассы', unit: 'м', price: 0 } as const;

  it('takes the price of the first tier for tiered items', () => {
    const item = priceItemInputSchema.parse({
      ...base,
      tiers: [
        { upTo: 6, price: 800 },
        { upTo: null, price: 700 },
      ],
    });
    expect(item.price).toBe(800);
  });

  it('rejects tiers without an open last tier or with unsorted bounds', () => {
    const bad = [
      [{ upTo: 6, price: 800 }, { upTo: 10, price: 700 }],
      [{ upTo: 10, price: 800 }, { upTo: 6, price: 700 }, { upTo: null, price: 600 }],
      [{ upTo: null, price: 800 }, { upTo: null, price: 700 }],
    ];
    for (const tiers of bad) expect(priceItemInputSchema.safeParse({ ...base, tiers }).success).toBe(false);
  });
});
