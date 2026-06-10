import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FcmService } from './fcm.service';
import { PrismaService } from '../database/prisma.service';

jest.mock('firebase-admin', () => {
  const mockInitializeApp = jest.fn();
  const mockMessagingSend = jest.fn();
  const mockMessagingSendEachForMulticast = jest.fn();
  const mockCredentialCert = jest.fn();

  return {
    initializeApp: mockInitializeApp,
    credential: {
      cert: mockCredentialCert,
    },
    messaging: jest.fn().mockReturnValue({
      send: mockMessagingSend,
      sendEachForMulticast: mockMessagingSendEachForMulticast,
    }),
    __mockInitializeApp: mockInitializeApp,
    __mockMessagingSend: mockMessagingSend,
    __mockMessagingSendEachForMulticast: mockMessagingSendEachForMulticast,
    __mockCredentialCert: mockCredentialCert,
  };
});

describe('FcmService', () => {
  let service: FcmService;
  let configGet: jest.Mock;
  let findUnique: jest.Mock;

  const getMocks = () => {
    const mod = jest.requireMock('firebase-admin') as {
      __mockInitializeApp: jest.Mock;
      __mockMessagingSend: jest.Mock;
      __mockMessagingSendEachForMulticast: jest.Mock;
      __mockCredentialCert: jest.Mock;
    };
    return mod;
  };

  beforeEach(async () => {
    const mocks = getMocks();
    mocks.__mockInitializeApp.mockClear();
    mocks.__mockMessagingSend.mockClear();
    mocks.__mockMessagingSendEachForMulticast.mockClear();
    mocks.__mockCredentialCert.mockClear();

    configGet = jest.fn();
    findUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FcmService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: PrismaService, useValue: { platformSetting: { findUnique } } },
      ],
    }).compile();

    service = module.get<FcmService>(FcmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('reads credentials from DB first', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'db-project-id' })
        .mockResolvedValueOnce({ value: 'db-client-email' })
        .mockResolvedValueOnce({ value: 'db-private-key' });

      await service.onModuleInit();

      expect(findUnique).toHaveBeenCalledWith({ where: { key: 'notifications.fcm.projectId' } });
      expect(findUnique).toHaveBeenCalledWith({ where: { key: 'notifications.fcm.clientEmail' } });
      expect(findUnique).toHaveBeenCalledWith({ where: { key: 'notifications.fcm.serverKey' } });
      expect(configGet).not.toHaveBeenCalled();
      expect(getMocks().__mockInitializeApp).toHaveBeenCalled();
    });

    it('falls back to env vars when DB missing', async () => {
      findUnique.mockResolvedValue(null);
      configGet
        .mockReturnValueOnce('env-project-id')
        .mockReturnValueOnce('env-client-email')
        .mockReturnValueOnce('env-private-key');

      await service.onModuleInit();

      expect(configGet).toHaveBeenCalledWith('FCM_PROJECT_ID');
      expect(configGet).toHaveBeenCalledWith('FCM_CLIENT_EMAIL');
      expect(configGet).toHaveBeenCalledWith('FCM_PRIVATE_KEY');
      expect(getMocks().__mockInitializeApp).toHaveBeenCalled();
    });

    it('falls back to env vars when DB throws', async () => {
      findUnique.mockRejectedValue(new Error('DB error'));
      configGet
        .mockReturnValueOnce('env-project-id')
        .mockReturnValueOnce('env-client-email')
        .mockReturnValueOnce('env-private-key');

      await service.onModuleInit();

      expect(configGet).toHaveBeenCalledWith('FCM_PROJECT_ID');
      expect(getMocks().__mockInitializeApp).toHaveBeenCalled();
    });

    it('skips initialization when no projectId', async () => {
      findUnique.mockResolvedValue(null);
      configGet.mockReturnValue(undefined);

      await service.onModuleInit();

      expect(getMocks().__mockInitializeApp).not.toHaveBeenCalled();
      expect(service.isAvailable()).toBe(false);
    });

    it('calls admin.initializeApp with correct creds', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'proj-1' })
        .mockResolvedValueOnce({ value: 'mail@example.com' })
        .mockResolvedValueOnce({ value: 'key-1' });
      getMocks().__mockCredentialCert.mockReturnValue('cred-object');

      await service.onModuleInit();

      expect(getMocks().__mockCredentialCert).toHaveBeenCalledWith({
        projectId: 'proj-1',
        clientEmail: 'mail@example.com',
        privateKey: 'key-1',
      });
      expect(getMocks().__mockInitializeApp).toHaveBeenCalledWith({ credential: 'cred-object' });
    });

    it('handles privateKey with escaped newlines from DB', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'proj-1' })
        .mockResolvedValueOnce({ value: 'mail@example.com' })
        .mockResolvedValueOnce({ value: 'line-1\\nline-2' });

      await service.onModuleInit();

      expect(getMocks().__mockCredentialCert).toHaveBeenCalledWith(
        expect.objectContaining({ privateKey: 'line-1\nline-2' }),
      );
    });

    it('handles privateKey with escaped newlines from env', async () => {
      findUnique.mockResolvedValue(null);
      configGet
        .mockReturnValueOnce('proj-1')
        .mockReturnValueOnce('mail@example.com')
        .mockReturnValueOnce('line-1\\nline-2');

      await service.onModuleInit();

      expect(getMocks().__mockCredentialCert).toHaveBeenCalledWith(
        expect.objectContaining({ privateKey: 'line-1\nline-2' }),
      );
    });
  });

  describe('isAvailable', () => {
    it('returns false before init', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('returns true after init', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'proj-1' })
        .mockResolvedValueOnce({ value: 'mail@example.com' })
        .mockResolvedValueOnce({ value: 'key-1' });

      await service.onModuleInit();

      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('sendPush', () => {
    it('throws when not initialized', async () => {
      await expect(service.sendPush('token', 'title', 'body')).rejects.toThrow(
        'FCM is not initialized',
      );
    });

    it('calls admin.messaging().send and returns messageId', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'proj-1' })
        .mockResolvedValueOnce({ value: 'mail@example.com' })
        .mockResolvedValueOnce({ value: 'key-1' });
      getMocks().__mockMessagingSend.mockResolvedValue('msg-123');

      await service.onModuleInit();
      const result = await service.sendPush('token', 'title', 'body', { foo: 'bar' });

      expect(getMocks().__mockMessagingSend).toHaveBeenCalledWith({
        token: 'token',
        notification: { title: 'title', body: 'body' },
        data: { foo: 'bar' },
      });
      expect(result).toBe('msg-123');
    });
  });

  describe('sendMulticast', () => {
    it('throws when not initialized', async () => {
      await expect(service.sendMulticast(['t1'], 'title', 'body')).rejects.toThrow(
        'FCM is not initialized',
      );
    });

    it('calls admin.messaging().sendEachForMulticast and returns counts', async () => {
      findUnique
        .mockResolvedValueOnce({ value: 'proj-1' })
        .mockResolvedValueOnce({ value: 'mail@example.com' })
        .mockResolvedValueOnce({ value: 'key-1' });
      getMocks().__mockMessagingSendEachForMulticast.mockResolvedValue({ successCount: 2, failureCount: 1 });

      await service.onModuleInit();
      const result = await service.sendMulticast(['t1', 't2', 't3'], 'title', 'body');

      expect(getMocks().__mockMessagingSendEachForMulticast).toHaveBeenCalledWith({
        tokens: ['t1', 't2', 't3'],
        notification: { title: 'title', body: 'body' },
        data: undefined,
      });
      expect(result).toEqual({ successCount: 2, failureCount: 1 });
    });
  });
});
