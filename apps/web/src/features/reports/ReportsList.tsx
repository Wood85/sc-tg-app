import { formatMoney, type ReportListItemDto, type ReportStatus } from '@sc/shared';
import { Link } from 'react-router';
import { errorMessage, useGetReportsQuery } from '../../api/baseApi.ts';
import { dateLabel, monthOf, monthTitle } from '../../ui/dates.ts';
import styles from '../../ui/ui.module.css';

export const statusLabels: Partial<Record<ReportStatus, string>> = {
  draft: 'черновик',
  sending: 'отправляется',
};

// Отчёты, где я автор или участник, по месяцам; новые сверху.
export function ReportsList() {
  const { data, isLoading, error } = useGetReportsQuery();

  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (error || !data) return <p className={styles.error}>{errorMessage(error)}</p>;
  if (data.length === 0) {
    return <p className={styles.hint}>Отчётов пока нет. Отправленные отчёты появятся здесь.</p>;
  }

  const months = new Map<string, ReportListItemDto[]>();
  for (const report of data) {
    const title = monthTitle(monthOf(report.workDate));
    months.set(title, [...(months.get(title) ?? []), report]);
  }

  return (
    <div className={styles.form}>
      {[...months].map(([title, reports]) => (
        <section key={title} className={styles.section}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <div>
            {reports.map((report) => (
              <Link key={report.id} to={`/reports/${report.id}`} className={styles.listRow}>
                <span className={styles.itemName}>
                  {report.address || 'Без адреса'}
                  <span className={styles.hint}>
                    {dateLabel(report.workDate)}
                    {report.location && ` · ${report.location}`}
                  </span>
                </span>
                {statusLabels[report.status] ? (
                  <span className={styles.tag}>{statusLabels[report.status]}</span>
                ) : (
                  <span className={styles.amount}>{formatMoney(report.myAmount)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
