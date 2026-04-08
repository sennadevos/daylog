import { useState, useEffect, useRef, useCallback } from 'react'
import { useUpdateStory } from '@/hooks/use-day-entry'

interface Props {
  workspaceId: number
  date: string
  initialStory: string
}

export function StoryEditor({ workspaceId, date, initialStory }: Props) {
  const [story, setStory] = useState(initialStory)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const mutation = useUpdateStory(workspaceId, date)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setStory(initialStory)
    setSaveStatus('idle')
  }, [initialStory, date])

  const debouncedSave = useCallback((value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setSaveStatus('saving')
      mutation.mutate(value, {
        onSuccess: () => setSaveStatus('saved'),
        onError: () => setSaveStatus('idle'),
      })
    }, 500)
  }, [mutation])

  const handleChange = (value: string) => {
    setStory(value)
    debouncedSave(value)
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h3>
        {saveStatus !== 'idle' && (
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}
      </div>
      <textarea
        value={story}
        onChange={e => handleChange(e.target.value)}
        placeholder="Write notes for the day..."
        className="w-full min-h-[120px] resize-y bg-transparent outline-none text-sm leading-relaxed placeholder:text-muted-foreground/40"
      />
    </div>
  )
}
