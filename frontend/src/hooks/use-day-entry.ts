import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useDayEntry(workspaceId: number, date: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!workspaceId || !date) return
    const parsed = new Date(date + 'T00:00:00')
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue
      const d = format(addDays(parsed, offset), 'yyyy-MM-dd')
      qc.prefetchQuery({
        queryKey: queryKeys.days.detail(workspaceId, d),
        queryFn: () => api.getDay(workspaceId, d),
      })
    }
  }, [workspaceId, date, qc])

  return useQuery({
    queryKey: queryKeys.days.detail(workspaceId, date),
    queryFn: () => api.getDay(workspaceId, date),
    enabled: !!workspaceId && !!date,
  })
}

export function useDayList(workspaceId: number, params?: { limit?: number; before?: string }) {
  return useQuery({
    queryKey: [...queryKeys.days.list(workspaceId), params],
    queryFn: () => api.listDays(workspaceId, params),
    enabled: !!workspaceId,
  })
}

export function useUpdateStory(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (story: string) => api.updateStory(workspaceId, date, story),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
    },
  })
}
