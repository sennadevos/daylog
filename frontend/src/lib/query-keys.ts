export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    detail: (id: number) => ['workspaces', id] as const,
  },
  days: {
    list: (wsId: number) => ['workspaces', wsId, 'days'] as const,
    detail: (wsId: number, date: string) => ['workspaces', wsId, 'days', date] as const,
  },
}
