import {
  addMonths,
  compareMonths,
  dateLabel,
  formatMoney,
  monthOf,
  monthRange,
  monthTitle,
  rangeLabel,
  today,
  weekRange,
} from '@sc/shared';
import { useState } from 'react';
import { errorMessage, useGetEarningsQuery } from '../../api/baseApi.ts';
import { Chevron } from '../../ui/Chevron.tsx';
import styles from '../../ui/ui.module.css';

// Заработок по дням за месяц: доли по отправленным отчётам + дневной оклад.
export function EarningsPage() {
  const currentMonth = monthOf(today());
  const [month, setMonth] = useState(currentMonth);
  const { data, isFetching, error } = useGetEarningsQuery(monthRange(month));
  const days = [...(data?.days ?? [])].reverse();
  const wageTotal = days.reduce((sum, d) => sum + d.wage, 0);

  return (
    <div className={styles.form}>
      <WeekTotals />

      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.calendarNav}
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Предыдущий месяц"
        >
          <Chevron direction="left" />
        </button>
        <span>{monthTitle(month)}</span>
        <button
          type="button"
          className={styles.calendarNav}
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={compareMonths(month, currentMonth) >= 0}
          aria-label="Следующий месяц"
        >
          <Chevron direction="right" />
        </button>
      </div>

      {error ? (
        <p className={styles.error}>{errorMessage(error)}</p>
      ) : (
        <>
          <section className={`${styles.section} ${isFetching ? styles.muted : ''}`}>
            <span className={styles.hint}>Итого за месяц</span>
            <span className={styles.bigAmount}>{formatMoney(data?.total ?? 0)}</span>
            <span className={styles.hint}>
              Рабочих дней: {days.length} · из них оклад {formatMoney(wageTotal)}
            </span>
          </section>

          {days.length > 0 ? (
            <section className={styles.section}>
              <div>
                {days.map((day) => (
                  <div key={day.date} className={styles.listRow}>
                    <span className={styles.itemName}>
                      {dateLabel(day.date)}
                      <span className={styles.hint}>
                        по отчётам {formatMoney(day.amount - day.wage)} · оклад {formatMoney(day.wage)}
                      </span>
                    </span>
                    <span className={styles.amount}>{formatMoney(day.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            !isFetching && <p className={styles.hint}>В этом месяце отправленных отчётов нет.</p>
          )}
        </>
      )}
    </div>
  );
}

// Итоги за текущую и прошлую неделю (пн–вс) — не зависят от выбранного месяца.
function WeekTotals() {
  const todayIso = today();
  const current = weekRange(todayIso);
  const previous = weekRange(todayIso, 1);
  const { data } = useGetEarningsQuery({ from: previous.from, to: current.to });

  const sum = ({ from, to }: { from: string; to: string }) =>
    (data?.days ?? []).filter((d) => d.date >= from && d.date <= to).reduce((total, d) => total + d.amount, 0);

  return (
    <div className={styles.weekTotals}>
      {[
        { title: 'Эта неделя', range: current },
        { title: 'Прошлая неделя', range: previous },
      ].map(({ title, range }) => (
        <section key={title} className={styles.section}>
          <span className={styles.hint}>{title}</span>
          <span className={styles.weekAmount}>{data ? formatMoney(sum(range)) : '…'}</span>
          <span className={styles.hint}>{rangeLabel(range)}</span>
        </section>
      ))}
    </div>
  );
}
