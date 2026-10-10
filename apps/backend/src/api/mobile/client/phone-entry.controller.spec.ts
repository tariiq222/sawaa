import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompletePhoneEntryDto, RequestPhoneEntryDto, ResendPhoneEntryDto, VerifyPhoneEntryDto } from '../../../modules/identity/mobile-phone-entry/mobile-phone-entry.dto';

jest.mock('../../../modules/identity/mobile-phone-entry/request-phone-entry.handler', () => ({ RequestPhoneEntryHandler: class {} }), { virtual: true });
jest.mock('../../../modules/identity/mobile-phone-entry/resend-phone-entry.handler', () => ({ ResendPhoneEntryHandler: class {} }), { virtual: true });
jest.mock('../../../modules/identity/mobile-phone-entry/verify-phone-entry.handler', () => ({ VerifyPhoneEntryHandler: class {} }), { virtual: true });
jest.mock('../../../modules/identity/mobile-phone-entry/complete-phone-entry.handler', () => ({ CompletePhoneEntryHandler: class {} }), { virtual: true });
import { BadRequestException, HttpException } from '@nestjs/common';
import { MobilePhoneEntryController, PhoneEntryValidationFilter } from './phone-entry.controller';

const challengeId = 'b93b1499-dd38-4f61-97bc-e1bd0053903e';
const completion = { continuationToken: 'x'.repeat(43), firstName: ' Ali ', lastName: ' Saleh ', privacyAccepted: true as const };

describe('phone-entry validation error envelope', () => {
  it.each([
    [503, { code: 'delivery_unavailable', message: 'secret provider detail' }, 'delivery_unavailable'],
    [429, { code: 'send_limited', retryAfterSeconds: 60 }, 'send_limited'],
    [400, { message: 'raw sensitive error' }, 'invalid_details'],
    [503, 'raw sensitive error', 'delivery_unavailable'],
    [429, {}, 'send_limited'],
    [400, { code: 'invalid_details', retryAfterSeconds: -1 }, 'invalid_details'],
  ])('sanitizes HTTP %s errors while retaining safe contract codes', (status, body, code) => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new PhoneEntryValidationFilter().catch(new HttpException(body, status), host);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: status, code, message: code }));
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('sensitive');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
  });
  it('exposes invalid_phone as a top-level code for global DTO validation failures', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new PhoneEntryValidationFilter().catch(new BadRequestException(['invalid_phone']), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_phone', message: 'invalid_phone' }));
  });
});

describe('phone-entry controller', () => {
  const methods = ['requestPhone', 'resendPhone', 'verifyPhone', 'completeAccount'] as const;
  it.each(methods)('delegates %s without changing the DTO', async method => {
    const handlers = methods.map(() => ({ execute: jest.fn().mockResolvedValue({ next: 'unavailable' }) }));
    const controller = new MobilePhoneEntryController(handlers[0] as never, handlers[1] as never, handlers[2] as never, handlers[3] as never);
    const dto = { challengeId, code: '012345', ...completion, phone: '+966512345678' };
    expect(await controller[method](dto)).toEqual({ next: 'unavailable' });
    expect(handlers[methods.indexOf(method)].execute).toHaveBeenCalledWith(dto);
  });
  it.each(methods)('protects %s with no-store and endpoint throttling', method => {
    const handler = MobilePhoneEntryController.prototype[method];
    expect(Reflect.getMetadata('__headers__', handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(200);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(method === 'requestPhone' || method === 'resendPhone' ? 3 : 10);
  });
});

describe('phone-entry HTTP input contract', () => {
  it('attaches the contract-safe validation codes', async () => {
    const invalidPhone = await validate(plainToInstance(RequestPhoneEntryDto, { phone: 'bad' }));
    expect(Object.values(invalidPhone[0].constraints!)).toContain('invalid_phone');
    const invalidCode = await validate(plainToInstance(VerifyPhoneEntryDto, { challengeId, code: 'bad' }));
    expect(Object.values(invalidCode[0].constraints!)).toContain('invalid_or_expired_code');
    const invalidFlow = await validate(plainToInstance(CompletePhoneEntryDto, { ...completion, continuationToken: 'bad' }));
    expect(Object.values(invalidFlow[0].constraints!)).toContain('invalid_or_expired_flow');
    const invalidDetails = await validate(plainToInstance(CompletePhoneEntryDto, { ...completion, privacyAccepted: false }));
    expect(Object.values(invalidDetails[0].constraints!)).toContain('invalid_details');
  });
  it.each(['0512345678', '+966512345678', '966512345678'])('normalizes Saudi mobile %s', async phone => {
    const dto = plainToInstance(RequestPhoneEntryDto, { phone });
    expect(await validate(dto)).toEqual([]);
    expect(dto.phone).toBe('+966512345678');
  });
  it.each(['+14155552671', '+966112345678', '051234567', '', 512345678, null])('rejects unsupported or malformed phone %s', async phone => {
    expect((await validate(plainToInstance(RequestPhoneEntryDto, { phone }))).map(error => error.property)).toContain('phone');
  });
  it.each(['1234', '12345x', '1234567', '١٢٣٤٥٦', 123456])('rejects invalid six-digit code %s', async code => {
    expect((await validate(plainToInstance(VerifyPhoneEntryDto, { challengeId, code }))).map(error => error.property)).toContain('code');
  });
  it('accepts an exact six-digit string code', async () => {
    expect(await validate(plainToInstance(VerifyPhoneEntryDto, { challengeId, code: '012345' }))).toEqual([]);
  });
  it('rejects non-UUID challenges and injected identity fields', async () => {
    const dto = plainToInstance(ResendPhoneEntryDto, { challengeId: 'bad', userId: 'victim', role: 'ADMIN', phone: '+966512345678' });
    expect((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map(error => error.property)).toEqual(expect.arrayContaining(['challengeId', 'userId', 'role', 'phone']));
  });
  it('requires trimmed names and explicit privacy consent without requiring email', async () => {
    const dto = plainToInstance(CompletePhoneEntryDto, completion);
    expect(await validate(dto)).toEqual([]);
    expect(dto.firstName).toBe('Ali');
    expect(dto.lastName).toBe('Saleh');
  });
  it('normalizes optional pending email', async () => {
    const dto = plainToInstance(CompletePhoneEntryDto, { ...completion, email: ' Person@Example.Test ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('person@example.test');
  });
  it.each([
    { continuationToken: 'bad' }, { firstName: ' ' }, { lastName: 'x'.repeat(101) },
    { privacyAccepted: false }, { privacyAccepted: undefined }, { email: 'invalid' },
    { firstName: 123 }, { lastName: 123 }, { email: 123 }, { email: null },
  ])('rejects invalid completion fields %j', async invalid => {
    expect((await validate(plainToInstance(CompletePhoneEntryDto, { ...completion, ...invalid }))).length).toBeGreaterThan(0);
  });
  it('does not allow completion to select phone identity or role', async () => {
    const dto = plainToInstance(CompletePhoneEntryDto, { ...completion, phone: '+966512345678', clientId: 'victim', role: 'ADMIN' });
    expect((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map(error => error.property)).toEqual(expect.arrayContaining(['phone', 'clientId', 'role']));
  });
});
