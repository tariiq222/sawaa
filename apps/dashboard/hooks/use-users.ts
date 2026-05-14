"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  assignRole,
  removeRole,
  fetchRoles,
  createRole,
  deleteRole,
  setRolePermissions,
  fetchPermissions,
} from "@/lib/api/users"
import type { UserListQuery, UserRole } from "@/lib/types/user"

/* ─── Users List ─── */

export function useUsers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<UserRole | undefined>()

  const query: UserListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    role,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: () => fetchUsers(query),
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setRole(undefined)
    setPage(1)
  }, [])

  return {
    users: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    role,
    setRole: (r: UserRole | undefined) => { setRole(r); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── User Mutations ─── */

export function useUserMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all })

  const createMut = useMutation({ mutationFn: createUser, onSuccess: invalidate })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateUser>[1]) =>
      updateUser(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({ mutationFn: deleteUser, onSuccess: invalidate })
  const activateMut = useMutation({ mutationFn: activateUser, onSuccess: invalidate })
  const deactivateMut = useMutation({ mutationFn: deactivateUser, onSuccess: invalidate })

  const assignRoleMut = useMutation({
    mutationFn: ({ userId, ...payload }: { userId: string } & Parameters<typeof assignRole>[1]) =>
      assignRole(userId, payload),
    onSuccess: invalidate,
  })

  const removeRoleMut = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      removeRole(userId, roleId),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut, activateMut, deactivateMut, assignRoleMut, removeRoleMut }
}

/* ─── Roles ─── */

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000, // permissions rarely change
  })
}

export function useRoleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })

  const createMut = useMutation({ mutationFn: createRole, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteRole, onSuccess: invalidate })

  const setPermsMut = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: Parameters<typeof setRolePermissions>[1] }) =>
      setRolePermissions(roleId, permissions),
    onSuccess: invalidate,
  })

  return { createMut, deleteMut, setPermsMut }
}

/* ─── Permissions ─── */

export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.permissions.list(),
    queryFn: fetchPermissions,
    staleTime: 10 * 60 * 1000, // permissions list is static — changes only via migration
  })
}
