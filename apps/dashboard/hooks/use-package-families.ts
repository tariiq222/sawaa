"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { archivePackageFamily, createPackageFamily, fetchPackageFamilies, fetchPackageFamily, updatePackageFamily } from "@/lib/api/package-families"
import type { PackageFamilyInput } from "@sawaa/shared/types"

export function usePackageFamilies() {
  return useQuery({ queryKey: queryKeys.packageFamilies.list(), queryFn: fetchPackageFamilies, staleTime: 5 * 60 * 1000 })
}

export function usePackageFamily(id: string | null) {
  return useQuery({ queryKey: queryKeys.packageFamilies.detail(id ?? ""), queryFn: () => fetchPackageFamily(id!), enabled: Boolean(id), staleTime: 5 * 60 * 1000 })
}

export function usePackageFamilyMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.packageFamilies.all })
  const createMut = useMutation({ mutationFn: (input: PackageFamilyInput) => createPackageFamily(input), onSuccess: invalidate })
  const updateMut = useMutation({ mutationFn: ({ id, input }: { id: string; input: PackageFamilyInput }) => updatePackageFamily(id, input), onSuccess: invalidate })
  const archiveMut = useMutation({ mutationFn: archivePackageFamily, onSuccess: invalidate })
  return { createMut, updateMut, archiveMut }
}
