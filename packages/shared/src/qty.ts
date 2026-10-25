// Разбирает количество, введённое монтажником: «2», «0,3», «1.25».
// Возвращает undefined для пустого или некорректного ввода (ноль, минус, больше двух знаков).
export function parseQtyInput(input: string): number | undefined {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return value > 0 ? value : undefined;
}
