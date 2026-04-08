import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateWorkspace, useDeleteWorkspace } from '@/hooks/use-workspaces'
import { useNavigate } from 'react-router'
import type { Workspace } from '@/types/api'

interface Props {
  workspace: Workspace
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkspaceSettingsDialog({ workspace, open, onOpenChange }: Props) {
  const [name, setName] = useState(workspace.name)
  const update = useUpdateWorkspace()
  const remove = useDeleteWorkspace()
  const navigate = useNavigate()

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim() === workspace.name) return
    update.mutate({ id: workspace.id, name: name.trim() }, {
      onSuccess: () => onOpenChange(false),
    })
  }

  const handleDelete = () => {
    remove.mutate(workspace.id, {
      onSuccess: () => {
        onOpenChange(false)
        navigate('/')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRename} className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workspace name"
          />
          <Button type="submit" disabled={!name.trim() || name.trim() === workspace.name}>
            Rename
          </Button>
        </form>
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={remove.isPending}
          >
            Delete workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
