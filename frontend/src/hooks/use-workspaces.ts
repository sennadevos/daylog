import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: api.listWorkspaces,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.createWorkspace(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.updateWorkspace(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteWorkspace(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
  })
}
