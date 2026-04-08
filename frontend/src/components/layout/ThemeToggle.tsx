import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const label = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      className="w-full justify-start gap-2 text-muted-foreground"
    >
      <span className="text-sm">{label}</span>
      <span className="text-xs capitalize">{theme}</span>
    </Button>
  )
}
