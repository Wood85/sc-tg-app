import { formatMoney, isWeekend, rangeLabel, today, weekRange } from '@sc/shared';
import { useState } from 'react';
import {
  errorMessage,
  useGetEarningsQuery,
  useGetMyPayrollQuery,
  useGetReportsQuery,
  useSendPayrollMutation,
} from '../../api/baseApi.ts';
import { confirmAction, haptic } from '../../telegram.ts';
import styles from '../../ui/ui.module.css';

// Отправка недельного отчёта админу на выплату (зарплата выдаётся раз в неделю).
export function PayrollBlock() {
  const todayIso = today();
  const weeks = [
    { key: 'previous', title: 'Прошлая неделя', range: weekRange(todayIso, 1) },
    { key: 'current', title: 'Эта неделя', range: weekRange(todayIso) },
  ];
  // В выходные обычно закрывают текущую неделю, в будни — прошлую.
  const [weekKey, setWeekKey] = useState(isWeekend(todayIso) ? 'current' : 'previous');
  const week = weeks.find((w) => w.key === weekKey)!;

  const earnings = useGetEarningsQuery(week.range);
  const statements = useGetMyPayrollQuery();
  const reports = useGetReportsQuery();
  const [sendPayroll, { isLoading: sending }] = useSendPayrollMutation();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const total = earnings.data?.total ?? 0;
  const sent = statements.data?.find((s) => s.weekStart === week.range.from);
  const hasDrafts = (reports.data ?? []).some(
    (r) => r.status === 'draft' && r.workDate >= week.range.from && r.workDate <= week.range.to,
  );
  // Отправленный отчёт устарел, если с тех пор за неделю добавились отчёты.
  const changedSinceSent = sent !== undefined && sent.total !== total;

  async function send() {
    const label = rangeLabel(week.range);
    if (!(await confirmAction(`Отправить на выплату неделю ${label}? Сумма ${formatMoney(total)}.`))) return;
    try {
      const { notifiedAdmins } = await sendPayroll(week.range.from).unwrap();
      haptic('success');
      setMessage({
        text:
          notifiedAdmins > 0
            ? 'Отправлено администратору'
            : 'Сохранено, но бот не смог написать администратору — он увидит отчёт в приложении',
      });
    } catch (err) {
      haptic('error');
      setMessage({ text: errorMessage(err), error: true });
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Выплата</h2>
      <div className={styles.chips}>
        {weeks.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`${styles.chip} ${w.key === weekKey ? styles.chipActive : ''}`}
            onClick={() => {
              setWeekKey(w.key);
              setMessage(undefined);
            }}
          >
            {w.title}
          </button>
        ))}
      </div>
      <div className={styles.listRow}>
        <span className={styles.itemName}>
          {rangeLabel(week.range)}
          <span className={styles.hint}>
            {sent
              ? `Отправлено ${new Date(sent.sentAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · ${formatMoney(sent.total)}`
              : 'Ещё не отправлено'}
          </span>
        </span>
        <span className={styles.amount}>{formatMoney(total)}</span>
      </div>
      {hasDrafts && <p className={styles.error}>В этой неделе есть неотправленный черновик — он не попадёт в выплату.</p>}
      {changedSinceSent && <p className={styles.hint}>После отправки сумма изменилась — отправьте заново.</p>}
      <button
        type="button"
        className={styles.submit}
        disabled={sending || total === 0}
        onClick={() => void send()}
      >
        {total === 0 ? 'Нет отчётов за неделю' : sent ? 'Отправить заново' : 'Отправить на выплату'}
      </button>
      {message && <p className={message.error ? styles.error : styles.hint}>{message.text}</p>}
    </section>
  );
}
