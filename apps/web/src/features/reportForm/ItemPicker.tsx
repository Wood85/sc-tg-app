import { type Category, categories, categoryLabels, parseQtyInput, type PriceTier } from '@sc/shared';
import { useEffect, useState } from 'react';
import { Chevron } from '../../ui/Chevron.tsx';
import { Collapse } from '../../ui/Collapse.tsx';
import { priceHint } from '../../ui/price.ts';
import styles from '../../ui/ui.module.css';

interface PickerItem {
  id: number;
  category: Category;
  name: string;
  unit: string;
  price?: number;
  tiers?: PriceTier[] | null;
}

interface ItemPickerProps {
  title: string;
  items: PickerItem[];
  values: Record<number, string>;
  isInvalid: (id: number) => boolean;
  onChange: (id: number, value: string) => void;
  // Номер неудачной попытки отправить отчёт: на каждой список с ошибкой раскрывается.
  submitAttempt: number;
}

// Справочник с полем количества у каждой позиции. Позиции с количеством попадают в отчёт.
// По умолчанию свёрнут: в свёрнутом виде видно только то, что уже выбрано.
export function ItemPicker({ title, items, values, isInvalid, onChange, submitAttempt }: ItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;
  const selected = items.filter((i) => values[i.id]);
  const hasInvalid = items.some((i) => isInvalid(i.id));

  // Ошибку в количестве нужно показать, даже если список свёрнут.
  useEffect(() => {
    if (submitAttempt > 0 && hasInvalid) setOpen(true);
    // Только на новую попытку отправки: иначе список нельзя было бы свернуть, пока в нём ошибка.
  }, [submitAttempt]);

  return (
    <section className={`${styles.section} ${styles.sectionCollapsible}`}>
      <button type="button" className={styles.sectionToggle} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={styles.sectionTitle}>
          {title}
          {selected.length > 0 && <span className={styles.badge}>{selected.length}</span>}
        </span>
        <span className={styles.toggleIcon}>
          <Chevron direction={open ? 'up' : 'down'} />
        </span>
      </button>
      {!open && selected.length > 0 && (
        <ul className={styles.selectedSummary}>
          {selected.map((item) => (
            <li key={item.id}>
              {item.name} — {values[item.id]} {item.unit}
            </li>
          ))}
        </ul>
      )}
      <Collapse open={open}>
        <div className={styles.collapseContent}>
          <input
            className={styles.input}
            type="search"
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {categories.map((category) => {
            const group = visible.filter((i) => i.category === category);
            if (group.length === 0) return null;
            return (
              <div key={category}>
                <h3 className={styles.groupTitle}>{categoryLabels[category]}</h3>
                {group.map((item) => {
                  const value = values[item.id] ?? '';
                  return (
                    <label key={item.id} className={`${styles.itemRow} ${value ? styles.itemSelected : ''}`}>
                      <span className={styles.itemName}>
                        {item.name}
                        {item.price !== undefined && (
                          <span className={styles.hint}>
                            {priceHint({ price: item.price, unit: item.unit, tiers: item.tiers ?? null }, parseQtyInput(value))}
                          </span>
                        )}
                      </span>
                      <span className={styles.qty}>
                        <input
                          className={`${styles.qtyInput} ${isInvalid(item.id) ? styles.invalid : ''}`}
                          type="text"
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => onChange(item.id, e.target.value)}
                        />
                        <span className={styles.unit}>{item.unit}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
          {visible.length === 0 && <p className={styles.hint}>Ничего не найдено</p>}
        </div>
      </Collapse>
    </section>
  );
}
