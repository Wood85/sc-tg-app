import { type Category, categories, categoryLabels } from '@sc/shared';

export interface GroupMessageInput {
  address: string;
  location: string;
  workDate: string;
  participants: string[];
  works: { category: Category; name: string; unit: string; qty: number }[];
  materials: { category: Category; name: string; unit: string; qty: number }[];
  comment: string;
  atHeight: boolean;
}


// Лимит текста одного сообщения в Telegram.
export const TELEGRAM_TEXT_LIMIT = 4096;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

export function formatQty(qty: number): string {
  return qty.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function formatLines(lines: GroupMessageInput['works']): string[] {
  const result: string[] = [];
  for (const category of categories) {
    const items = lines.filter((l) => l.category === category);
    if (items.length === 0) continue;
    result.push(categoryLabels[category]);
    for (const item of items) {
      result.push(`• ${escapeHtml(item.name)} — ${formatQty(item.qty)} ${escapeHtml(item.unit)}`);
    }
  }
  return result;
}

// Сообщение в рабочую группу (parse_mode: HTML), без иконок. Сверху — кто работал.
// Суммы сюда намеренно не попадают.
export function formatGroupMessage(r: GroupMessageInput): string {
  const lines = [
    `<b>${r.participants.map(escapeHtml).join(', ')}</b>`,
    [r.address, r.location].filter(Boolean).map(escapeHtml).join(' · '),
    formatDate(r.workDate),
  ];
  if (r.atHeight) lines.push('Работы на высоте выше 4,5 м');
  if (r.works.length > 0) lines.push('', '<b>Работы</b>', ...formatLines(r.works));
  if (r.materials.length > 0) lines.push('', '<b>Материалы</b>', ...formatLines(r.materials));
  if (r.comment) lines.push('', `Комментарий: ${escapeHtml(r.comment)}`);
  return lines.join('\n');
}

// Режет длинный текст по строкам, чтобы не разорвать HTML-теги внутри строки.
export function splitMessage(text: string, limit = TELEGRAM_TEXT_LIMIT): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    // Одна строка длиннее лимита возможна только из-за огромного комментария.
    current = line.length > limit ? line.slice(0, limit) : line;
  }
  if (current) chunks.push(current);
  return chunks;
}
