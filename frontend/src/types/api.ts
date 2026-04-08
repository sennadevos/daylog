export type ItemState = 'unchecked' | 'checked' | 'revoked'

export interface User {
  id: number
  username: string
  created_at: string
}

export interface Workspace {
  id: number
  name: string
  created_at: string
}

export interface Item {
  id: number
  text: string
  description: string
  position: number
  state: ItemState
  origin_id: string
}

export interface CarryResult {
  carried_items: number
}

export interface DayEntry {
  id: number
  date: string
  story: string
  items: Item[]
}

export interface RolloverResult {
  rolled_items: number
}

export interface RolloverAllResult {
  workspaces_processed: number
  total_items_rolled: number
}
