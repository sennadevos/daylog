import { WorkspaceList } from '@/components/workspace/WorkspaceList'
import { WorkspaceCreateDialog } from '@/components/workspace/WorkspaceCreateDialog'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3 py-4">
        <h1 className="text-sm font-semibold tracking-tight">daylog</h1>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{user.username}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
              onClick={() => logout.mutate()}
            >
              Log out
            </Button>
          </div>
        )}
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-2">
        <WorkspaceList />
      </div>
      <Separator />
      <div className="p-2 space-y-1">
        <WorkspaceCreateDialog />
        <ThemeToggle />
      </div>
    </aside>
  )
}
