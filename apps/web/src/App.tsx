import { errorStatus, useGetMeQuery } from './api/baseApi.ts';
import { ReportForm } from './features/reportForm/ReportForm.tsx';

export function App() {
  const { data: me, error, isLoading } = useGetMeQuery();

  if (isLoading) return <p>Загрузка…</p>;
  if (error || !me) {
    if (errorStatus(error) === 403) return <p>Вы не зарегистрированы. Напишите боту /start и передайте ID администратору.</p>;
    return <p>Ошибка авторизации ({String(errorStatus(error))})</p>;
  }
  return <ReportForm me={me} />;
}
