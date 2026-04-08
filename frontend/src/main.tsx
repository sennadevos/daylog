import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeContext, useThemeProvider } from '@/hooks/use-theme'
import { ApiError } from '@/lib/api'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: (failureCount: number, error: Error) => {
        if (error instanceof ApiError && error.status === 401) return false
        return failureCount < 1
      },
    },
    mutations: {
      onError: (error: Error) => {
        if (error instanceof ApiError && error.status === 401) {
          queryClient.setQueryData(['auth', 'me'], null)
        }
      },
    },
  },
})

function Root() {
  const themeValue = useThemeProvider()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={themeValue}>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
