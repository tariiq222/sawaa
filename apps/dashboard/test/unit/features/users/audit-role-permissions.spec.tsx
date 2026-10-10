import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ canDo: vi.fn(), fetchRoles: vi.fn(), fetchPermissions: vi.fn(), setRolePermissions: vi.fn(), deleteRole: vi.fn(), fetchUsers: vi.fn() }))
vi.mock('@/lib/api/users', () => ({ ...mocks, createRole: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), updateUserRole: vi.fn(), deleteUser: vi.fn(), activateUser: vi.fn(), deactivateUser: vi.fn(), assignRole: vi.fn(), removeRole: vi.fn() }))
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: () => ({ canDo: mocks.canDo, user: { name: 'Staff', email: 'staff@example.test', gender: 'FEMALE' } }) }))
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key, locale: 'en', dir: 'ltr' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams('tab=roles'), usePathname: () => '/users' }))
vi.mock('@/components/features/breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { RolesTab } from '@/components/features/users/roles-tab'
import { UserListPage } from '@/components/features/users/user-list-page'
import { AccountTab } from '@/components/features/profile/account-tab'
function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchRoles.mockResolvedValue([{ id: 'r1', name: 'Counseling coordinator', isSystem: false, systemKey: null, permissions: [] }])
  mocks.fetchPermissions.mockResolvedValue([{ id: 'p1', subject: 'User', action: 'read' }])
  mocks.fetchUsers.mockResolvedValue({ items: [], meta: { total: 0, page: 1, totalPages: 1, limit: 20 } })
})
it('shows roles as read-only without manage:Role', async () => {
  mocks.canDo.mockImplementation((module: string, action: string) => module === 'role' && action === 'read')
  renderPage(<RolesTab />)
  await screen.findByText('Counseling coordinator')
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()
  expect(mocks.setRolePermissions).not.toHaveBeenCalled()
  expect(mocks.deleteRole).not.toHaveBeenCalled()
})
it('falls back to users for a forbidden roles URL and hides manage actions', async () => {
  mocks.canDo.mockImplementation((module: string, action: string) => module === 'user' && ['read', 'create', 'delete', 'update'].includes(action))
  renderPage(<UserListPage />)
  expect(screen.getByRole('tab', { name: 'users.tabs.users' })).toHaveAttribute('data-state', 'active')
  expect(screen.queryByRole('tab', { name: 'users.tabs.roles' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'users.addUser' })).not.toBeInTheDocument()
  await waitFor(() => expect(mocks.fetchUsers).toHaveBeenCalled())
  expect(mocks.fetchRoles).not.toHaveBeenCalled()
})
it('localizes profile gender instead of showing an enum', () => {
  renderPage(<AccountTab />)
  expect(screen.getByText('users.create.female')).toBeInTheDocument()
  expect(screen.queryByText('FEMALE')).not.toBeInTheDocument()
})
