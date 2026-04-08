import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useAuth() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => api.me().catch((e) => {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })

  const register = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.register(username, password),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.auth.me, user)
    },
  })

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear()
    },
  })

  return { user: user ?? null, isLoading, login, register, logout }
}
