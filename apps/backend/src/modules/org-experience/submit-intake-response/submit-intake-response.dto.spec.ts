import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitIntakeResponseDto } from './submit-intake-response.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SubmitIntakeResponseDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  formId: '550e8400-e29b-41d4-a716-446655440000',
  answers: {
    '11111111-1111-1111-1111-111111111111': 'نعم',
    '22222222-2222-2222-2222-222222222222': ['خيار أ', 'خيار ب'],
  },
};

describe('SubmitIntakeResponseDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty answers object', async () => {
    const errors = await validateDto({ formId: validPayload.formId, answers: {} });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing formId', async () => {
    const { formId: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'formId')).toBe(true);
  });

  it('rejects a non-UUID formId', async () => {
    const errors = await validateDto({ ...validPayload, formId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'formId')).toBe(true);
  });

  it('rejects a missing answers', async () => {
    const { answers: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'answers')).toBe(true);
  });

  it('rejects a non-object answers (string)', async () => {
    const errors = await validateDto({ ...validPayload, answers: 'not-an-object' });
    expect(errors.some((e) => e.property === 'answers')).toBe(true);
  });

  it('rejects a non-object answers (array)', async () => {
    const errors = await validateDto({ ...validPayload, answers: ['a', 'b'] });
    expect(errors.some((e) => e.property === 'answers')).toBe(true);
  });

  it('rejects a null answers', async () => {
    const errors = await validateDto({ ...validPayload, answers: null });
    expect(errors.some((e) => e.property === 'answers')).toBe(true);
  });
});
