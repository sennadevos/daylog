import { useNavigate } from 'react-router'
import { format, addDays, subDays, isToday, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

interface Props {
  workspaceId: number
  date: string
}

export function DayNavigator({ workspaceId, date }: Props) {
  const navigate = useNavigate()
  const [calOpen, setCalOpen] = useState(false)
  const parsed = parseISO(date)

  const goTo = (d: Date) => {
    const formatted = format(d, 'yyyy-MM-dd')
    navigate(`/workspaces/${workspaceId}/days/${formatted}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(subDays(parsed, 1))}>
        <ChevronLeftIcon className="size-4" />
      </Button>

      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger render={<Button variant="ghost" className="text-sm font-medium" />}>
          {format(parsed, 'EEEE, MMMM d, yyyy')}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={d => {
              if (d) { goTo(d); setCalOpen(false) }
            }}
          />
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(addDays(parsed, 1))}>
        <ChevronRightIcon className="size-4" />
      </Button>

      {!isToday(parsed) && (
        <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => goTo(new Date())}>
          Today
        </Button>
      )}
    </div>
  )
}
