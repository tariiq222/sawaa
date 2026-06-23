import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetClientActiveDto } from './set-client-active.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SetClientActiveDto, plain);
  return validate(dto);
}

describe('SetClientActiveDto', () => {
  it('accepts a minimal valid payload (only required field)', async () => {
    const errors = await validateDto({ isActive: true });
    expect(errors).toHaveLength(0);
  });

  it('accepts isActive = false with a reason', async () => {
    const errors = await validateDto({ isActive: false, reason: 'Requested by client' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing isActive', async () => {
    const errors = await validateDto({ reason: 'oops' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isActive (string)', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isActive (number)', async () => {
    const errors = await validateDto({ isActive: 1 });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a reason longer than 500 chars', async () => {
    const errors = await validateDto({ isActive: true, reason: 'A'.repeat(501) });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts a reason at the boundary (exactly 500 chars)', async () => {
    const errors = await validateDto({ isActive: true, reason: 'A'.repeat(500) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ isActive: true, reason: 42 });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
