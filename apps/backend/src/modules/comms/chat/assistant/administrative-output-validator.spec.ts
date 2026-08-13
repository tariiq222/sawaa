import { AdministrativeOutputValidator } from './administrative-output-validator';
import { AdministrativeResponseRenderer } from './administrative-response-renderer';

describe('AdministrativeOutputValidator', () => {
  const validator = new AdministrativeOutputValidator();
  const renderer = new AdministrativeResponseRenderer();

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

  it('accepts the exact public operation-card contract and rejects hidden identity fields', () => {
    const operation = {
      id: 'operation-1', type: 'CREATE_BOOKING', status: 'AWAITING_CONFIRMATION',
      version: 0, requiredConfirmations: 1, confirmationCount: 0,
      expiresAt: '2026-08-13T09:15:00.000Z', bookingId: null, errorCode: null,
      summary: { action: 'CREATE_BOOKING', serviceName: 'جلسة إرشاد أسري' },
    };
    const valid = {
      source: 'DETERMINISTIC_RENDERER',
      body: 'راجع تفاصيل الحجز، ثم استخدم زر التأكيد أو الرفض.',
      metadata: { action: 'CHAT_OPERATION', operation },
    };
    expect(validator.validate(valid, 'ar')).toEqual(valid);

    const forged = {
      ...valid,
      metadata: {
        action: 'CHAT_OPERATION',
        operation: { ...operation, summary: { ...operation.summary, clientId: 'secret-client' } },
      },
    };
    expect(validator.validate(forged, 'ar').metadata).toEqual({
      action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE',
    });
  });
});
