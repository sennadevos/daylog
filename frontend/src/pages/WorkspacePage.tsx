import { useParams, Navigate } from 'react-router'
import { format } from 'date-fns'
import { DayView } from '@/components/day/DayView'

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const today = format(new Date(), 'yyyy-MM-dd')

  if (!id) return <Navigate to="/" replace />

  return <DayView workspaceId={Number(id)} date={today} />
}
