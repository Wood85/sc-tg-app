import {
  type Category,
  categories,
  categoryLabels,
  formatMoneyInput,
  parseMoneyInput,
} from '@sc/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  errorMessage,
  useGetAdminMaterialsQuery,
  useGetAdminPriceItemsQuery,
  useSaveMaterialMutation,
  useSavePriceItemMutation,
} from '../../api/baseApi.ts';
import { haptic, isInsideTelegram, useMainButton } from '../../telegram.ts';
import styles from '../../ui/ui.module.css';
import { BackLink } from './BackLink.tsx';
import type { CatalogKind } from './CatalogList.tsx';

const commonUnits = ['шт', 'м', 'п.м.', 'м²', 'компл.'];

interface Values {
  category: Category;
  name: string;
  unit: string;
  price: string;
  isActive: boolean;
}

export function CatalogItemEdit({ kind }: { kind: CatalogKind }) {
  const { id: idParam } = useParams();
  const id = idParam === 'new' ? null : Number(idParam);
  const works = useGetAdminPriceItemsQuery(undefined, { skip: kind !== 'works' });
  const materials = useGetAdminMaterialsQuery(undefined, { skip: kind !== 'materials' });
  const query = kind === 'works' ? works : materials;

  if (query.isLoading) return <p className={styles.hint}>Загрузка…</p>;
  const priceItem = works.data?.find((r) => r.id === id);
  const existing = id === null ? undefined : query.data?.find((r) => r.id === id);
  if (id !== null && !existing) return <p className={styles.error}>Позиция не найдена</p>;

  const initial: Values = existing
    ? {
        category: existing.category,
        name: existing.name,
        unit: existing.unit,
        price: priceItem ? formatMoneyInput(priceItem.price) : '',
        isActive: existing.isActive,
      }
    : { category: 'conditioning', name: '', unit: 'шт', price: '', isActive: true };

  // key сбрасывает состояние формы при переходе к другой позиции.
  return <CatalogItemForm key={idParam} kind={kind} id={id} initial={initial} />;
}

function CatalogItemForm({ kind, id, initial }: { kind: CatalogKind; id: number | null; initial: Values }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [savePriceItem, priceState] = useSavePriceItemMutation();
  const [saveMaterial, materialState] = useSaveMaterialMutation();
  const saving = priceState.isLoading || materialState.isLoading;
  const listPath = `/admin/${kind}`;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    const price = parseMoneyInput(values.price);
    if (!values.name.trim() || !values.unit.trim()) return fail('Заполните название и единицу измерения');
    if (kind === 'works' && price === undefined) return fail('Цена — число в лари, например 25 или 25,50');

    const base = { category: values.category, name: values.name.trim(), unit: values.unit.trim(), isActive: values.isActive };
    try {
      if (kind === 'works') await savePriceItem({ id, body: { ...base, price: price! } }).unwrap();
      else await saveMaterial({ id, body: base }).unwrap();
      haptic('success');
      navigate(listPath);
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
      <BackLink to={listPath} />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {id === null ? (kind === 'works' ? 'Новая работа' : 'Новый материал') : 'Редактирование'}
        </h2>
        <div className={styles.chips}>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.chip} ${values.category === c ? styles.chipActive : ''}`}
              onClick={() => set('category', c)}
            >
              {categoryLabels[c]}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span className={styles.hint}>Название</span>
          <input className={styles.input} value={values.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.hint}>Единица измерения</span>
          <input
            className={styles.input}
            list="units"
            value={values.unit}
            onChange={(e) => set('unit', e.target.value)}
          />
          <datalist id="units">
            {commonUnits.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
        {kind === 'works' && (
          <label className={styles.field}>
            <span className={styles.hint}>Цена за единицу, ₾</span>
            <input
              className={styles.input}
              inputMode="decimal"
              placeholder="25,50"
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </label>
        )}
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={values.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          Показывать в форме отчёта
        </label>
        {kind === 'works' && id !== null && (
          <p className={styles.hint}>Новая цена применится к отчётам, отправленным после сохранения.</p>
        )}
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
