import {
  type Category,
  categories,
  categoryLabels,
  formatMoneyInput,
  parseMoneyInput,
  parseQtyInput,
  type PriceAddon,
  type PriceTier,
  priceTiersSchema,
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
const defaultAddonName = 'Оклейка в изоляцию';

// Ступень в форме: строки как ввёл админ; у последней ступени границы нет.
interface TierValues {
  upTo: string;
  price: string;
}

interface Values {
  category: Category;
  name: string;
  unit: string;
  price: string;
  tiered: boolean;
  tiers: TierValues[];
  hasAddon: boolean;
  addonName: string;
  addonPrice: string;
  isActive: boolean;
}

function toTierValues(tiers: PriceTier[]): TierValues[] {
  return tiers.map((t) => ({ upTo: t.upTo === null ? '' : String(t.upTo).replace('.', ','), price: formatMoneyInput(t.price) }));
}

function parseTiers(rows: TierValues[]): PriceTier[] | string {
  const tiers: PriceTier[] = [];
  for (const [i, row] of rows.entries()) {
    const isLast = i === rows.length - 1;
    const upTo = isLast ? null : parseQtyInput(row.upTo);
    const price = parseMoneyInput(row.price);
    if (upTo === undefined) return `Ступень ${i + 1}: граница — число больше нуля`;
    if (price === undefined) return `Ступень ${i + 1}: цена — число в лари`;
    tiers.push({ upTo, price });
  }
  const result = priceTiersSchema.safeParse(tiers);
  return result.success ? result.data : (result.error.issues[0]?.message ?? 'Некорректные ступени');
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
        tiered: Boolean(priceItem?.tiers),
        tiers: priceItem?.tiers ? toTierValues(priceItem.tiers) : [],
        hasAddon: Boolean(priceItem?.addon),
        addonName: priceItem?.addon?.name ?? defaultAddonName,
        addonPrice: priceItem?.addon ? formatMoneyInput(priceItem.addon.price) : '',
        isActive: existing.isActive,
      }
    : {
        category: 'conditioning',
        name: '',
        unit: 'шт',
        price: '',
        tiered: false,
        tiers: [],
        hasAddon: false,
        addonName: defaultAddonName,
        addonPrice: '',
        isActive: true,
      };

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

  function setTiered(tiered: boolean) {
    setValues((v) => ({
      ...v,
      tiered,
      // Первая ступень наследует обычную цену, вторая — «больше».
      tiers: tiered && v.tiers.length === 0 ? [{ upTo: '', price: v.price }, { upTo: '', price: '' }] : v.tiers,
    }));
  }

  function setTier(index: number, field: keyof TierValues, value: string) {
    setValues((v) => ({ ...v, tiers: v.tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)) }));
  }

  function addTier() {
    // Новая ступень встаёт перед последней («больше …»).
    setValues((v) => ({ ...v, tiers: [...v.tiers.slice(0, -1), { upTo: '', price: '' }, ...v.tiers.slice(-1)] }));
  }

  function removeTier(index: number) {
    setValues((v) => ({ ...v, tiers: v.tiers.filter((_, i) => i !== index) }));
  }

  async function save() {
    if (!values.name.trim() || !values.unit.trim()) return fail('Заполните название и единицу измерения');
    const base = { category: values.category, name: values.name.trim(), unit: values.unit.trim(), isActive: values.isActive };

    let pricing: { price: number; tiers: PriceTier[] | null; addon: PriceAddon | null } | undefined;
    if (kind === 'works') {
      let addon: PriceAddon | null = null;
      if (values.hasAddon) {
        const addonPrice = parseMoneyInput(values.addonPrice);
        if (!values.addonName.trim()) return fail('Укажите название доплаты');
        if (addonPrice === undefined) return fail('Доплата — число в лари, например 1');
        addon = { name: values.addonName.trim(), price: addonPrice };
      }
      if (values.tiered) {
        const tiers = parseTiers(values.tiers);
        if (typeof tiers === 'string') return fail(tiers);
        pricing = { price: tiers[0]!.price, tiers, addon };
      } else {
        const price = parseMoneyInput(values.price);
        if (price === undefined) return fail('Цена — число в лари, например 25 или 25,50');
        pricing = { price, tiers: null, addon };
      }
    }

    try {
      if (pricing) await savePriceItem({ id, body: { ...base, ...pricing } }).unwrap();
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
        <div className={styles.field}>
          <span className={styles.hint}>Единица измерения</span>
          <div className={styles.chips}>
            {commonUnits.map((u) => (
              <button
                key={u}
                type="button"
                className={`${styles.chip} ${values.unit === u ? styles.chipActive : ''}`}
                onClick={() => set('unit', u)}
              >
                {u}
              </button>
            ))}
          </div>
          <input
            className={styles.input}
            placeholder="или своя единица"
            value={commonUnits.includes(values.unit) ? '' : values.unit}
            onChange={(e) => set('unit', e.target.value)}
          />
        </div>
        {kind === 'works' && (
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={values.tiered} onChange={(e) => setTiered(e.target.checked)} />
            Цена зависит от объёма в отчёте
          </label>
        )}
        {kind === 'works' && !values.tiered && (
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
        {kind === 'works' && values.tiered && (
          <div className={styles.field}>
            <span className={styles.hint}>Цена за {values.unit || 'единицу'}, ₾ — по общему объёму в отчёте</span>
            {values.tiers.map((tier, i) => {
              const isLast = i === values.tiers.length - 1;
              return (
                <div key={i} className={styles.tierRow}>
                  {isLast ? (
                    <span className={styles.tierBound}>{values.tiers.length > 1 ? 'больше' : 'любой объём'}</span>
                  ) : (
                    <span className={styles.tierBound}>
                      до
                      <input
                        className={styles.qtyInput}
                        inputMode="decimal"
                        value={tier.upTo}
                        onChange={(e) => setTier(i, 'upTo', e.target.value)}
                      />
                      {values.unit}
                    </span>
                  )}
                  <input
                    className={styles.qtyInput}
                    inputMode="decimal"
                    placeholder="₾"
                    value={tier.price}
                    onChange={(e) => setTier(i, 'price', e.target.value)}
                  />
                  {!isLast && values.tiers.length > 2 ? (
                    <button type="button" className={styles.iconButton} onClick={() => removeTier(i)} aria-label="Удалить ступень">
                      ×
                    </button>
                  ) : (
                    <span className={styles.iconButton} />
                  )}
                </div>
              );
            })}
            <button type="button" className={styles.backLink} onClick={addTier}>
              + ступень
            </button>
          </div>
        )}
        {kind === 'works' && (
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={values.hasAddon} onChange={(e) => set('hasAddon', e.target.checked)} />
            Доплата за часть объёма (например, оклейка в изоляцию)
          </label>
        )}
        {kind === 'works' && values.hasAddon && (
          <div className={styles.tierRow}>
            <input
              className={styles.input}
              placeholder="Название доплаты"
              value={values.addonName}
              onChange={(e) => set('addonName', e.target.value)}
            />
            <input
              className={styles.qtyInput}
              inputMode="decimal"
              placeholder="₾"
              value={values.addonPrice}
              onChange={(e) => set('addonPrice', e.target.value)}
            />
            <span className={styles.unit}>/ {values.unit || 'ед.'}</span>
          </div>
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
