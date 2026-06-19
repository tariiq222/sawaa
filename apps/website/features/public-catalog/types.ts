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
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
}

export interface PublicService {
  id: string;
  categoryId: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  durationMins: number;
  price: string;
  currency: string;
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
  showPrice?: boolean;
  showDuration?: boolean;
}

export interface PublicCatalog {
  departments: PublicDepartment[];
  categories: PublicServiceCategory[];
  services: PublicService[];
  /**
   * Org VAT rate as a fraction (0.15 = 15%). Optional for tolerance: older
   * cached responses may lack the field — always read with `?? 0`.
   */
  vatRate?: number;
}
