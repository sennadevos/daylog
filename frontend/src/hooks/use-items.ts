import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { DayEntry, ItemState } from '@/types/api'

export function useCreateItem(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => api.createItem(workspaceId, date, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
    },
  })
}

export function useUpdateItem(workspaceId: number, date: string) {
  const qc = useQueryClient()
  const key = queryKeys.days.detail(workspaceId, date)

  return useMutation({
    mutationFn: ({ itemId, updates }: { itemId: number; updates: { text?: string; description?: string; state?: ItemState } }) =>
      api.updateItem(workspaceId, date, itemId, updates),
    onMutate: async ({ itemId, updates }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<DayEntry>(key)
      if (previous) {
        qc.setQueryData<DayEntry>(key, {
          ...previous,
          items: previous.items.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDeleteItem(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => api.deleteItem(workspaceId, date, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
    },
  })
}

export function useMoveItem(workspaceId: number, date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, toDate }: { itemId: number; toDate: string }) =>
      api.moveItem(workspaceId, date, itemId, toDate),
    onSuccess: (_data, { toDate }) => {
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, date) })
      qc.invalidateQueries({ queryKey: queryKeys.days.detail(workspaceId, toDate) })
    },
  })
}

export function useReorderItems(workspaceId: number, date: string) {
  const qc = useQueryClient()
  const key = queryKeys.days.detail(workspaceId, date)

  return useMutation({
    mutationFn: (itemIds: number[]) => api.reorderItems(workspaceId, date, itemIds),
    onMutate: async (itemIds) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<DayEntry>(key)
      if (previous) {
        const itemMap = new Map(previous.items.map(i => [i.id, i]))
        const reordered = itemIds
          .map((id, idx) => {
            const item = itemMap.get(id)
            return item ? { ...item, position: idx } : null
          })
          .filter(Boolean)
        qc.setQueryData<DayEntry>(key, { ...previous, items: reordered as DayEntry['items'] })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}
