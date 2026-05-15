import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ResendSenderService } from './resend-sender.service';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

describe('ResendSenderService', () => {
  let service: ResendSenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendSenderService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-key') } },
      ],
    }).compile();

    service = module.get<ResendSenderService>(ResendSenderService);
    service.onModuleInit();
  });

  it('should be available', () => {
    expect(service.isAvailable()).toBe(true);
  });

  it('should send email', async () => {
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg-1' } });
    (service as any).client = { emails: { send: mockSend } };
    const result = await service.send({ to: 'test@example.com', from: 'noreply@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result.id).toBe('msg-1');
  });

  it('should throw on resend error', async () => {
    const mockSend = jest.fn().mockResolvedValue({ error: { message: 'Invalid API key' } });
    (service as any).client = { emails: { send: mockSend } };
    await expect(service.send({ to: 'test@example.com', from: 'noreply@test.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('Resend send error');
  });

  it('should throw when unavailable', async () => {
    (service as any).client = null;
    await expect(service.send({ to: 'test@example.com', from: 'noreply@test.com', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow('PlatformMailer unavailable');
  });

  it('should warn in dev mode when no key', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendSenderService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const svc = module.get<ResendSenderService>(ResendSenderService);
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(false);
  });
});
