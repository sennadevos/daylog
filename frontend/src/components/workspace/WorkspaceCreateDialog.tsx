import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateWorkspace } from '@/hooks/use-workspaces'

export function WorkspaceCreateDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateWorkspace()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create.mutate(name.trim(), {
      onSuccess: () => {
        setName('')
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" />}
      >
        + New workspace
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Workspace name"
            autoFocus
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
