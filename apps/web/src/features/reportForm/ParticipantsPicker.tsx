import type { UserBriefDto } from '@sc/shared';
import { useState } from 'react';
import { hapticSelection } from '../../telegram.ts';
import { Chevron } from '../../ui/Chevron.tsx';
import { Collapse } from '../../ui/Collapse.tsx';
import styles from '../../ui/ui.module.css';

interface ParticipantsPickerProps {
  // Все, кроме автора отчёта.
  colleagues: UserBriefDto[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

// «2 человека», «5 человек», «22 человека».
function peopleCount(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
  return `${n} ${few ? 'человека' : 'человек'}`;
}

// Выбор бригады. Свёрнут по умолчанию; в свёрнутом виде видны выбранные имена.
export function ParticipantsPicker({ colleagues, selectedIds, onToggle }: ParticipantsPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = colleagues.filter((u) => selectedIds.includes(u.id));

  return (
    <section className={`${styles.section} ${styles.sectionCollapsible}`}>
      <button type="button" className={styles.sectionToggle} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={styles.sectionTitle}>
          Кто работал со мной
          {selected.length > 0 && <span className={styles.badge}>{selected.length}</span>}
        </span>
        <span className={styles.toggleIcon}>
          <Chevron direction={open ? 'up' : 'down'} />
        </span>
      </button>
      {!open && (
        <p className={styles.selectedSummary}>
          {selected.length > 0 ? selected.map((u) => u.name).join(', ') : 'Работал один'}
        </p>
      )}
      <Collapse open={open}>
        <div className={styles.collapseContent}>
          <div>
            {colleagues.map((user) => (
              <label key={user.id} className={styles.personRow}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(user.id)}
                  onChange={() => {
                    hapticSelection();
                    onToggle(user.id);
                  }}
                />
                {user.name}
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <p className={styles.hint}>Сумма делится поровну на {peopleCount(selected.length + 1)}, включая вас.</p>
          )}
        </div>
      </Collapse>
    </section>
  );
}
