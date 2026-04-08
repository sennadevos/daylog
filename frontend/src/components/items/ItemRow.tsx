import { useState, useRef, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/api'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { GripVerticalIcon, TextIcon, CalendarArrowUpIcon, XIcon, Trash2Icon, IterationCcwIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

interface Props {
  item: Item
  carried?: boolean
  onToggle: (id: number, checked: boolean) => void
  onUpdateText: (id: number, text: string) => void
  onUpdateDescription: (id: number, description: string) => void
  onDelete: (id: number) => void
  onRevoke: (id: number) => void
  onMove: (id: number, toDate: string) => void
}

export function ItemRow({ item, carried, onToggle, onUpdateText, onUpdateDescription, onDelete, onRevoke, onMove }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  const [expanded, setExpanded] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState(item.description)
  const [moveOpen, setMoveOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => { setText(item.text) }, [item.text])
  useEffect(() => { setDesc(item.description) }, [item.description])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (editingDesc) descRef.current?.focus() }, [editingDesc])

  const commitEdit = () => {
    setEditing(false)
    const trimmed = text.trim()
    if (trimmed && trimmed !== item.text) {
      onUpdateText(item.id, trimmed)
    } else {
      setText(item.text)
    }
  }

  const commitDesc = () => {
    setEditingDesc(false)
    if (desc !== item.description) {
      onUpdateDescription(item.id, desc)
    }
  }

  const isChecked = item.state === 'checked'
  const isRevoked = item.state === 'revoked'
  const hasDesc = item.description.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-md px-2 py-1.5 transition-colors',
        'hover:bg-accent/50',
        isDragging && 'opacity-50 bg-accent'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          tabIndex={-1}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>

        <Checkbox
          checked={isChecked}
          disabled={isRevoked}
          onCheckedChange={checked => onToggle(item.id, checked as boolean)}
          className="shrink-0"
        />

        {editing ? (
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') { setText(item.text); setEditing(false) }
            }}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        ) : (
          <span
            onDoubleClick={() => !isRevoked && setEditing(true)}
            className={cn(
              'flex-1 text-sm cursor-default select-none inline-flex items-center gap-1.5',
              isChecked && 'line-through text-muted-foreground',
              isRevoked && 'line-through text-muted-foreground italic'
            )}
          >
            {item.text}
            {carried && (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="inline-flex shrink-0" />}
                >
                  <IterationCcwIcon className="size-3 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent>Carried forward</TooltipContent>
              </Tooltip>
            )}
          </span>
        )}

        {hasDesc && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground px-0.5"
            title={expanded ? 'Collapse' : 'Expand description'}
          >
            {expanded
              ? <ChevronDownIcon className="size-3.5" />
              : <ChevronRightIcon className="size-3.5" />
            }
          </button>
        )}

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!hasDesc && (
            <button
              onClick={() => { setExpanded(true); setEditingDesc(true) }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-sm hover:bg-accent"
              title="Add description"
            >
              <TextIcon className="size-3.5" />
            </button>
          )}
          <Popover open={moveOpen} onOpenChange={setMoveOpen}>
            <PopoverTrigger
              render={<button className="text-muted-foreground hover:text-foreground p-0.5 rounded-sm hover:bg-accent" title="Move to another day" />}
            >
              <CalendarArrowUpIcon className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                onSelect={d => {
                  if (d) {
                    onMove(item.id, format(d, 'yyyy-MM-dd'))
                    setMoveOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          {!isRevoked && (
            <button
              onClick={() => onRevoke(item.id)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-sm hover:bg-accent"
              title="Revoke"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="text-muted-foreground hover:text-destructive p-0.5 rounded-sm hover:bg-accent"
            title="Delete"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-12 mt-1">
          {editingDesc ? (
            <textarea
              ref={descRef}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={e => {
                if (e.key === 'Escape') { setDesc(item.description); setEditingDesc(false) }
              }}
              placeholder="Add a description..."
              className="w-full min-h-[60px] resize-y bg-transparent outline-none text-xs text-muted-foreground leading-relaxed placeholder:text-muted-foreground/40"
            />
          ) : (
            <p
              onDoubleClick={() => setEditingDesc(true)}
              className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap cursor-default"
            >
              {item.description || <span className="italic text-muted-foreground/40">No description</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
