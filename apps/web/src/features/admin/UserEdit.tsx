import type { MeDto, Role } from '@sc/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { errorMessage, useGetAdminUsersQuery, useSaveUserMutation } from '../../api/baseApi.ts';
import { haptic, isInsideTelegram, useMainButton } from '../../telegram.ts';
import styles from '../../ui/ui.module.css';
import { BackLink } from '../../ui/BackLink.tsx';

interface Values {
  telegramId: string;
  name: string;
  role: Role;
  isActive: boolean;
}

const roleLabels: Record<Role, string> = { installer: 'Монтажник', admin: 'Администратор' };

export function UserEdit({ me }: { me: MeDto }) {
  const { id: idParam } = useParams();
  const id = idParam === 'new' ? null : Number(idParam);
  const { data, isLoading } = useGetAdminUsersQuery();

  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  const existing = id === null ? undefined : data?.find((u) => u.id === id);
  if (id !== null && !existing) return <p className={styles.error}>Пользователь не найден</p>;

  const initial: Values = existing
    ? { telegramId: String(existing.telegramId), name: existing.name, role: existing.role, isActive: existing.isActive }
    : { telegramId: '', name: '', role: 'installer', isActive: true };

  return <UserForm key={idParam} id={id} isSelf={id === me.id} initial={initial} />;
}

function UserForm({ id, isSelf, initial }: { id: number | null; isSelf: boolean; initial: Values }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [saveUser, { isLoading: saving }] = useSaveUserMutation();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    const telegramId = Number(values.telegramId.trim());
    if (!Number.isInteger(telegramId) || telegramId <= 0) return fail('Telegram ID — целое число');
    if (!values.name.trim()) return fail('Укажите имя');
    try {
      await saveUser({ id, body: { telegramId, name: values.name.trim(), role: values.role, isActive: values.isActive } }).unwrap();
      haptic('success');
      navigate('/admin/users');
    } catch (err) {
      fail(errorMessage(err));
    }
  }

  function fail(message: string) {
    setError(message);
    haptic('error');
  }

  useMainButton({ text: 'Сохранить', onClick: save, loading: saving });

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <BackLink to="/admin/users" />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{id === null ? 'Новый человек' : 'Редактирование'}</h2>
        <label className={styles.field}>
          <span className={styles.hint}>Имя, как оно будет в отчётах</span>
          <input className={styles.input} value={values.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.hint}>Telegram ID</span>
          <input
            className={styles.input}
            inputMode="numeric"
            value={values.telegramId}
            onChange={(e) => set('telegramId', e.target.value)}
          />
        </label>
        {id === null && (
          <p className={styles.hint}>
            Человек узнаёт свой ID, написав боту /start. После сохранения бот сообщит ему, что доступ открыт.
          </p>
        )}
        <div className={styles.chips}>
          {(['installer', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              disabled={isSelf}
              className={`${styles.chip} ${values.role === role ? styles.chipActive : ''}`}
              onClick={() => set('role', role)}
            >
              {roleLabels[role]}
            </button>
          ))}
        </div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            disabled={isSelf}
            checked={values.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          Доступ к приложению
        </label>
        {isSelf && <p className={styles.hint}>Свою роль и доступ изменить нельзя.</p>}
      </section>
      {error && <p className={styles.error}>{error}</p>}
      {!isInsideTelegram && (
        <button className={styles.submit} type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      )}
    </form>
  );
}
