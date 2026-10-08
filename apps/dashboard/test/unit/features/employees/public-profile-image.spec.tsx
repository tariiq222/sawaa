import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ update: vi.fn(), upload: vi.fn(), error: vi.fn() }))
vi.mock('@/hooks/use-employee-mutations', () => ({ useEmployeeMutations: () => ({
  updateMutation: { mutateAsync: mocks.update, isPending: false },
  uploadPublicImageMutation: { mutateAsync: mocks.upload, isPending: false },
}) }))
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))
import { PublicProfileTab } from '@/components/features/employees/public-profile-tab'
const employee = { id: 'employee-1', slug: 'khalid', publicBioAr: 'نبذة', publicBioEn: '',
  publicImageUrl: 'https://files.sawaa.sa/old.jpg?signed=old', user: { firstName: 'خالد', lastName: 'المحمد' },
} as never
function selectImage(container: HTMLElement) {
  const file = new File(['image'], 'photo.png', { type: 'image/png' })
  const input = container.querySelector('input[type=file]')
  expect(input).not.toBeNull()
  fireEvent.change(input!, { target: { files: [file] } })
  return file
}
describe('public employee profile image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    mocks.update.mockResolvedValue({})
    mocks.upload.mockResolvedValue({ url: 'https://files.sawaa.sa/new.jpg?signed=fresh' })
  })
  it('uploads a selected public image only on Save and never PATCHes the browser preview', async () => {
    const { container } = render(<PublicProfileTab employee={employee} />)
    const file = selectImage(container)
    expect(mocks.upload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'employees.public.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.upload).toHaveBeenCalledWith({ id: 'employee-1', file })
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('publicImageUrl')
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://files.sawaa.sa/new.jpg?signed=fresh')
  })
  it('preserves the stored image when only biography fields are saved', async () => {
    render(<PublicProfileTab employee={employee} />)
    fireEvent.click(screen.getByRole('button', { name: 'employees.public.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('publicImageUrl')
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('clears the public image explicitly without uploading', async () => {
    render(<PublicProfileTab employee={employee} />)
    fireEvent.click(screen.getByRole('button', { name: 'employees.public.removeImage' }))
    fireEvent.click(screen.getByRole('button', { name: 'employees.public.save' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ publicImageUrl: null })))
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('surfaces failed uploads and leaves text save pending for a retry', async () => {
    mocks.upload.mockRejectedValue(new Error('Upload failed'))
    const { container } = render(<PublicProfileTab employee={employee} />)
    selectImage(container)
    fireEvent.click(screen.getByRole('button', { name: 'employees.public.save' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Upload failed'))
    expect(mocks.update).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'employees.public.save' })).toBeEnabled()
  })
})
