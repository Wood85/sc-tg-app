import type { ReactNode } from 'react';
import styles from './ui.module.css';

// Плавно раскрываемый блок. Содержимое всегда в DOM (для анимации); свёрнутое недоступно с клавиатуры.
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.collapse} ${open ? styles.collapseOpen : ''}`} inert={!open}>
      <div className={styles.collapseInner}>{children}</div>
    </div>
  );
}
