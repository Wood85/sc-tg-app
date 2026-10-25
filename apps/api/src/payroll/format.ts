import { formatMoney, type PayrollStatementDto, rangeLabel, weekdayLabel } from '@sc/shared';
import { escapeHtml, formatQty } from '../reports/format.ts';

// Сообщение админу о недельном отчёте на выплату (parse_mode: HTML), без фото.
export function formatPayrollMessage(statement: PayrollStatementDto, { updated }: { updated: boolean }): string {
  const lines = [
    `💰 <b>На выплату: ${escapeHtml(statement.user.name)}</b>${updated ? ' (обновлён)' : ''}`,
    `Неделя ${rangeLabel({ from: statement.weekStart, to: statement.weekEnd })}`,
  ];
  for (const day of statement.days) {
    lines.push('', `📅 <b>${weekdayLabel(day.date)} — ${formatMoney(day.total)}</b>`);
    for (const report of day.reports) {
      const place = [report.address || 'Без адреса', report.location].filter(Boolean).map(escapeHtml).join(' · ');
      lines.push(`📍 ${place} — ${formatMoney(report.amount)}`);
      for (const work of report.works) {
        lines.push(`  • ${escapeHtml(work.name)} — ${formatQty(work.qty)} ${escapeHtml(work.unit)}`);
      }
    }
    if (day.wage > 0) lines.push(`Оклад: ${formatMoney(day.wage)}`);
  }
  lines.push('', `<b>Итого за неделю: ${formatMoney(statement.total)}</b>`);
  return lines.join('\n');
}
