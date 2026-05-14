import api from '../api';

export interface PublicService {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  price: number | string;
  currency: string;
}

export interface PublicCatalogDepartment {
  id: string;
  nameAr: string;
  nameEn: string | null;
  services: PublicService[];
}

interface PublicCatalogDepartmentRow {
  id: string;
  nameAr: string;
  nameEn: string | null;
}

interface PublicCatalogCategory {
  id: string;
  departmentId: string | null;
}

interface PublicCatalogResponse {
  departments: PublicCatalogDepartmentRow[];
  categories: PublicCatalogCategory[];
  services: PublicService[];
}

export const publicCatalogService = {
  async listDepartments(): Promise<PublicCatalogDepartment[]> {
    const response = await api.get<PublicCatalogResponse>('/public/services');
    const categoryDepartmentIds = new Map(
      response.data.categories.map((category) => [
        category.id,
        category.departmentId,
      ]),
    );

    return response.data.departments.map((department) => ({
      ...department,
      services: response.data.services.filter((service) => {
        if (!service.categoryId) return false;
        return categoryDepartmentIds.get(service.categoryId) === department.id;
      }),
    }));
  },
};
