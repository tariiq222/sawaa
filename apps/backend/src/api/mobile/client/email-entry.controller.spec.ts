import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestEmailEntryDto, RequestEmailEntryPhoneDto, VerifyEmailEntryDto } from '../../../modules/identity/mobile-email-entry/mobile-email-entry.dto';

describe('email-entry HTTP input contract', () => {
  it('normalizes email with the shared identifier policy', async () => {
    const dto = plainToInstance(RequestEmailEntryDto, { email: ' Person@Example.Test ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('person@example.test');
  });
  it.each(['1234', '12345x', '1234567'])('rejects invalid code %s', async code => {
    const dto = plainToInstance(VerifyEmailEntryDto, { challengeId: 'b93b1499-dd38-4f61-97bc-e1bd0053903e', code });
    expect((await validate(dto)).some(error => error.property === 'code')).toBe(true);
  });
  it('rejects direct identity/role input and non-UUID challenge ids', async () => {
    const dto = plainToInstance(VerifyEmailEntryDto, { challengeId: 'not-uuid', code: '123456', userId: 'victim', role: 'ADMIN' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['challengeId', 'userId', 'role']));
  });
  it('normalizes valid local phones and rejects false consent', async () => {
    const dto = plainToInstance(RequestEmailEntryPhoneDto, { continuationToken: 'x'.repeat(43), phone: '0512345678', privacyAccepted: false });
    expect(dto.phone).toBe('+966512345678');
    expect((await validate(dto)).map(error => error.property)).toContain('privacyAccepted');
  });
});
