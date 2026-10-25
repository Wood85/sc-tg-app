import styles from './ui.module.css';

const rotation = { down: 0, up: 180, left: 90, right: -90 };

// Шеврон-стрелка: SVG рисуется одинаково на всех устройствах, в отличие от символов ▼ и ›.
// Цвет берётся из текста (currentColor); смена направления анимируется.
export function Chevron({ direction = 'down', size = 20 }: { direction?: keyof typeof rotation; size?: number }) {
  return (
    <svg
      className={styles.chevron}
      style={{ transform: `rotate(${rotation[direction]}deg)` }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
