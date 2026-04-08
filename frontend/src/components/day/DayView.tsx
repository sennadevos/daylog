import { useState, useEffect, useCallback, useRef } from 'react'
import { useDayEntry } from '@/hooks/use-day-entry'
import { useCreateItem, useUpdateItem, useDeleteItem, useMoveItem, useReorderItems } from '@/hooks/use-items'
import { useCarryYesterday, useSweep } from '@/hooks/use-carry'
import { DayNavigator } from '@/components/day/DayNavigator'
import { ItemList } from '@/components/items/ItemList'
import { StoryEditor } from '@/components/story/StoryEditor'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { IterationCcwIcon, ChevronLeftIcon, CheckIcon } from 'lucide-react'
import type { Item } from '@/types/api'

interface Props {
  workspaceId: number
  date: string
}

interface CarryNotice {
  count: number
  type: 'sweep' | 'yesterday'
}

export function DayView({ workspaceId, date }: Props) {
  const { data: day, isLoading, error } = useDayEntry(workspaceId, date)
  const createItem = useCreateItem(workspaceId, date)
  const updateItem = useUpdateItem(workspaceId, date)
  const deleteItem = useDeleteItem(workspaceId, date)
  const moveItem = useMoveItem(workspaceId, date)
  const reorderItems = useReorderItems(workspaceId, date)
  const carryYesterday = useCarryYesterday(workspaceId, date)
  const sweep = useSweep(workspaceId, date)

  const [notice, setNotice] = useState<CarryNotice | null>(null)
  const [carriedOriginIds, setCarriedOriginIds] = useState<Set<string>>(new Set())
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const prevItemsRef = useRef<Item[]>([])

  // Track which origin_ids are new after a carry/sweep
  const trackCarriedItems = useCallback((prevItems: Item[], newItems: Item[]) => {
    const prevIds = new Set(prevItems.map(i => i.origin_id))
    const newOriginIds = new Set<string>()
    for (const item of newItems) {
      if (!prevIds.has(item.origin_id)) {
        newOriginIds.add(item.origin_id)
      }
    }
    return newOriginIds
  }, [])

  // Reset carried state when date changes
  useEffect(() => {
    setCarriedOriginIds(new Set())
    setNotice(null)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [date])

  // Keep prevItemsRef in sync
  useEffect(() => {
    if (day?.items) {
      prevItemsRef.current = day.items
    }
  }, [day?.items])

  const showNotice = useCallback((n: CarryNotice) => {
    setNotice(n)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  const handleSweep = () => {
    const before = prevItemsRef.current
    sweep.mutate(undefined, {
      onSuccess: (result) => {
        showNotice({ count: result.carried_items, type: 'sweep' })
        // After query invalidation resolves, mark new items
        if (result.carried_items > 0) {
          // Small delay to let query refetch settle
          setTimeout(() => {
            if (day?.items) {
              setCarriedOriginIds(trackCarriedItems(before, day.items))
            }
          }, 500)
        }
      },
    })
  }

  const handleCarryYesterday = () => {
    const before = prevItemsRef.current
    carryYesterday.mutate(undefined, {
      onSuccess: (result) => {
        showNotice({ count: result.carried_items, type: 'yesterday' })
        if (result.carried_items > 0) {
          setTimeout(() => {
            if (day?.items) {
              setCarriedOriginIds(trackCarriedItems(before, day.items))
            }
          }, 500)
        }
      },
    })
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-destructive text-sm">
        Failed to load day entry: {error.message}
      </div>
    )
  }

  if (!day) return null

  const isCarrying = sweep.isPending || carryYesterday.isPending

  return (
    <div className="max-w-2xl mx-auto p-8">
      <DayNavigator workspaceId={workspaceId} date={date} />

      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tasks</h3>
            <div className="flex items-center gap-1">
              {notice && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1 animate-in fade-in slide-in-from-right-2 duration-200">
                  <CheckIcon className="size-3 text-muted-foreground" />
                  {notice.count === 0
                    ? 'No items to carry'
                    : `${notice.count} item${notice.count !== 1 ? 's' : ''} carried`
                  }
                </span>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleCarryYesterday}
                      disabled={isCarrying}
                      className="text-muted-foreground"
                    />
                  }
                >
                  <ChevronLeftIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Carry from yesterday</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleSweep}
                      disabled={isCarrying}
                      className="text-muted-foreground"
                    />
                  }
                >
                  <IterationCcwIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Sweep unchecked from all previous days</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <ItemList
            items={day.items}
            carriedOriginIds={carriedOriginIds.size > 0 ? carriedOriginIds : undefined}
            onToggle={(id, checked) =>
              updateItem.mutate({ itemId: id, updates: { state: checked ? 'checked' : 'unchecked' } })
            }
            onUpdateText={(id, text) =>
              updateItem.mutate({ itemId: id, updates: { text } })
            }
            onUpdateDescription={(id, description) =>
              updateItem.mutate({ itemId: id, updates: { description } })
            }
            onDelete={id => deleteItem.mutate(id)}
            onRevoke={id =>
              updateItem.mutate({ itemId: id, updates: { state: 'revoked' } })
            }
            onMove={(id, toDate) =>
              moveItem.mutate({ itemId: id, toDate })
            }
            onReorder={ids => reorderItems.mutate(ids)}
            onAdd={text => createItem.mutate(text)}
          />
        </div>

        <Separator />

        <StoryEditor
          workspaceId={workspaceId}
          date={date}
          initialStory={day.story}
        />
      </div>
    </div>
  )
}
