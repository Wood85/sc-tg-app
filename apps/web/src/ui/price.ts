import { formatMoney, type PriceTier, tierPrice } from '@sc/shared';

function formatBound(upTo: number): string {
  return upTo.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

// Подсказка к цене позиции прайса. Для ступенчатой цены с введённым количеством
// показывает ступень, которая сработает.
export function priceHint(item: { price: number; unit: string; tiers: PriceTier[] | null }, qty?: number): string {
  if (!item.tiers) return `${formatMoney(item.price)} / ${item.unit}`;
  if (qty !== undefined) {
    const price = tierPrice(item.tiers, qty);
    return `${formatMoney(price)} / ${item.unit} — цена при ${formatBound(qty)} ${item.unit}`;
  }
  const prices = item.tiers.map((t) => t.price);
  return `${formatMoney(Math.min(...prices))}–${formatMoney(Math.max(...prices))} / ${item.unit}, зависит от объёма`;
}

export function tierLabel(tiers: PriceTier[], index: number, unit: string): string {
  const tier = tiers[index]!;
  const prev = index > 0 ? tiers[index - 1]!.upTo : null;
  if (tier.upTo === null) return prev === null ? 'любой объём' : `больше ${formatBound(prev)} ${unit}`;
  return `до ${formatBound(tier.upTo)} ${unit}`;
}
