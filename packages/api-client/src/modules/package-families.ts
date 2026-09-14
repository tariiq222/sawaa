import { apiRequest } from '../client'
import type {
  PackageFamily, PackageFamilyInput, ClientPackagePurchase,
  InitPackagePurchaseInput, InitPackagePurchaseResponse, BookMyPackageCreditInput,
} from '@sawaa/shared/types'

const segment = encodeURIComponent
const dashboardPath = '/dashboard/organization/package-families'
export const listPackageFamilies = () => apiRequest<PackageFamily[]>(dashboardPath)
export const getPackageFamily = (id: string) => apiRequest<PackageFamily>(`${dashboardPath}/${segment(id)}`)
export const createPackageFamily = (input: PackageFamilyInput) => apiRequest<PackageFamily>(dashboardPath, { method: 'POST', body: JSON.stringify(input) })
export const updatePackageFamily = (id: string, input: PackageFamilyInput) => apiRequest<PackageFamily>(`${dashboardPath}/${segment(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
export const archivePackageFamily = (id: string) => apiRequest<void>(`${dashboardPath}/${segment(id)}`, { method: 'DELETE' })
export const listPublicPackageFamilies = () => apiRequest<PackageFamily[]>('/public/package-families')
export const getPublicPackageFamily = (id: string) => apiRequest<PackageFamily>(`/public/package-families/${segment(id)}`)
export const initPackagePurchase = (input: InitPackagePurchaseInput) => apiRequest<InitPackagePurchaseResponse>('/public/payments/package-purchases/init', { method: 'POST', credentials: 'include', body: JSON.stringify(input) })
export const listMyPackagePurchases = () => apiRequest<ClientPackagePurchase[]>('/public/me/packages/purchases', { credentials: 'include' })
export const getMyPackagePurchase = (id: string) => apiRequest<ClientPackagePurchase>(`/public/me/packages/purchases/${segment(id)}`, { credentials: 'include' })
export const bookMyPackageCredit = (input: BookMyPackageCreditInput) => apiRequest<{ id: string; status: string; packageCreditId: string }>('/public/me/packages/book', { method: 'POST', credentials: 'include', body: JSON.stringify(input) })
