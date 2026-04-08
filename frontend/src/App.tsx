import { BrowserRouter, Routes, Route } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { WorkspacePage } from '@/pages/WorkspacePage'
import { DayPage } from '@/pages/DayPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="workspaces/:id" element={<WorkspacePage />} />
          <Route path="workspaces/:id/days/:date" element={<DayPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
