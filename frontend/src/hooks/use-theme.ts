import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolved: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolved: 'light',
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeProvider() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('daylog-theme')
    return (stored as Theme) ?? 'system'
  })

  const getResolved = useCallback((t: Theme): 'light' | 'dark' => {
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return t
  }, [])

  const [resolved, setResolved] = useState<'light' | 'dark'>(() => getResolved(theme))

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('daylog-theme', t)
  }, [])

  useEffect(() => {
    const r = getResolved(theme)
    setResolved(r)
    document.documentElement.classList.toggle('dark', r === 'dark')
  }, [theme, getResolved])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = getResolved('system')
      setResolved(r)
      document.documentElement.classList.toggle('dark', r === 'dark')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, getResolved])

  return { theme, setTheme, resolved }
}
