import { NavLink, Outlet } from 'react-router';
import styles from '../../ui/ui.module.css';

const tabClass = ({ isActive }: { isActive: boolean }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`;

export function AdminLayout() {
  return (
    <>
      <nav className={styles.tabs}>
        <NavLink to="/admin/works" className={tabClass}>
          Работы
        </NavLink>
        <NavLink to="/admin/materials" className={tabClass}>
          Материалы
        </NavLink>
        <NavLink to="/admin/users" className={tabClass}>
          Люди
        </NavLink>
        <NavLink to="/admin/wages" className={tabClass}>
          Оклад
        </NavLink>
      </nav>
      <Outlet />
    </>
  );
}
