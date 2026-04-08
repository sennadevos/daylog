import { Outlet } from 'react-router'
import { Sidebar } from '@/components/layout/Sidebar'
import { LoginPage } from '@/pages/LoginPage'
import { useAuth } from '@/hooks/use-auth'

export function AppShell() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-background" />
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
