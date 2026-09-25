import { describe, expect, it } from 'vitest';
import { isValidSaudiIban, normalizeSaudiIban } from './iban';

describe('Saudi IBAN validation', () => {
  it('accepts compact and formatted valid IBANs', () => {
    expect(isValidSaudiIban('SA0380000000608010167519')).toBe(true);
    expect(isValidSaudiIban('SA03 8000 0000 6080 1016 7519')).toBe(true);
    expect(normalizeSaudiIban('sa03 8000 0000 6080 1016 7519')).toBe('SA0380000000608010167519');
  });

  it('rejects malformed or checksum-invalid values', () => {
    expect(isValidSaudiIban('SA0380000000608010167518')).toBe(false);
    expect(isValidSaudiIban('GB29NWBK60161331926819')).toBe(false);
  });
});
