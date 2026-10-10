import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), postForm: vi.fn(), openGet: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, patch: mocks.patch, postForm: mocks.postForm } }))
vi.mock('@/lib/api/openapi', () => ({ openApi: { get: mocks.openGet } }))
import * as services from '@/lib/api/services'
import { uploadPackageImage } from '@/lib/api/packages'
beforeEach(() => vi.clearAllMocks())
it('fetches category options beyond the first page', async () => {
  mocks.openGet.mockImplementation((_path, { query }) => Promise.resolve({ items: [{ id: `category-${query.page}` }], meta: { total: 101, page: query.page, totalPages: 2, hasNextPage: query.page === 1 } }))
  expect((await services.fetchAllCategories()).items.map((c: {id:string}) => c.id)).toEqual(['category-1', 'category-2'])
})
it('sends branch, department and global sort to service list', async () => {
  mocks.get.mockResolvedValue({ items: [], meta: {} })
  await services.fetchServices({ branchId: 'branch', departmentId: 'dept', sortBy: 'price', sortOrder: 'asc' } as never)
  expect(mocks.get.mock.calls[0][1]).toMatchObject({ branchId: 'branch', departmentId: 'dept', sortBy: 'price', sortOrder: 'asc' })
})
it('persists the upload object key instead of its expiring preview URL', async () => {
  mocks.postForm.mockResolvedValue({ id: 'upload', storageKey: 'images/package.jpg', url: 'https://signed?expires=1' })
  mocks.patch.mockResolvedValue({ id: 'package' })
  await uploadPackageImage('package', new File(['image'], 'image.jpg'))
  expect(mocks.patch).toHaveBeenCalledWith('/dashboard/organization/packages/package', { imageUrl: 'images/package.jpg' })
})
