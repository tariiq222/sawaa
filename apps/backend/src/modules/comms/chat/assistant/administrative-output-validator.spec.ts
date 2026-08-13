import { AdministrativeOutputValidator } from './administrative-output-validator';

describe('AdministrativeOutputValidator', () => {
  const validator = new AdministrativeOutputValidator();

  it('keeps a bounded administrative answer and approved public metadata', () => {
    expect(validator.validate(
      'يقع المركز في الرياض، ويعمل من 8 صباحًا إلى 4 مساءً.',
      'ar',
      null,
    )).toEqual({
      body: 'يقع المركز في الرياض، ويعمل من 8 صباحًا إلى 4 مساءً.',
      metadata: null,
    });
  });

  it.each([
    'بناءً على الأعراض تشخيصك هو ...',
    'أقيم خطر الحالة بأنه مرتفع',
    'اذهب إلى الطوارئ فورًا',
    'Take this medication twice daily as treatment.',
    'Diagnosis: severe anxiety. Risk assessment: high.',
  ])('replaces malicious or prohibited model output with the fixed neutral handoff response', (output) => {
    const result = validator.validate(output, 'ar', null);

    expect(result).toEqual({
      body: 'عذرًا، يقتصر دوري على المعلومات الإدارية عن المركز وخدماته. يمكنني عرض خيار التحويل إلى الاستقبال.',
      metadata: { action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' },
    });
    expect(result.body).not.toMatch(/تشخيص|خطر|طوارئ|diagnos|risk|emergency/i);
  });

  it('replaces unrelated non-administrative model output', () => {
    const result = validator.validate('Here is a recipe and a political opinion.', 'en', null);

    expect(result.metadata).toEqual({ action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' });
    expect(result.body).not.toContain('recipe');
  });

  it('replaces output beyond the hard length cap', () => {
    const result = validator.validate('a'.repeat(2_001), 'en', null);

    expect(result.metadata).toEqual({ action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' });
    expect(result.body.length).toBeLessThan(2_001);
  });
});
