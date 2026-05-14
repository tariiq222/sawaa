export interface MedicalBusinessSchema {
  '@context': 'https://schema.org';
  '@type': 'MedicalBusiness';
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  email?: string;
  address?: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  openingHoursSpecification?: Array<{
    '@type': 'OpeningHoursSpecification';
    dayOfWeek: string | string[];
    opens: string;
    closes: string;
  }>;
  medicalSpecialty?: string;
}

export interface BookActionSchema {
  '@context': 'https://schema.org';
  '@type': 'BookAction';
  agent: {
    '@type': 'Person' | 'Organization';
    name: string;
  };
  object: {
    '@type': 'Service';
    name: string;
    provider: {
      '@type': 'MedicalBusiness';
      name: string;
    };
  };
  result: {
    '@type': 'Reservation';
  };
}

export interface OrganizationSchema {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  description?: string;
  url?: string;
  logo?: string;
}

export function generateMedicalBusinessSchema(data: MedicalBusinessSchema): string {
  return JSON.stringify(data);
}

export function generateBookActionSchema(data: BookActionSchema): string {
  return JSON.stringify(data);
}

export function generateOrganizationSchema(data: OrganizationSchema): string {
  return JSON.stringify(data);
}