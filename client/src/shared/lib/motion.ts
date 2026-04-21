import { cn } from "./utils";

/**
 * Спокойные микроанимации (токены и классы — `globals.css`, `@utility motion-*`).
 * Пример: `className={cn(motion.interactivePress, className)}`
 */
export const motion = {
  /** Плавные переходы цвета / прозрачности / transform */
  interactive: "motion-interactive",
  /** То же, медленнее */
  interactiveSlow: "motion-interactive-slow",
  /** Лёгкий scale при :active */
  press: "motion-press",
  /** Чуть заметнее нажатие */
  pressStrong: "motion-press-strong",
  /** interactive + press — типичная кнопка */
  interactivePress: "motion-interactive motion-press",
  /** Крупные цели (табы, нижняя навигация): заметнее нажатие */
  interactivePressStrong: "motion-interactive motion-press-strong",
  /** Только opacity */
  fade: "motion-fade",

  /**
   * Удаление строки из списка: схлопывание высоты (grid 1fr → 0fr) + fade/scale на контенте.
   * См. {@link listExitRowClassNames}.
   */
  listExitOuter:
    "grid transition-[grid-template-rows] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-out)]",
  listExitRowsOpen: "grid-rows-[1fr]",
  listExitRowsClosed: "grid-rows-[0fr]",
  listExitInner: "min-h-0 overflow-hidden",
  listExitCard:
    "transform-gpu transition-[opacity,transform] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-out)]",
  listExitCardLeaving:
    "pointer-events-none opacity-0 [transform:translateY(-0.5rem)_scale(0.97)]",
} as const;

/**
 * Готовые `className` для обёртки + карточки при «уходе» элемента списка (отмена, удаление).
 * Не тянет React Motion — только токены `--motion-*` и Tailwind.
 */
export function listExitRowClassNames(
  isExiting: boolean,
  cardClassName?: string,
): { outer: string; inner: string; card: string } {
  return {
    outer: cn(
      motion.listExitOuter,
      isExiting ? motion.listExitRowsClosed : motion.listExitRowsOpen,
    ),
    inner: motion.listExitInner,
    card: cn(
      cardClassName,
      motion.listExitCard,
      isExiting && motion.listExitCardLeaving,
    ),
  };
}
