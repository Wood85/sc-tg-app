// Даты в форме — строки YYYY-MM-DD в местном времени монтажника.

export interface YearMonth {
  year: number;
  // 0–11, как в Date.
  month: number;
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function today(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function monthOf(iso: string): YearMonth {
  const date = fromIsoDate(iso);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month;
}

// Первый и последний день месяца — для запросов «за месяц».
export function monthRange({ year, month }: YearMonth): { from: string; to: string } {
  return { from: toIsoDate(new Date(year, month, 1)), to: toIsoDate(new Date(year, month + 1, 0)) };
}

// Неделя с понедельника по воскресенье; weeksAgo = 0 — текущая, 1 — прошлая.
export function weekRange(iso: string, weeksAgo = 0): { from: string; to: string } {
  const offset = (fromIsoDate(iso).getDay() + 6) % 7;
  const from = addDays(iso, -offset - 7 * weeksAgo);
  return { from, to: addDays(from, 6) };
}

// «19–25 октября», через границу месяцев — «28 сентября – 4 октября».
export function rangeLabel({ from, to }: { from: string; to: string }): string {
  const format = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(fromIsoDate(iso));
  if (compareMonths(monthOf(from), monthOf(to)) === 0) return `${fromIsoDate(from).getDate()}–${format(to)}`;
  return `${format(from)} – ${format(to)}`;
}

// Сетка месяца по неделям с понедельника: ISO-даты дней, null — пустые клетки до 1-го и после последнего числа.
export function monthGrid({ year, month }: YearMonth): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIsoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthTitle({ year, month }: YearMonth): string {
  return `${capitalize(new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(year, month, 1)))} ${year}`;
}

function dayMonth(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

// «Пт, 23 октября» — без «Сегодня» и «Вчера», для текстов, которые читают позже (сообщения в Telegram).
export function weekdayLabel(iso: string): string {
  const date = fromIsoDate(iso);
  return `${capitalize(new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date))}, ${dayMonth(date)}`;
}

// «Сегодня, 25 октября», «Вчера, 24 октября», «Пт, 23 октября», для другого года — с годом.
export function dateLabel(iso: string, todayIso = today()): string {
  const date = fromIsoDate(iso);
  if (iso === todayIso) return `Сегодня, ${dayMonth(date)}`;
  if (iso === addDays(todayIso, -1)) return `Вчера, ${dayMonth(date)}`;
  const year = date.getFullYear() === fromIsoDate(todayIso).getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${weekdayLabel(iso)}${year}`;
}

export const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
