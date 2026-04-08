import type { Workspace, DayEntry, Item, RolloverResult, RolloverAllResult, CarryResult, ItemState, User } from '@/types/api'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Auth
  register: (username: string, password: string) =>
    request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<User>('/auth/me'),

  // Workspaces
  listWorkspaces: () =>
    request<Workspace[]>('/workspaces'),

  createWorkspace: (name: string) =>
    request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getWorkspace: (id: number) =>
    request<Workspace>(`/workspaces/${id}`),

  updateWorkspace: (id: number, name: string) =>
    request<Workspace>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteWorkspace: (id: number) =>
    request<void>(`/workspaces/${id}`, { method: 'DELETE' }),

  // Days
  listDays: (wsId: number, params?: { limit?: number; before?: string }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.before) search.set('before', params.before)
    const qs = search.toString()
    return request<DayEntry[]>(`/workspaces/${wsId}/days${qs ? `?${qs}` : ''}`)
  },

  getDay: (wsId: number, date: string) =>
    request<DayEntry>(`/workspaces/${wsId}/days/${date}`),

  // Story
  updateStory: (wsId: number, date: string, story: string) =>
    request<{ story: string }>(`/workspaces/${wsId}/days/${date}/story`, {
      method: 'PUT',
      body: JSON.stringify({ story }),
    }),

  // Items
  createItem: (wsId: number, date: string, text: string, opts?: { description?: string; position?: number }) =>
    request<Item>(`/workspaces/${wsId}/days/${date}/items`, {
      method: 'POST',
      body: JSON.stringify({ text, description: opts?.description, position: opts?.position ?? null }),
    }),

  updateItem: (wsId: number, date: string, itemId: number, updates: { text?: string; description?: string; state?: ItemState; position?: number }) =>
    request<Item>(`/workspaces/${wsId}/days/${date}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteItem: (wsId: number, date: string, itemId: number) =>
    request<void>(`/workspaces/${wsId}/days/${date}/items/${itemId}`, {
      method: 'DELETE',
    }),

  reorderItems: (wsId: number, date: string, itemIds: number[]) =>
    request<Item[]>(`/workspaces/${wsId}/days/${date}/items/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ item_ids: itemIds }),
    }),

  moveItem: (wsId: number, date: string, itemId: number, toDate: string) =>
    request<Item>(`/workspaces/${wsId}/days/${date}/items/${itemId}/move`, {
      method: 'POST',
      body: JSON.stringify({ to_date: toDate }),
    }),

  // Rollover
  rolloverWorkspace: (wsId: number, fromDate: string, toDate: string) =>
    request<RolloverResult>(`/workspaces/${wsId}/rollover`, {
      method: 'POST',
      body: JSON.stringify({ from_date: fromDate, to_date: toDate }),
    }),

  rolloverAll: (toDate: string) =>
    request<RolloverAllResult>('/rollover', {
      method: 'POST',
      body: JSON.stringify({ to_date: toDate }),
    }),

  // Carry
  carryYesterday: (wsId: number, toDate: string) =>
    request<CarryResult>(`/workspaces/${wsId}/carry/yesterday`, {
      method: 'POST',
      body: JSON.stringify({ to_date: toDate }),
    }),

  sweepItems: (wsId: number, toDate: string) =>
    request<CarryResult>(`/workspaces/${wsId}/carry/sweep`, {
      method: 'POST',
      body: JSON.stringify({ to_date: toDate }),
    }),
}

export { ApiError }
