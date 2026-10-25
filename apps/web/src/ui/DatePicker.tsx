import {
  addDays,
  addMonths,
  compareMonths,
  dateLabel,
  fromIsoDate,
  monthGrid,
  monthOf,
  monthTitle,
  today,
  weekdayNames,
} from '@sc/shared';
import { useState } from 'react';
import { hapticSelection } from '../telegram.ts';
import { Chevron } from './Chevron.tsx';
import { Collapse } from './Collapse.tsx';
import styles from './ui.module.css';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  // Последняя доступная дата включительно (YYYY-MM-DD).
  max?: string;
}

// Свой календарь вместо <input type="date">: нативный выглядит по-разному на каждой платформе
// и не подстраивается под тему Telegram.
export function DatePicker({ value, onChange, max }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value));
  // Направление последнего листания — от него зависит, с какой стороны выезжает месяц.
  const [direction, setDirection] = useState<'back' | 'forward' | null>(null);
  const todayIso = today();
  const maxMonth = max ? monthOf(max) : undefined;
  const canGoForward = !maxMonth || compareMonths(view, maxMonth) < 0;

  function toggle() {
    if (!open) {
      setView(monthOf(value));
      setDirection(null);
    }
    setOpen(!open);
  }

  function goToMonth(delta: number) {
    setDirection(delta < 0 ? 'back' : 'forward');
    setView(addMonths(view, delta));
  }

  function select(iso: string) {
    hapticSelection();
    onChange(iso);
    setOpen(false);
  }

  const shortcuts = [
    { label: 'Сегодня', iso: todayIso },
    { label: 'Вчера', iso: addDays(todayIso, -1) },
    { label: 'Позавчера', iso: addDays(todayIso, -2) },
  ].filter((s) => !max || s.iso <= max);

  return (
    <div className={styles.datePicker}>
      <button type="button" className={`${styles.input} ${styles.dateField}`} onClick={toggle} aria-expanded={open}>
        <span>{dateLabel(value, todayIso)}</span>
        <span className={styles.toggleIcon}>
          <Chevron direction={open ? 'up' : 'down'} />
        </span>
      </button>

      <Collapse open={open}>
        <div className={styles.calendar}>
          <div className={styles.chips}>
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                className={`${styles.chip} ${value === s.iso ? styles.chipActive : ''}`}
                onClick={() => select(s.iso)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.calendarHeader}>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => goToMonth(-1)}
              aria-label="Предыдущий месяц"
            >
              <Chevron direction="left" />
            </button>
            <span>{monthTitle(view)}</span>
            <button
              type="button"
              className={styles.calendarNav}
              onClick={() => goToMonth(1)}
              disabled={!canGoForward}
              aria-label="Следующий месяц"
            >
              <Chevron direction="right" />
            </button>
          </div>

          <div
            // Новый key при смене месяца перезапускает анимацию появления.
            key={`${view.year}-${view.month}`}
            className={`${styles.calendarGrid} ${direction ? styles[direction === 'back' ? 'slideFromLeft' : 'slideFromRight'] : ''}`}
          >
            {weekdayNames.map((name) => (
              <span key={name} className={styles.calendarWeekday}>
                {name}
              </span>
            ))}
            {monthGrid(view).map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  disabled={Boolean(max && iso > max)}
                  className={[
                    styles.calendarDay,
                    iso === value ? styles.calendarDaySelected : '',
                    iso === todayIso ? styles.calendarDayToday : '',
                  ].join(' ')}
                  onClick={() => select(iso)}
                >
                  {fromIsoDate(iso).getDate()}
                </button>
              ) : (
                <span key={`empty-${i}`} />
              ),
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}
