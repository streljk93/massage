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
} as const;
