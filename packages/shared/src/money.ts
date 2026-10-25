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

// Разбирает цену в лари, введённую админом («25», «25,5», «1 250,00»), в тетри.
export function parseMoneyInput(input: string): number | undefined {
  const normalized = input.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Math.round(Number(normalized) * 100);
}

// Цена для поля ввода: 2550 → «25,50», 2500 → «25».
export function formatMoneyInput(tetri: number): string {
  return tetri % 100 === 0 ? String(tetri / 100) : (tetri / 100).toFixed(2).replace('.', ',');
}
