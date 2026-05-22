export const defaultSettings = {
  theme: 'dark',
  accentColor: 'green',
  reducedMotion: false,
  compactMode: false,
  flexDaysPerWeek: 2,
  lowThresholdDays: 3,
  urgentThresholdDays: 1,
  supplementLowThresholdDays: 7,
  supplementUrgentThresholdDays: 2,
}

export const themeOptions = ['dark', 'light', 'system']
export const accentOptions = ['green', 'blue', 'orange', 'purple']
export const flexDayOptions = [0, 1, 2, 3]

function clampNumber(value, fallback, min, max) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsedValue))
}

export function sanitizeSettings(savedSettings = {}) {
  return {
    theme: themeOptions.includes(savedSettings.theme)
      ? savedSettings.theme
      : defaultSettings.theme,
    accentColor: accentOptions.includes(savedSettings.accentColor)
      ? savedSettings.accentColor
      : defaultSettings.accentColor,
    reducedMotion: Boolean(savedSettings.reducedMotion),
    compactMode: Boolean(savedSettings.compactMode),
    flexDaysPerWeek: clampNumber(
      savedSettings.flexDaysPerWeek,
      defaultSettings.flexDaysPerWeek,
      0,
      3,
    ),
    lowThresholdDays: clampNumber(
      savedSettings.lowThresholdDays,
      defaultSettings.lowThresholdDays,
      0,
      30,
    ),
    urgentThresholdDays: clampNumber(
      savedSettings.urgentThresholdDays,
      defaultSettings.urgentThresholdDays,
      0,
      30,
    ),
    supplementLowThresholdDays: clampNumber(
      savedSettings.supplementLowThresholdDays,
      defaultSettings.supplementLowThresholdDays,
      0,
      60,
    ),
    supplementUrgentThresholdDays: clampNumber(
      savedSettings.supplementUrgentThresholdDays,
      defaultSettings.supplementUrgentThresholdDays,
      0,
      60,
    ),
  }
}

export function getSystemTheme() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function resolveTheme(theme, systemTheme) {
  return theme === 'system' ? systemTheme : theme
}
