import { type Category, categories, categoryLabels, parseQtyInput, type PriceTier } from '@sc/shared';
import { useState } from 'react';
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
}

// Справочник с полем количества у каждой позиции. Позиции с количеством попадают в отчёт.
export function ItemPicker({ title, items, values, isInvalid, onChange }: ItemPickerProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;
  const selectedCount = Object.keys(values).length;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {selectedCount > 0 && <span className={styles.badge}>{selectedCount}</span>}
      </h2>
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
    </section>
  );
}
