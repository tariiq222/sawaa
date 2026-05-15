import { AuditInterceptor, deriveEntityFromHandler, deriveEntityFromController, deriveEntityFromPath, resolveEntity, mapMethodToAction } from './audit.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { ActivityAction } from '@prisma/client';
import { RequestContextStorage } from '../http/request-context';

describe('AuditInterceptor pure functions', () => {
  it('deriveEntityFromHandler extracts entity', () => {
    expect(deriveEntityFromHandler('CreateBookingHandler')).toBe('Booking');
    expect(deriveEntityFromHandler('UpdateUserHandler')).toBe('User');
    expect(deriveEntityFromHandler('DeleteInvoiceHandler')).toBe('Invoice');
    expect(deriveEntityFromHandler('PatchSettingsHandler')).toBe('Settings');
    expect(deriveEntityFromHandler('Unknown')).toBe('Unknown');
    expect(deriveEntityFromHandler('')).toBe('Unknown');
  });

  it('deriveEntityFromController strips prefixes', () => {
    expect(deriveEntityFromController('DashboardBookingsController')).toBe('Bookings');
    expect(deriveEntityFromController('PublicAuthController')).toBe('Auth');
    expect(deriveEntityFromController('MobileClientProfileController')).toBe('ClientProfile');
    expect(deriveEntityFromController('AdminMetricsController')).toBe('Metrics');
    expect(deriveEntityFromController('Controller')).toBe('Unknown');
    expect(deriveEntityFromController('')).toBe('Unknown');
  });

  it('deriveEntityFromPath extracts resource', () => {
    expect(deriveEntityFromPath('/api/v1/dashboard/bookings/123')).toBe('bookings');
    expect(deriveEntityFromPath('/api/v1/public/services')).toBe('services');
    expect(deriveEntityFromPath('/api/v2/mobile/client/appointments')).toBe('appointments');
    expect(deriveEntityFromPath('/api/v1/admin/users')).toBe('users');
    expect(deriveEntityFromPath('/api/v1/health')).toBe('health');
    expect(deriveEntityFromPath('/')).toBe('Unknown');
    expect(deriveEntityFromPath('')).toBe('Unknown');
    expect(deriveEntityFromPath('/api/v1?query=1')).toBe('Unknown');
  });

  it('resolveEntity prefers handler', () => {
    expect(resolveEntity('Ctrl', 'CreateBookingHandler', '/path')).toBe('Booking');
    expect(resolveEntity('DashboardCtrl', 'Unknown', '/api/bookings')).toBe('Ctrl');
    expect(resolveEntity('Unknown', 'Unknown', '/api/services')).toBe('services');
    expect(resolveEntity('', 'Unknown', '/api/unknown')).toBe('unknown');
    expect(resolveEntity('', 'Unknown', '')).toBe('Unknown');
  });

  it('mapMethodToAction maps correctly', () => {
    expect(mapMethodToAction('POST')).toBe(ActivityAction.CREATE);
    expect(mapMethodToAction('PATCH')).toBe(ActivityAction.UPDATE);
    expect(mapMethodToAction('PUT')).toBe(ActivityAction.UPDATE);
    expect(mapMethodToAction('DELETE')).toBe(ActivityAction.DELETE);
    expect(mapMethodToAction('GET')).toBe(ActivityAction.SYSTEM);
    expect(mapMethodToAction('OPTIONS')).toBe(ActivityAction.SYSTEM);
  });
});

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = { activityLog: { create: jest.fn() } };
    interceptor = new AuditInterceptor(mockPrisma);
    RequestContextStorage.run(new Map(), () => {});
  });

  const createContext = (req: any, handlerName: string, controllerName: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({ name: handlerName }),
      getClass: () => ({ name: controllerName }),
    } as any);

  it('skips GET requests', async () => {
    const req = { method: 'GET', url: '/test', headers: {} };
    const next: CallHandler = { handle: () => of('result') };

    await lastValueFrom(interceptor.intercept(createContext(req, 'handler', 'Controller'), next));
    expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
  });

  it('logs POST requests', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('logs POST with nested data.id', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: { remoteAddress: '::1' },
      headers: { 'user-agent': 'jest' },
    };
    const next: CallHandler = { handle: () => of({ data: { id: 'nested-1' } }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityId: 'nested-1' }) }),
    );
  });

  it('logs POST without response id', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of({ name: 'no-id' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityId: undefined }) }),
    );
  });

  it('logs POST with null response', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('logs error on handler failure', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => throwError(() => new Error('fail')) };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next)),
    ).rejects.toThrow('fail');
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('extracts user from RequestContextStorage', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await RequestContextStorage.run({ requestId: 'r1', userId: 'u1' }, async () =>
      lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next)),
    );
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }),
    );
  });

  it('extracts user from valid JWT header', async () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u2', email: 'test@example.com' })).toString('base64url');
    const token = `header.${payload}.sig`;
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: { authorization: `Bearer ${token}` },
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u2', userEmail: 'test@example.com' }) }),
    );
  });

  it('handles malformed JWT header gracefully', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: { authorization: 'Bearer bad-token' },
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('handles missing auth header', async () => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('handles activityLog.create error in tap silently', async () => {
    mockPrisma.activityLog.create.mockRejectedValue(new Error('db fail'));
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    await lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next));
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });

  it('handles activityLog.create error in catchError silently', async () => {
    mockPrisma.activityLog.create.mockRejectedValue(new Error('db fail'));
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const next: CallHandler = { handle: () => throwError(() => new Error('handler fail')) };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(req, 'CreateBookingHandler', 'DashboardBookingsController'), next)),
    ).rejects.toThrow('handler fail');
    expect(mockPrisma.activityLog.create).toHaveBeenCalled();
  });
});
