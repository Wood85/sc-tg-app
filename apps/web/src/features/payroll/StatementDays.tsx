import { formatMoney, type PayrollDay, weekdayLabel } from '@sc/shared';
import styles from '../../ui/ui.module.css';

// Разбивка недельного отчёта на выплату по дням — как в сообщении админу.
export function StatementDays({ days }: { days: PayrollDay[] }) {
  return (
    <div className={styles.statementDays}>
      {days.map((day) => (
        <div key={day.date} className={styles.statementDay}>
          <div className={styles.listRow}>
            <b>{weekdayLabel(day.date)}</b>
            <span className={styles.amount}>{formatMoney(day.total)}</span>
          </div>
          {day.reports.map((report) => (
            <div key={report.reportId} className={styles.statementReport}>
              <div className={styles.listRow}>
                <span>{[report.address || 'Без адреса', report.location].filter(Boolean).join(' · ')}</span>
                <span className={styles.hint}>{formatMoney(report.amount)}</span>
              </div>
              {report.works.map((work, i) => (
                <div key={i} className={styles.hint}>
                  • {work.name} — {work.qty.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} {work.unit}
                </div>
              ))}
            </div>
          ))}
          {day.wage > 0 && <div className={styles.hint}>Оклад: {formatMoney(day.wage)}</div>}
        </div>
      ))}
    </div>
  );
}
