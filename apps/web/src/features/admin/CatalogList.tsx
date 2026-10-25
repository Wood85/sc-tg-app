import { type Category, categories, categoryLabels, formatMoney, type PriceAddon, type PriceTier } from '@sc/shared';
import { Link } from 'react-router';
import { errorMessage, useGetAdminMaterialsQuery, useGetAdminPriceItemsQuery } from '../../api/baseApi.ts';
import { priceHint } from '../../ui/price.ts';
import styles from '../../ui/ui.module.css';

export type CatalogKind = 'works' | 'materials';

interface Row {
  id: number;
  category: Category;
  name: string;
  unit: string;
  price?: number;
  tiers?: PriceTier[] | null;
  addon?: PriceAddon | null;
  isActive: boolean;
}

export function CatalogList({ kind }: { kind: CatalogKind }) {
  const works = useGetAdminPriceItemsQuery(undefined, { skip: kind !== 'works' });
  const materials = useGetAdminMaterialsQuery(undefined, { skip: kind !== 'materials' });
  const query = kind === 'works' ? works : materials;
  const rows: Row[] = query.data ?? [];

  if (query.isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (query.error) return <p className={styles.error}>{errorMessage(query.error)}</p>;

  return (
    <div className={styles.form}>
      <Link to={`/admin/${kind}/new`} className={styles.secondaryButton}>
        + {kind === 'works' ? 'Добавить работу' : 'Добавить материал'}
      </Link>
      {categories.map((category) => {
        const group = rows.filter((r) => r.category === category);
        if (group.length === 0) return null;
        return (
          <section key={category} className={styles.section}>
            <h2 className={styles.sectionTitle}>{categoryLabels[category]}</h2>
            <div>
              {group.map((row) => (
                <Link
                  key={row.id}
                  to={`/admin/${kind}/${row.id}`}
                  className={`${styles.listRow} ${row.isActive ? '' : styles.muted}`}
                >
                  <span className={styles.itemName}>
                    {row.name}
                    <span className={styles.hint}>
                      {row.price !== undefined
                        ? priceHint({ price: row.price, unit: row.unit, tiers: row.tiers ?? null })
                        : row.unit}
                    </span>
                    {row.addon && (
                      <span className={styles.hint}>
                        + {row.addon.name.toLowerCase()} {formatMoney(row.addon.price)} / {row.unit}
                      </span>
                    )}
                  </span>
                  {!row.isActive && <span className={styles.tag}>скрыто</span>}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {rows.length === 0 && <p className={styles.hint}>Пока пусто.</p>}
    </div>
  );
}
