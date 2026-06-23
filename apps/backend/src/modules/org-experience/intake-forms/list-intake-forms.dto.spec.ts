import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListIntakeFormsDto } from './list-intake-forms.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListIntakeFormsDto, plain);
  return validate(dto);
}

describe('ListIntakeFormsDto', () => {
  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean true', async () => {
    const dto = plainToInstance(ListIntakeFormsDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" to boolean false', async () => {
    const dto = plainToInstance(ListIntakeFormsDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('coerces isActive = 0 to boolean false', async () => {
    const dto = plainToInstance(ListIntakeFormsDto, { isActive: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('rejects a non-boolean isActive (string that is not "true"/"false")', async () => {
    const errors = await validateDto({ isActive: 'maybe' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });
});
