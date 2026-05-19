/**
 * motion.ts — animation constants for consistent transitions across the app.
 * Use these values in MUI sx={{ transition: ... }} props.
 * All durations in ms, all easings are CSS cubic-bezier strings.
 */

export const duration = {
  fast: "120ms",
  base: "180ms",
  slow: "280ms",
  enter: "220ms",
  exit: "160ms",
} as const

export const easing = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  decelerate: "cubic-bezier(0, 0, 0.2, 1)", // entering elements
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",  // exiting elements
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
} as const

/** Pre-built transition strings for common sx props */
export const transition = {
  /** Default hover transitions: border + bg */
  hover: `border-color ${duration.fast} ${easing.standard}, background-color ${duration.fast} ${easing.standard}`,
  /** Card lift: shadow + transform */
  lift: `transform ${duration.base} ${easing.decelerate}, box-shadow ${duration.base} ${easing.decelerate}`,
  /** Color + opacity fades */
  fade: `opacity ${duration.base} ${easing.standard}, color ${duration.base} ${easing.standard}`,
  /** Full all-properties (avoid overusing) */
  all: `all ${duration.base} ${easing.standard}`,
} as const
