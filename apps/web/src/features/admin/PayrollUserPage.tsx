import { formatMoney, PAYROLL_HISTORY_LIMITS, rangeLabel } from '@sc/shared';
import { useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage, useGetPayrollStatementsQuery, useGetPayrollUsersQuery } from '../../api/baseApi.ts';
import { BackLink } from '../../ui/BackLink.tsx';
import { Chevron } from '../../ui/Chevron.tsx';
import { Collapse } from '../../ui/Collapse.tsx';
import styles from '../../ui/ui.module.css';
import { StatementDays } from '../payroll/StatementDays.tsx';

const LIMIT_STORAGE_KEY = 'payrollHistoryLimit';

function savedLimit(): number {
  try {
    const value = Number(localStorage.getItem(LIMIT_STORAGE_KEY));
    return (PAYROLL_HISTORY_LIMITS as readonly number[]).includes(value) ? value : 5;
  } catch {
    return 5;
  }
}

// Последние N недельных отчётов монтажника; N выбирает админ (запоминается).
export function PayrollUserPage() {
  const userId = Number(useParams().id);
  const [limit, setLimit] = useState(savedLimit);
  const [openId, setOpenId] = useState<number | null>(null);
  const user = useGetPayrollUsersQuery().data?.find((p) => p.user.id === userId)?.user;
  const { data, isFetching, error } = useGetPayrollStatementsQuery({ userId, limit });

  function chooseLimit(value: number) {
    setLimit(value);
    try {
      localStorage.setItem(LIMIT_STORAGE_KEY, String(value));
    } catch {
      // Без хранилища выбор просто не запомнится.
    }
  }

  return (
    <div className={styles.form}>
      <BackLink to="/admin/payroll" />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{user?.name ?? 'Выплаты'}</h2>
        <div className={styles.chips}>
          <span className={styles.hint}>Показать недель:</span>
          {PAYROLL_HISTORY_LIMITS.map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${value === limit ? styles.chipActive : ''}`}
              onClick={() => chooseLimit(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      {error && <p className={styles.error}>{errorMessage(error)}</p>}
      {data?.length === 0 && <p className={styles.hint}>Недельных отчётов пока нет.</p>}
      <div className={isFetching ? styles.muted : ''}>
        {data?.map((statement) => {
          const open = openId === statement.id;
          return (
            <section key={statement.id} className={`${styles.section} ${styles.sectionCollapsible} ${styles.stacked}`}>
              <button
                type="button"
                className={styles.sectionToggle}
                onClick={() => setOpenId(open ? null : statement.id)}
                aria-expanded={open}
              >
                <span className={styles.itemName}>
                  <b>{rangeLabel({ from: statement.weekStart, to: statement.weekEnd })}</b>
                  <span className={styles.hint}>
                    отправлен{' '}
                    {new Date(statement.sentAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span className={styles.amount}>{formatMoney(statement.total)}</span>
                <span className={styles.toggleIcon}>
                  <Chevron direction={open ? 'up' : 'down'} />
                </span>
              </button>
              <Collapse open={open}>
                <StatementDays days={statement.days} />
              </Collapse>
            </section>
          );
        })}
      </div>
    </div>
  );
}
