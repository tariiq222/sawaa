import api from '../api';

export interface PublicService {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  price: number | string;
  currency: string;
  imageUrl: string | null;
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
}

export interface PublicCatalogCategory {
  id: string;
  departmentId: string | null;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
}

export interface PublicCatalogRaw {
  departments: PublicCatalogDepartmentRow[];
  categories: PublicCatalogCategory[];
  services: PublicService[];
}

export function mapCatalogDepartments(raw: PublicCatalogRaw): PublicCatalogDepartment[] {
  const categoryDepartmentIds = new Map(
    raw.categories.map((category) => [category.id, category.departmentId]),
  );

  return raw.departments.map((department) => ({
    ...department,
    services: raw.services.filter((service) => {
      if (!service.categoryId) return false;
      return categoryDepartmentIds.get(service.categoryId) === department.id;
    }),
  }));
}

export const publicCatalogService = {
  async listDepartments(): Promise<PublicCatalogDepartment[]> {
    const response = await api.get<PublicCatalogRaw>('/public/services');
    return mapCatalogDepartments(response.data);
  },

  async getCatalog(): Promise<PublicCatalogRaw> {
    const response = await api.get<PublicCatalogRaw>('/public/services');
    return response.data;
  },
};
