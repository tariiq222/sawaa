import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchUser: vi.fn(), fetchRoles: vi.fn(), updateUser: vi.fn(), updateUserRole: vi.fn(), createUser: vi.fn(), canDo: vi.fn(), push: vi.fn() }))
vi.mock('@/lib/api/users', () => ({ ...mocks, deleteUser: vi.fn(), activateUser: vi.fn(), deactivateUser: vi.fn(), assignRole: vi.fn(), removeRole: vi.fn() }))
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: () => ({ canDo: mocks.canDo }) }))
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key, locale: 'en' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => '/users/USR-1/edit' }))
vi.mock('@/components/features/breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { UserFormPage } from '@/components/features/users/user-form-page'
import { ApiError } from '@/lib/api'

const user = { id: 'u1', ref: 1, name: 'Test Staff', email: 'staff@example.test', phone: '+966501234567', gender: null, role: 'EMPLOYEE', customRoleId: null }
function renderPage(mode: "edit" | "create" = "edit") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{mode === "edit" ? <UserFormPage mode="edit" userId="USR-1" /> : <UserFormPage mode="create" />}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchUser.mockResolvedValue(user)
  mocks.fetchRoles.mockResolvedValue([{ id: 'r1', name: 'Employee', isSystem: true, systemKey: 'EMPLOYEE', permissions: [] }, { id: 'r2', name: 'Accountant', isSystem: true, systemKey: 'ACCOUNTANT', permissions: [] }])
  mocks.updateUser.mockResolvedValue(user)
  mocks.updateUserRole.mockResolvedValue(user)
  mocks.canDo.mockReturnValue(true)
})
it('clears phone with null and saves only profile fields', async () => {
  const view = renderPage()
  await screen.findByDisplayValue('Test Staff')
  await userEvent.clear(view.container.querySelector('input[type="tel"]')!)
  await userEvent.click(screen.getByRole('button', { name: 'auditStaff.saveProfile' }))
  await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({ phone: null })))
  expect(mocks.updateUserRole).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
})
it('saves role independently without submitting unsaved profile changes', async () => {
  mocks.updateUserRole.mockImplementation(async () => {
    const updated = { ...user, role: 'ACCOUNTANT' }
    mocks.fetchUser.mockResolvedValue(updated)
    return updated
  })
  renderPage()
  const name = await screen.findByDisplayValue('Test Staff')
  fireEvent.change(name, { target: { value: 'Unsaved profile' } })
  const role = await screen.findByLabelText('auditStaff.role')
  fireEvent.change(role, { target: { value: 'ACCOUNTANT' } })
  await userEvent.click(screen.getByRole('button', { name: 'auditStaff.saveRole' }))
  await waitFor(() => expect(mocks.updateUserRole).toHaveBeenCalledWith('u1', { role: 'ACCOUNTANT', customRoleId: null }))
  expect(mocks.updateUser).not.toHaveBeenCalled()
  expect(name).toHaveValue('Unsaved profile')
})
it('does not request roles or show role controls without role permissions', async () => {
  mocks.canDo.mockImplementation((module: string) => module === 'user')
  renderPage()
  await screen.findByDisplayValue('Test Staff')
  expect(mocks.fetchRoles).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('auditStaff.role')).not.toBeInTheDocument()
  expect(screen.queryByText('users.section.role')).not.toBeInTheDocument()
})
it('shows not-found instead of a saveable form for missing users', async () => {
  mocks.fetchUser.mockRejectedValue(new ApiError(404, 'Not Found', {}))
  renderPage()
  expect(await screen.findByText('users.detail.notFound')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'auditStaff.saveProfile' })).not.toBeInTheDocument()
})

it('preserves unsaved profile fields and gives role-specific feedback on role failure', async () => {
  const { toast } = await import('sonner')
  mocks.updateUserRole.mockRejectedValue(new Error('role save failed'))
  renderPage()
  const name = await screen.findByDisplayValue('Test Staff')
  fireEvent.change(name, { target: { value: 'Unsaved profile' } })
  fireEvent.change(await screen.findByLabelText('auditStaff.role'), { target: { value: 'ACCOUNTANT' } })
  await userEvent.click(screen.getByRole('button', { name: 'auditStaff.saveRole' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auditStaff.roleSaveError'))
  expect(mocks.updateUser).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(name).toHaveValue('Unsaved profile')
})
it('renders a retryable server error without allowing save', async () => {
  mocks.fetchUser.mockRejectedValue(new ApiError(500, 'Unavailable', {}))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('error.server')
  expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'auditStaff.saveProfile' })).not.toBeInTheDocument()
})

it('creates in one request without forbidden role lookups for a user manager', async () => {
  mocks.canDo.mockImplementation((module: string) => module === 'user')
  mocks.createUser.mockResolvedValue(user)
  renderPage('create')
  await userEvent.type(screen.getByPlaceholderText('users.create.fullNamePlaceholder'), 'New Staff')
  await userEvent.type(screen.getByPlaceholderText('users.create.emailPlaceholder'), 'new@example.test')
  await userEvent.type(screen.getByPlaceholderText('users.create.passwordPlaceholder'), 'Password1')
  await userEvent.click(screen.getByRole('button', { name: 'users.create.submit' }))
  await waitFor(() => expect(mocks.createUser.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ name: 'New Staff', role: 'RECEPTIONIST' })))
  expect(mocks.createUser).toHaveBeenCalledTimes(1)
  expect(mocks.updateUserRole).not.toHaveBeenCalled()
  expect(mocks.fetchRoles).not.toHaveBeenCalled()
  expect(mocks.fetchUser).not.toHaveBeenCalled()
  expect(mocks.push).toHaveBeenCalledWith('/users')
})
