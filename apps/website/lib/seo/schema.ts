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

/**
 * SECURITY (P1): JSON-LD is injected into the page via
 * dangerouslySetInnerHTML. If any CMS-controlled string in the schema
 * contains "</script>" or one of the U+2028 / U+2029 line separators, the
 * raw JSON.stringify output breaks out of the script block and runs as HTML
 * — stored XSS via a content admin.
 *
 * Escape: "<" -> "<" (defangs "</script>"), plus the two unicode
 * separators (valid inside JSON strings but ILLEGAL inside JS strings).
 * Use char codes so the source file is plain ASCII.
 */
const RE_LT = /</g;
const RE_U2028 = new RegExp(String.fromCharCode(0x2028), 'g');
const RE_U2029 = new RegExp(String.fromCharCode(0x2029), 'g');
function jsonLdEscape(json: string): string {
  return json
    .replace(RE_LT, '\\u003C')
    .replace(RE_U2028, '\\u2028')
    .replace(RE_U2029, '\\u2029');
}

export function generateMedicalBusinessSchema(data: MedicalBusinessSchema): string {
  return jsonLdEscape(JSON.stringify(data));
}

export function generateBookActionSchema(data: BookActionSchema): string {
  return jsonLdEscape(JSON.stringify(data));
}

export function generateOrganizationSchema(data: OrganizationSchema): string {
  return jsonLdEscape(JSON.stringify(data));
}
