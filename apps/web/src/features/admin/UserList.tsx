import { Link } from 'react-router';
import { errorMessage, useGetAdminUsersQuery } from '../../api/baseApi.ts';
import styles from '../../ui/ui.module.css';

export function UserList() {
  const { data, isLoading, error } = useGetAdminUsersQuery();

  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (error) return <p className={styles.error}>{errorMessage(error)}</p>;

  return (
    <div className={styles.form}>
      <Link to="/admin/users/new" className={styles.secondaryButton}>
        + Добавить человека
      </Link>
      <section className={styles.section}>
        <div>
          {data?.map((user) => (
            <Link
              key={user.id}
              to={`/admin/users/${user.id}`}
              className={`${styles.listRow} ${user.isActive ? '' : styles.muted}`}
            >
              <span className={styles.itemName}>
                {user.name}
                <span className={styles.hint}>ID {user.telegramId}</span>
              </span>
              {!user.isActive ? (
                <span className={styles.tag}>отключён</span>
              ) : (
                user.role === 'admin' && <span className={styles.tag}>админ</span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
