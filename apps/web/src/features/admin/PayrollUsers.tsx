import { formatMoney, rangeLabel } from '@sc/shared';
import { Link } from 'react-router';
import { errorMessage, useGetPayrollUsersQuery } from '../../api/baseApi.ts';
import styles from '../../ui/ui.module.css';

export function PayrollUsers() {
  const { data, isLoading, error } = useGetPayrollUsersQuery();
  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (error || !data) return <p className={styles.error}>{errorMessage(error)}</p>;

  return (
    <section className={styles.section}>
      <div>
        {data.map(({ user, last }) => (
          <Link key={user.id} to={`/admin/payroll/${user.id}`} className={styles.listRow}>
            <span className={styles.itemName}>
              {user.name}
              <span className={styles.hint}>
                {last
                  ? `${rangeLabel({ from: last.weekStart, to: last.weekEnd })} · отправлен ${new Date(last.sentAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
                  : 'Ещё не отправлял'}
              </span>
            </span>
            {last && <span className={styles.amount}>{formatMoney(last.total)}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
