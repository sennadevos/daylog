import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useCarryYesterday(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.carryYesterday(workspaceId, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
    },
  })
}

export function useSweep(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.sweepItems(workspaceId, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
    },
  })
}
