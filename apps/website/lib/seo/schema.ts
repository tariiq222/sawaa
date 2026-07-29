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

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbListSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

/**
 * LocalBusiness is more specific than Organization for an entity that has
 * a physical location and operating hours. Google uses it for the local
 * pack and for opening-hours rich results.
 */
export interface LocalBusinessSchema {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  '@id': string;
  name: string;
  description?: string;
  url: string;
  telephone?: string;
  email?: string;
  image?: string;
  priceRange?: string;
  address: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: Array<{
    '@type': 'OpeningHoursSpecification';
    dayOfWeek: string | string[];
    opens: string;
    closes: string;
  }>;
  sameAs?: string[];
}

export interface FAQPageSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
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

/**
 * Builds a BreadcrumbList from a flat array of {name, url} entries.
 * `url` is the absolute URL of the breadcrumb target — Google
 * recommends absolute URLs for breadcrumb structured data.
 */
export function generateBreadcrumbListSchema(
  items: BreadcrumbItem[],
): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function generateLocalBusinessSchema(
  data: LocalBusinessSchema,
): LocalBusinessSchema {
  return data
}

/**
 * Convenience wrapper that JSON-stringifies + escapes the LocalBusiness
 * schema in one call (so callers don't have to remember to call
 * jsonLdEscape — the same module-private escape the other generators
 * use).
 */
export function generateLocalBusinessJsonLd(data: LocalBusinessSchema): string {
  return jsonLdEscape(JSON.stringify(data))
}

/**
 * FAQPage rich-result schema. Google displays eligible FAQPage schemas
 * directly in search results. Each item MUST be a Question with an
 * acceptedAnswer.Answer. Limit to ~10 questions per page for best
 * results.
 */
export function generateFAQPageSchema(
  faqs: Array<{ question: string; answer: string }>,
): FAQPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
