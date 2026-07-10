export type AppTheme = 'dark' | 'light'

const APP_THEME_KEY = 'ui-theme'

export function getStoredAppTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(APP_THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function storeAppTheme(theme: AppTheme) {
  try {
    localStorage.setItem(APP_THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

export const LOGIN_SCREEN_THEME: AppTheme = 'light'
