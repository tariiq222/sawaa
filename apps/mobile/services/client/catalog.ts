import api from '../api';

export interface PublicService {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  price: number | string;
  currency: string;
  imageUrl: string | null;
  isHidden?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
}

export interface PublicCatalogDepartment {
  id: string;
  nameAr: string;
  nameEn: string | null;
  services: PublicService[];
}

export interface PublicCatalogDepartmentRow {
  id: string;
  nameAr: string;
  nameEn: string | null;
  isVisible?: boolean;
  isActive?: boolean;
}

export interface PublicCatalogCategory {
  id: string;
  departmentId: string | null;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  imageUrl?: string | null;
  kind?: 'CLINIC' | 'SERVICE_GROUP';
  bookingMode?: 'DIRECT' | 'SERVICES';
  isActive?: boolean;
  archivedAt?: string | null;
}

export interface PublicCatalogRaw {
  departments: PublicCatalogDepartmentRow[];
  categories: PublicCatalogCategory[];
  services: PublicService[];
}

export function mapCatalogDepartments(raw: PublicCatalogRaw): PublicCatalogDepartment[] {
  const categoryDepartmentIds = new Map(
    raw.categories.filter((category) => category.isActive !== false && category.archivedAt == null && category.bookingMode !== 'DIRECT')
      .map((category) => [category.id, category.departmentId]),
  );

  const visible = raw.services.filter((service) => service.categoryId && categoryDepartmentIds.has(service.categoryId) && service.isHidden !== true && service.isActive !== false && service.archivedAt == null);
  const departments = raw.departments.filter((department) => department.isVisible !== false && department.isActive !== false).map((department) => ({
    ...department,
    services: visible.filter((service) => {
      if (!service.categoryId) return false;
      return categoryDepartmentIds.get(service.categoryId) === department.id;
    }),
  }));
  const represented = new Set(departments.flatMap((department) => department.services.map((service) => service.id)));
  const remaining = visible.filter((service) => !represented.has(service.id));
  return remaining.length ? [...departments, { id: 'catalog-services', nameAr: 'الخدمات', nameEn: 'Services', services: remaining }] : departments;
}

export const publicCatalogService = {
  async listDepartments(): Promise<PublicCatalogDepartment[]> {
    const response = await api.get<PublicCatalogRaw>('/public/services', { params: { includeDirectClinics: true } });
    return mapCatalogDepartments(response.data);
  },

  async getCatalog(): Promise<PublicCatalogRaw> {
    const response = await api.get<PublicCatalogRaw>('/public/services', { params: { includeDirectClinics: true } });
    return response.data;
  },
};
