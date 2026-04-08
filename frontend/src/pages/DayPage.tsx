import { useParams, Navigate } from 'react-router'
import { DayView } from '@/components/day/DayView'

export function DayPage() {
  const { id, date } = useParams<{ id: string; date: string }>()

  if (!id || !date) return <Navigate to="/" replace />

  return <DayView workspaceId={Number(id)} date={date} />
}
