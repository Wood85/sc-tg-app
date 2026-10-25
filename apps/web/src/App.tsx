import type { MeDto } from '@sc/shared';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { errorStatus, useGetMeQuery } from './api/baseApi.ts';
import { AdminLayout } from './features/admin/AdminLayout.tsx';
import { CatalogItemEdit } from './features/admin/CatalogItemEdit.tsx';
import { CatalogList } from './features/admin/CatalogList.tsx';
import { UserEdit } from './features/admin/UserEdit.tsx';
import { UserList } from './features/admin/UserList.tsx';
import { WageRatesEdit } from './features/admin/WageRatesEdit.tsx';
import { EarningsPage } from './features/earnings/EarningsPage.tsx';
import { ReportForm } from './features/reportForm/ReportForm.tsx';
import { ReportDetails } from './features/reports/ReportDetails.tsx';
import { ReportsList } from './features/reports/ReportsList.tsx';
import styles from './ui/ui.module.css';

export function App() {
  const { data: me, error, isLoading } = useGetMeQuery();

  if (isLoading) return <p>Загрузка…</p>;
  if (error || !me) {
    if (errorStatus(error) === 403) return <p>Вы не зарегистрированы. Напишите боту /start и передайте ID администратору.</p>;
    return <p>Ошибка авторизации ({String(errorStatus(error))})</p>;
  }

  return (
    <>
      <MainNav isAdmin={me.role === 'admin'} />
      <Routes>
        <Route path="/" element={<ReportForm me={me} />} />
        <Route path="/reports" element={<ReportsList />} />
        <Route path="/reports/:id" element={<ReportDetails me={me} />} />
        <Route path="/earnings" element={<EarningsPage />} />
        {me.role === 'admin' && <Route path="/admin/*" element={<AdminRoutes me={me} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

const tabClass = ({ isActive }: { isActive: boolean }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`;

// Короткие подписи — на экране телефона помещаются четыре вкладки.
function MainNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className={styles.tabs}>
      <NavLink to="/" end className={tabClass}>
        Новый
      </NavLink>
      <NavLink to="/reports" className={tabClass}>
        Отчёты
      </NavLink>
      <NavLink to="/earnings" className={tabClass}>
        Заработок
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={tabClass}>
          Админ
        </NavLink>
      )}
    </nav>
  );
}

function AdminRoutes({ me }: { me: MeDto }) {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="works" replace />} />
        <Route path="works" element={<CatalogList kind="works" />} />
        <Route path="materials" element={<CatalogList kind="materials" />} />
        <Route path="users" element={<UserList />} />
        <Route path="wages" element={<WageRatesEdit />} />
      </Route>
      <Route path="works/:id" element={<CatalogItemEdit kind="works" />} />
      <Route path="materials/:id" element={<CatalogItemEdit kind="materials" />} />
      <Route path="users/:id" element={<UserEdit me={me} />} />
    </Routes>
  );
}
