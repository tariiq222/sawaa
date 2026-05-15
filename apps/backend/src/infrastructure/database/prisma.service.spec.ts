import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { REQUEST_TX_CLS_KEY } from '../../common/constants';

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({
    queryRaw: jest.fn(),
    executeRaw: jest.fn(),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(function (this: any) {
    this.$connect = jest.fn().mockResolvedValue(undefined);
    this.$disconnect = jest.fn().mockResolvedValue(undefined);
    this.user = { findMany: jest.fn(), findUnique: jest.fn() };
    this.booking = { findMany: jest.fn() };
    this.$queryRaw = jest.fn();
    this.$transaction = jest.fn();
    this.$executeRaw = jest.fn();
    this.$extends = jest.fn().mockReturnValue(this);
    this.then = jest.fn();
    this.catch = jest.fn();
    this.finally = jest.fn();
  }),
}));

describe('PrismaService', () => {
  let mockConfig: jest.Mocked<ConfigService>;
  let mockCls: jest.Mocked<ClsService>;

  beforeEach(() => {
    mockConfig = {} as jest.Mocked<ConfigService>;
    mockCls = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ClsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('instantiation', () => {
    it('instantiates with ConfigService and ClsService', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect(service).toBeDefined();
    });

    it('instantiates without ConfigService and ClsService', () => {
      const service = new PrismaService();
      expect(service).toBeDefined();
    });
  });

  describe('lifecycle methods', () => {
    it('onModuleInit calls $connect', async () => {
      const service = new PrismaService(mockConfig, mockCls);
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalledTimes(1);
      connectSpy.mockRestore();
    });

    it('onModuleDestroy calls $disconnect', async () => {
      const service = new PrismaService(mockConfig, mockCls);
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      disconnectSpy.mockRestore();
    });
  });

  describe('Proxy routing', () => {
    it('routes model accessors to extended client', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect(service.user).toBeDefined();
      expect(typeof service.user.findMany).toBe('function');
    });

    it('routes $-prefixed methods to extended client', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect(typeof service.$queryRaw).toBe('function');
      expect(typeof service.$transaction).toBe('function');
      expect(typeof service.$executeRaw).toBe('function');
    });

    it('routes internal props to target', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect(typeof service.onModuleInit).toBe('function');
      expect(typeof service.onModuleDestroy).toBe('function');
      expect(typeof service.$connect).toBe('function');
      expect(typeof service.$disconnect).toBe('function');
    });

    it('exposes config and cls via proxy', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect((service as any).config).toBe(mockConfig);
      expect((service as any).cls).toBe(mockCls);
    });

    it('exposes basePrisma and extended via proxy', () => {
      const service = new PrismaService(mockConfig, mockCls);
      expect((service as any).basePrisma).toBeDefined();
      expect((service as any).extended).toBeDefined();
    });

  });

  describe('CLS transaction routing', () => {
    it('routes model accessors to tx client when CLS has REQUEST_TX_CLS_KEY', () => {
      const txUser = { findMany: jest.fn(), findUnique: jest.fn() };
      const txClient = { user: txUser };
      mockCls.get.mockReturnValue(txClient);

      const service = new PrismaService(mockConfig, mockCls);
      expect(service.user).toBe(txUser);
    });

    it('falls back to extended client when tx does not have the model', () => {
      const txClient = { otherModel: { findMany: jest.fn() } };
      mockCls.get.mockReturnValue(txClient);

      const service = new PrismaService(mockConfig, mockCls);
      // user is not on txClient, so should fall back to extended client
      expect(service.user).toBeDefined();
      expect(typeof service.user.findMany).toBe('function');
    });

    it('falls back to extended client when CLS has no tx', () => {
      mockCls.get.mockReturnValue(undefined);

      const service = new PrismaService(mockConfig, mockCls);
      expect(service.user).toBeDefined();
      expect(typeof service.user.findMany).toBe('function');
    });

    it('passes correct key to cls.get for transaction lookup', () => {
      mockCls.get.mockReturnValue(undefined);
      const service = new PrismaService(mockConfig, mockCls);
      // Trigger proxy
      void service.user;
      expect(mockCls.get).toHaveBeenCalledWith(REQUEST_TX_CLS_KEY);
    });
  });

  describe('function binding from extended client', () => {
    it('binds functions from extended client to the extended client', () => {
      const service = new PrismaService(mockConfig, mockCls);
      // $-prefixed methods should be bound
      const fn = service.$queryRaw;
      expect(fn).toBeDefined();
      // Should not throw when called without explicit this
      expect(() => fn``).not.toThrow();
    });
  });

  describe('constructor without optional deps', () => {
    it('works when config and cls are undefined', () => {
      const service = new PrismaService(undefined, undefined);
      expect(service).toBeDefined();
      expect(service.user).toBeDefined();
    });
  });
});
