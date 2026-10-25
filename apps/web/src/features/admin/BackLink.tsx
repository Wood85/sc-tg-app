import { useNavigate } from 'react-router';
import { isInsideTelegram, useBackButton } from '../../telegram.ts';
import styles from '../../ui/ui.module.css';

// Внутри Telegram — нативная кнопка «Назад» в шапке, в браузере — ссылка.
export function BackLink({ to }: { to: string }) {
  const navigate = useNavigate();
  useBackButton(() => navigate(to));
  if (isInsideTelegram) return null;
  return (
    <button type="button" className={styles.backLink} onClick={() => navigate(to)}>
      ← Назад
    </button>
  );
}
