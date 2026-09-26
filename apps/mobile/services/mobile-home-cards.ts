import api from './api';

export type MobileHomeDestination = 'CLINICS' | 'SERVICES' | 'SPECIALISTS' | 'PACKAGES' | 'PROGRAMS';

export interface PublicMobileHomeCard {
  id: string;
  titleAr: string;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  imageAltAr: string | null;
  imageAltEn: string | null;
  destination: MobileHomeDestination | null;
}

/** The public route intentionally works for guests and authenticated clients. */
export async function getMobileHomeCards(): Promise<PublicMobileHomeCard[]> {
  const response = await api.get<PublicMobileHomeCard[]>('/public/mobile-home-cards');
  return response.data;
}
