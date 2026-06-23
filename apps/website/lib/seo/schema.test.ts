import { describe, it, expect } from 'vitest';
import {
  generateMedicalBusinessSchema,
  generateBookActionSchema,
  generateOrganizationSchema,
} from './schema';

describe('JSON-LD schema generators (lib/seo/schema.ts)', () => {
  describe('generateMedicalBusinessSchema', () => {
    it('JSON-stringifies a fully populated MedicalBusiness object (round-trips)', () => {
      const out = generateMedicalBusinessSchema({
        '@context': 'https://schema.org',
        '@type': 'MedicalBusiness',
        name: 'Sawa Center',
        description: 'Family counseling',
        url: 'https://sawaa.sa',
        telephone: '+966-11-000-0000',
        email: 'hello@sawaa.sa',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 King Fahd Rd',
          addressLocality: 'Riyadh',
          addressRegion: 'Riyadh',
          postalCode: '12345',
          addressCountry: 'SA',
        },
        openingHoursSpecification: [
          { dayOfWeek: 'Sunday', opens: '09:00', closes: '21:00' },
        ],
        medicalSpecialty: 'Psychiatry',
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('MedicalBusiness');
      expect(parsed.name).toBe('Sawa Center');
      expect(parsed.description).toBe('Family counseling');
      expect(parsed.url).toBe('https://sawaa.sa');
      expect(parsed.telephone).toBe('+966-11-000-0000');
      expect(parsed.email).toBe('hello@sawaa.sa');
      expect(parsed.medicalSpecialty).toBe('Psychiatry');
      const address = parsed.address as Record<string, unknown>;
      expect(address['@type']).toBe('PostalAddress');
      expect(address.addressLocality).toBe('Riyadh');
      expect(address.addressCountry).toBe('SA');
      const hours = parsed.openingHoursSpecification as Array<Record<string, unknown>>;
      expect(hours[0].dayOfWeek).toBe('Sunday');
      expect(hours[0].opens).toBe('09:00');
    });

    it('omits optional fields when they are not provided (JSON.stringify drops undefined)', () => {
      const out = generateMedicalBusinessSchema({
        '@context': 'https://schema.org',
        '@type': 'MedicalBusiness',
        name: 'Sawa Center',
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;
      expect(parsed.name).toBe('Sawa Center');
      expect(parsed.description).toBeUndefined();
      expect(parsed.url).toBeUndefined();
      expect(parsed.address).toBeUndefined();
      expect(parsed.openingHoursSpecification).toBeUndefined();
    });
  });

  describe('generateBookActionSchema', () => {
    it('encodes the agent → object → result structure with the right @type values', () => {
      const out = generateBookActionSchema({
        '@context': 'https://schema.org',
        '@type': 'BookAction',
        agent: { '@type': 'Person', name: 'Sara' },
        object: {
          '@type': 'Service',
          name: 'Consultation',
          provider: { '@type': 'MedicalBusiness', name: 'Sawa Center' },
        },
        result: { '@type': 'Reservation' },
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('BookAction');
      const agent = parsed.agent as Record<string, unknown>;
      expect(agent['@type']).toBe('Person');
      expect(agent.name).toBe('Sara');
      const object = parsed.object as Record<string, unknown>;
      expect(object['@type']).toBe('Service');
      expect(object.name).toBe('Consultation');
      const provider = object.provider as Record<string, unknown>;
      expect(provider['@type']).toBe('MedicalBusiness');
      const result = parsed.result as Record<string, unknown>;
      expect(result['@type']).toBe('Reservation');
    });
  });

  describe('generateOrganizationSchema', () => {
    it('produces a minimal Organization node with @context, @type, name', () => {
      const out = generateOrganizationSchema({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sawa Center',
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('Organization');
      expect(parsed.name).toBe('Sawa Center');
    });

    it('passes through optional description, url, logo', () => {
      const out = generateOrganizationSchema({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sawa Center',
        description: 'Family counseling',
        url: 'https://sawaa.sa',
        logo: 'https://sawaa.sa/logo.png',
      });
      const parsed = JSON.parse(out) as Record<string, unknown>;
      expect(parsed.description).toBe('Family counseling');
      expect(parsed.url).toBe('https://sawaa.sa');
      expect(parsed.logo).toBe('https://sawaa.sa/logo.png');
    });
  });

  describe('JSON-LD XSS escape (security-critical — schema is injected via dangerouslySetInnerHTML)', () => {
    it('escapes "<" so "</script>" never appears literally in the emitted JSON-LD', () => {
      const out = generateOrganizationSchema({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sawa</script><script>alert(1)</script>',
        description: 'desc',
      });
      // The literal byte sequence "</script>" must not appear — a stored XSS
      // could break out of the script tag otherwise.
      expect(out).not.toContain('</script>');
      // The "<" inside the value is escaped to its unicode form, while "/" and
      // ">" are left alone (the regex only matches "<"). The point is that
      // the surrounding HTML parser sees `<\u003C/script>` and never closes
      // the script tag.
      expect(out).toContain('\\u003C/script>');
      // Round-trip: parsing the escaped JSON yields the original string.
      expect(JSON.parse(out).name).toBe('Sawa</script><script>alert(1)</script>');
    });

    it('escapes U+2028 and U+2029 line separators (valid in JSON strings, illegal in JS strings)', () => {
      // U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR) are valid
      // inside JSON string literals but ILLEGAL inside JS string literals.
      // If they survive the JSON.stringify pass, the browser script parser
      // throws on the embedded literal and the JSON-LD is silently dropped —
      // and in some eval-contexts they are valid tokens, opening an injection
      // vector. The helper escapes them both.
      const u2028 = String.fromCharCode(0x2028);
      const u2029 = String.fromCharCode(0x2029);
      const out = generateOrganizationSchema({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: `evil${u2028}Sawa${u2029}evil`,
        description: 'd',
      });
      // The raw separators must not appear in the emitted JSON-LD string.
      expect(out).not.toContain(u2028);
      expect(out).not.toContain(u2029);
      expect(out).toContain('\\u2028');
      expect(out).toContain('\\u2029');
    });

    it('escapes a "<" inside an address streetAddress too', () => {
      const out = generateMedicalBusinessSchema({
        '@context': 'https://schema.org',
        '@type': 'MedicalBusiness',
        name: 'Sawa',
        address: { '@type': 'PostalAddress', streetAddress: 'A < B </script>' },
      });
      expect(out).not.toContain('</script>');
      expect(JSON.parse(out).address.streetAddress).toBe('A < B </script>');
    });
  });
});
