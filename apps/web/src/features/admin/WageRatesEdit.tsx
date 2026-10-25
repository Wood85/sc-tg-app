import { formatMoneyInput, parseMoneyInput } from '@sc/shared';
import { useState } from 'react';
import { errorMessage, useGetWageRatesQuery, useSaveWageRatesMutation } from '../../api/baseApi.ts';
import { haptic, isInsideTelegram, useMainButton } from '../../telegram.ts';
import styles from '../../ui/ui.module.css';

export function WageRatesEdit() {
  const { data, isLoading, error } = useGetWageRatesQuery();
  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (error || !data) return <p className={styles.error}>{errorMessage(error)}</p>;
  return <WageRatesForm weekday={formatMoneyInput(data.weekday)} weekend={formatMoneyInput(data.weekend)} />;
}

function WageRatesForm(initial: { weekday: string; weekend: string }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [save, { isLoading: saving }] = useSaveWageRatesMutation();

  async function submit() {
    const weekday = parseMoneyInput(values.weekday);
    const weekend = parseMoneyInput(values.weekend);
    if (weekday === undefined || weekend === undefined) {
      setMessage({ text: 'Оклад — число в лари, например 70 или 72,50', error: true });
      haptic('error');
      return;
    }
    try {
      await save({ weekday, weekend }).unwrap();
      setMessage({ text: 'Сохранено' });
      haptic('success');
    } catch (err) {
      setMessage({ text: errorMessage(err), error: true });
      haptic('error');
    }
  }

  useMainButton({ text: 'Сохранить', onClick: submit, loading: saving });

  const field = (key: 'weekday' | 'weekend', label: string) => (
    <label className={styles.field}>
      <span className={styles.hint}>{label}, ₾</span>
      <input
        className={styles.input}
        inputMode="decimal"
        value={values[key]}
        onChange={(e) => {
          setValues((v) => ({ ...v, [key]: e.target.value }));
          setMessage(undefined);
        }}
      />
    </label>
  );

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Дневной оклад</h2>
        {field('weekday', 'Будний день (пн–пт)')}
        {field('weekend', 'Выходной (сб, вс)')}
        <p className={styles.hint}>
          Начисляется каждому, кто работал в этот день, один раз за день — с первым отправленным отчётом. Новые ставки
          применяются к дням, за которые оклад ещё не начислен.
        </p>
      </section>
      {message && <p className={message.error ? styles.error : styles.hint}>{message.text}</p>}
      {!isInsideTelegram && (
        <button className={styles.submit} type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      )}
    </form>
  );
}
