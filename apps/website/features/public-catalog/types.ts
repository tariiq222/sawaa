export interface PublicDepartment {
  id: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
}

export interface PublicServiceCategory {
  id: string;
  departmentId: string | null;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface PublicService {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  durationMins: number;
  price: string | null;
  currency: string;
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
  isActive: boolean;
}

export interface PublicCatalog {
  departments: PublicDepartment[];
  categories: PublicServiceCategory[];
  services: PublicService[];
}
