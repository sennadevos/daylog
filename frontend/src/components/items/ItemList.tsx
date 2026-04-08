import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ItemRow } from '@/components/items/ItemRow'
import { ItemCreateInput } from '@/components/items/ItemCreateInput'
import type { Item } from '@/types/api'

interface Props {
  items: Item[]
  carriedOriginIds?: Set<string>
  onToggle: (id: number, checked: boolean) => void
  onUpdateText: (id: number, text: string) => void
  onUpdateDescription: (id: number, description: string) => void
  onDelete: (id: number) => void
  onRevoke: (id: number) => void
  onMove: (id: number, toDate: string) => void
  onReorder: (itemIds: number[]) => void
  onAdd: (text: string) => void
}

export function ItemList({ items, carriedOriginIds, onToggle, onUpdateText, onUpdateDescription, onDelete, onRevoke, onMove, onReorder, onAdd }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...items]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    onReorder(reordered.map(i => i.id))
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              carried={carriedOriginIds?.has(item.origin_id)}
              onToggle={onToggle}
              onUpdateText={onUpdateText}
              onUpdateDescription={onUpdateDescription}
              onDelete={onDelete}
              onRevoke={onRevoke}
              onMove={onMove}
            />
          ))}
        </SortableContext>
      </DndContext>
      <ItemCreateInput onAdd={onAdd} />
    </div>
  )
}
