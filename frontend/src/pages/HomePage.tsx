import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { WorkspaceCreateDialog } from '@/components/workspace/WorkspaceCreateDialog'

export function HomePage() {
  const { data: workspaces, isLoading } = useWorkspaces()
  const navigate = useNavigate()

  useEffect(() => {
    if (workspaces?.length) {
      navigate(`/workspaces/${workspaces[0].id}`, { replace: true })
    }
  }, [workspaces, navigate])

  if (isLoading) return null

  if (!workspaces?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p className="text-lg">No workspaces yet</p>
        <p className="text-sm">Create one to get started</p>
        <WorkspaceCreateDialog />
      </div>
    )
  }

  return null
}
