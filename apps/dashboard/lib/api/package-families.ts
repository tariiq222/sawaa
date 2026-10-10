import { api } from "@/lib/api"
import { packageFamiliesApi } from "@sawaa/api-client"
import type { PackageFamily, PackageFamilyInput } from "@sawaa/shared/types"

export const fetchPackageFamilies = (): Promise<PackageFamily[]> => packageFamiliesApi.listPackageFamilies()
export const fetchPackageFamily = (id: string): Promise<PackageFamily> => packageFamiliesApi.getPackageFamily(id)
export const createPackageFamily = (input: PackageFamilyInput): Promise<PackageFamily> => packageFamiliesApi.createPackageFamily(input)
export const updatePackageFamily = (id: string, input: PackageFamilyInput): Promise<PackageFamily> => packageFamiliesApi.updatePackageFamily(id, input)
export const archivePackageFamily = (id: string): Promise<void> => packageFamiliesApi.archivePackageFamily(id)

export async function uploadPackageFamilyImage(file: File): Promise<string> {
  const data = new FormData()
  data.append("file", file)
  const uploaded = await api.postForm<{ storageKey: string }>("/dashboard/media/upload", data)
  return uploaded.storageKey
}
