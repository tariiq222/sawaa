import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { OtpSessionService } from '../otp/otp-session.service';
import { ClientTokenService } from '../shared/client-token.service';
import { PasswordService } from '../shared/password.service';
import { RegisterHandler } from './register.handler';
import { PRIVACY_POLICY_VERSION } from './consent.constants';

function mockRequest(authHeader?: string): Partial<Request> {
  return {
    headers: { authorization: authHeader } as any,
  } as Partial<Request>;
}

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let prisma: any;
  let otpSession: any;
  let clientTokens: any;
  let passwords: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: PrismaService, useValue: {
          client: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
        } },
        { provide: OtpSessionService, useValue: {
          verifySession: jest.fn(),
        } },
        { provide: ClientTokenService, useValue: {
          issueTokenPair: jest.fn(),
        } },
        { provide: PasswordService, useValue: {
          hash: jest.fn(),
        } },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
    prisma = module.get(PrismaService);
    otpSession = module.get(OtpSessionService);
    clientTokens = module.get(ClientTokenService);
    passwords = module.get(PasswordService);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when missing auth header', async () => {
    await expect(handler.execute({ name: 'x', password: 'p' } as any, mockRequest() as Request))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should throw when auth header not Bearer', async () => {
    await expect(handler.execute({ name: 'x', password: 'p' } as any, mockRequest('Basic xyz') as Request))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should throw when session payload is null', async () => {
    otpSession.verifySession.mockReturnValue(null);
    await expect(handler.execute({ name: 'x', password: 'p' } as any, mockRequest('Bearer tok') as Request))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should throw when purpose mismatch', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.DASHBOARD_LOGIN, channel: OtpChannel.EMAIL, identifier: 'a@b.com' });
    await expect(handler.execute({ name: 'x', password: 'p' } as any, mockRequest('Bearer tok') as Request))
      .rejects.toThrow(UnauthorizedException);
  });

  it('should create new client for email channel', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.EMAIL, identifier: 'a@b.com' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue({ id: 'c1', tokenVersion: 0 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute({ name: 'John', password: 'p' } as any, mockRequest('Bearer tok') as Request);
    expect(result.clientId).toBe('c1');
    // P1-7: issued token must carry the row's live tokenVersion.
    expect(clientTokens.issueTokenPair).toHaveBeenCalledWith({
      id: 'c1',
      email: 'a@b.com',
      tokenVersion: 0,
    });
    expect(result.accessToken).toBe('at');
    expect(prisma.client.create).toHaveBeenCalled();
    const createData = prisma.client.create.mock.calls[0][0].data;
    expect(createData.email).toBe('a@b.com');
    expect(createData.phone).toBeNull();
    expect(createData.name).toBe('John');
    // PDPL: consent recorded on registration
    expect(createData.consentedAt).toBeInstanceOf(Date);
    expect(createData.consentVersion).toBe(PRIVACY_POLICY_VERSION);
  });

  it('should create new client for phone channel', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.SMS, identifier: '+966501234567' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue({ id: 'c2', tokenVersion: 0 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute({ password: 'p' } as any, mockRequest('Bearer tok') as Request);
    expect(result.clientId).toBe('c2');
    const createData = prisma.client.create.mock.calls[0][0].data;
    expect(createData.phone).toBe('+966501234567');
    expect(createData.email).toBeNull();
    expect(createData.name).toBe('+966501234567');
  });

  it('should throw when existing client already has password', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.EMAIL, identifier: 'a@b.com' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: 'existing' });

    await expect(handler.execute({ name: 'x', password: 'p' } as any, mockRequest('Bearer tok') as Request))
      .rejects.toThrow(BadRequestException);
  });

  it('should update existing guest client for email channel', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.EMAIL, identifier: 'a@b.com' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: null, name: 'Old', emailVerified: null, phoneVerified: null });
    // P1-7: a merged guest row may already carry a bumped tokenVersion.
    prisma.client.update.mockResolvedValue({ id: 'c1', tokenVersion: 2 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute({ name: 'New', password: 'p' } as any, mockRequest('Bearer tok') as Request);
    expect(result.clientId).toBe('c1');
    expect(clientTokens.issueTokenPair).toHaveBeenCalledWith({
      id: 'c1',
      email: 'a@b.com',
      tokenVersion: 2,
    });
    expect(prisma.client.update).toHaveBeenCalled();
    const updateData = prisma.client.update.mock.calls[0][0].data;
    expect(updateData.emailVerified).toBeInstanceOf(Date);
    expect(updateData.phoneVerified).toBeNull();
    expect(updateData.name).toBe('New');
    // PDPL: consent recorded on guest-to-account merge
    expect(updateData.consentedAt).toBeInstanceOf(Date);
    expect(updateData.consentVersion).toBe(PRIVACY_POLICY_VERSION);
  });

  it('should update existing guest client for phone channel', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.SMS, identifier: '+966501234567' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: null, name: 'Old', emailVerified: new Date(), phoneVerified: null });
    prisma.client.update.mockResolvedValue({ id: 'c1', tokenVersion: 0 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute({ password: 'p' } as any, mockRequest('Bearer tok') as Request);
    const updateData = prisma.client.update.mock.calls[0][0].data;
    expect(updateData.phoneVerified).toBeInstanceOf(Date);
    expect(updateData.emailVerified).toBeInstanceOf(Date);
  });

  it('should keep existing name when dto name not provided', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN, channel: OtpChannel.EMAIL, identifier: 'a@b.com' });
    passwords.hash.mockResolvedValue('h');
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: null, name: 'OldName', emailVerified: null, phoneVerified: null });
    prisma.client.update.mockResolvedValue({ id: 'c1', tokenVersion: 0 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    await handler.execute({ password: 'p' } as any, mockRequest('Bearer tok') as Request);
    expect(prisma.client.update.mock.calls[0][0].data.name).toBe('OldName');
  });
});
