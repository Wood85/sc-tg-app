import { useGetMeQuery } from './api/baseApi.ts';

export function App() {
  const { data: me, error, isLoading } = useGetMeQuery();

  if (isLoading) return <p>Загрузка…</p>;
  if (error) {
    const status = 'status' in error ? error.status : undefined;
    if (status === 403) return <p>Вы не зарегистрированы. Напишите боту /start и передайте ID администратору.</p>;
    return <p>Ошибка авторизации ({String(status)})</p>;
  }
  return (
    <main>
      <h1>Привет, {me?.name}!</h1>
      <p>Роль: {me?.role}</p>
    </main>
  );
}
