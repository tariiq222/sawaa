jest.mock('../../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

import api from '../../api';
import { publicCatalogService } from '../catalog';

const mockedApi = api as unknown as { get: jest.Mock };

const catalog = {
  departments: [
    { id: 'dep-clinics', nameAr: 'عيادات', nameEn: 'Clinics' },
    { id: 'dep-programs', nameAr: 'برامج', nameEn: 'Programs' },
  ],
  categories: [
    { id: 'cat-anxiety', departmentId: 'dep-clinics', nameAr: 'القلق', nameEn: 'Anxiety', sortOrder: 1 },
    { id: 'cat-group', departmentId: 'dep-programs', nameAr: 'مجموعات', nameEn: 'Groups', sortOrder: 2 },
    { id: 'cat-floating', departmentId: null, nameAr: 'عام', nameEn: 'General', sortOrder: 3 },
  ],
  services: [
    { id: 's-1', categoryId: 'cat-anxiety', nameAr: 'جلسة', nameEn: 'Session', price: 30000, currency: 'SAR' },
    { id: 's-2', categoryId: 'cat-group', nameAr: 'مجموعة', nameEn: 'Group', price: 10000, currency: 'SAR' },
    { id: 's-3', categoryId: null, nameAr: 'خدمة', nameEn: 'Service', price: 5000, currency: 'SAR' },
    { id: 's-4', categoryId: 'cat-missing', nameAr: 'أخرى', nameEn: 'Other', price: 7000, currency: 'SAR' },
  ],
};

describe('publicCatalogService', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.get.mockResolvedValue({ data: catalog });
  });

  it('reads the public catalog from the single public endpoint', async () => {
    await expect(publicCatalogService.getCatalog()).resolves.toEqual(catalog);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/services', { params: { includeDirectClinics: true } });
  });

  it('groups services under their department and drops uncategorised ones', async () => {
    const departments = await publicCatalogService.listDepartments();

    expect(mockedApi.get).toHaveBeenCalledWith('/public/services', { params: { includeDirectClinics: true } });
    expect(departments.map((d) => d.id)).toEqual(['dep-clinics', 'dep-programs']);
    expect(departments[0].services.map((s) => s.id)).toEqual(['s-1']);
    expect(departments[1].services.map((s) => s.id)).toEqual(['s-2']);
    expect(departments.flatMap((d) => d.services.map((s) => s.id))).not.toContain('s-3');
    expect(departments.flatMap((d) => d.services.map((s) => s.id))).not.toContain('s-4');
  });

  it('keeps the department metadata intact', async () => {
    const departments = await publicCatalogService.listDepartments();
    expect(departments[0]).toMatchObject({ nameAr: 'عيادات', nameEn: 'Clinics' });
  });

  it('keeps internal direct-booking services out of visible department discovery', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {
      ...catalog,
      categories: [...catalog.categories, { id: 'direct', departmentId: 'dep-clinics', bookingMode: 'DIRECT' }],
      services: [...catalog.services, { id: 'internal', categoryId: 'direct', isHidden: true }],
    } });
    const departments = await publicCatalogService.listDepartments();
    expect(departments.flatMap((department) => department.services.map((service) => service.id))).not.toContain('internal');
  });

  it('flattens visible services whose department is missing or hidden', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {
      ...catalog,
      departments: [{ ...catalog.departments[0], isVisible: false }],
    } });
    const departments = await publicCatalogService.listDepartments();
    expect(departments).toMatchObject([{ id: 'catalog-services', nameAr: 'الخدمات', nameEn: 'Services' }]);
    expect(departments[0].services.map((service) => service.id)).toEqual(['s-1', 's-2']);
  });
});
