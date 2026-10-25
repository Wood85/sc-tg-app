// Деньги везде храним целым числом тетри (1 ₾ = 100 тетри), чтобы не ловить ошибки float.

// Количество в отчёте — до двух знаков после запятой (0,3 м трубы). Переводим в сотые,
// чтобы умножение на цену шло в целых числах.
export function lineAmount(qty: number, unitPrice: number): number {
  const hundredths = Math.round(qty * 100);
  return Math.round((hundredths * unitPrice) / 100);
}

// Делим сумму поровну между участниками. Остаток в тетри достаётся первому (автору отчёта),
// так что сумма долей всегда равна total.
export function splitEqually(total: number, count: number): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error(`Invalid total: ${total}`);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid count: ${count}`);
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

export function formatMoney(tetri: number): string {
  return `${(tetri / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾`;
}
