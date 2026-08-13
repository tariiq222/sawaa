import { AdministrativeOutputValidator } from './administrative-output-validator';
import { AdministrativeResponseRenderer } from './administrative-response-renderer';
import { AdministrativeScopeGate } from './administrative-scope-gate';

describe('AdministrativeOutputValidator', () => {
  const validator = new AdministrativeOutputValidator();
  const renderer = new AdministrativeResponseRenderer(new AdministrativeScopeGate());

  it('accepts a bounded response carrying the deterministic renderer contract', () => {
    const rendered = renderer.render([{
      name: 'listServices',
      result: { ok: true, data: [{ nameEn: 'Family guidance' }] },
    }], 'en');

    expect(validator.validate(rendered, 'en')).toEqual(rendered);
  });

  it('rejects free model content even if it claims an administrative topic', () => {
    const result = validator.validate({
      source: 'MODEL',
      body: 'Center services are available. Take two pills daily.',
      metadata: null,
    }, 'en');

    expect(result.body).toBe(
      'Sorry, my role is limited to administrative information about the center and its services. I can offer the option to contact reception.',
    );
    expect(result.metadata).toEqual({ action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' });
  });

  it('rejects a forged renderer response beyond the hard output cap', () => {
    const result = validator.validate({
      source: 'DETERMINISTIC_RENDERER',
      body: 'a'.repeat(2_001),
      metadata: null,
    }, 'en');

    expect(result.body.length).toBeLessThan(2_001);
    expect(result.metadata).toEqual({ action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' });
  });

  it('rejects metadata outside the public handoff contract', () => {
    const result = validator.validate({
      source: 'DETERMINISTIC_RENDERER',
      body: 'Available services:\n- Family guidance',
      metadata: { toolInternals: 'secret' },
    }, 'en');

    expect(result.metadata).toEqual({ action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' });
  });
});
