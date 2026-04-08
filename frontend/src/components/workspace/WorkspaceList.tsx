import { NavLink } from 'react-router'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { cn } from '@/lib/utils'

export function WorkspaceList() {
  const { data: workspaces, isLoading } = useWorkspaces()

  if (isLoading) {
    return (
      <div className="space-y-1 px-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!workspaces?.length) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        No workspaces yet
      </p>
    )
  }

  return (
    <nav className="space-y-0.5 px-2">
      {workspaces.map(ws => (
        <NavLink
          key={ws.id}
          to={`/workspaces/${ws.id}`}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )
          }
        >
          {ws.name}
        </NavLink>
      ))}
    </nav>
  )
}
