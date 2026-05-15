import { AuditInterceptor, deriveEntityFromHandler, deriveEntityFromController, deriveEntityFromPath, resolveEntity, mapMethodToAction } from './audit.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ActivityAction } from '@prisma/client';

describe('AuditInterceptor pure functions', () => {
  it('deriveEntityFromHandler extracts entity', () => {
    expect(deriveEntityFromHandler('CreateBookingHandler')).toBe('Booking');
    expect(deriveEntityFromHandler('UpdateUserHandler')).toBe('User');
    expect(deriveEntityFromHandler('Unknown')).toBe('Unknown');
  });

  it('deriveEntityFromController strips prefixes', () => {
    expect(deriveEntityFromController('DashboardBookingsController')).toBe('Bookings');
    expect(deriveEntityFromController('PublicAuthController')).toBe('Auth');
  });

  it('deriveEntityFromPath extracts resource', () => {
    expect(deriveEntityFromPath('/api/v1/dashboard/bookings/123')).toBe('bookings');
    expect(deriveEntityFromPath('/api/v1/public/services')).toBe('services');
  });

  it('resolveEntity prefers handler', () => {
    expect(resolveEntity('Ctrl', 'CreateBookingHandler', '/path')).toBe('Booking');
    expect(resolveEntity('DashboardCtrl', 'Unknown', '/api/bookings')).toBe('Ctrl');
    expect(resolveEntity('Unknown', 'Unknown', '/api/services')).toBe('services');
  });

  it('mapMethodToAction maps correctly', () => {
    expect(mapMethodToAction('POST')).toBe(ActivityAction.CREATE);
    expect(mapMethodToAction('PATCH')).toBe(ActivityAction.UPDATE);
    expect(mapMethodToAction('PUT')).toBe(ActivityAction.UPDATE);
    expect(mapMethodToAction('DELETE')).toBe(ActivityAction.DELETE);
    expect(mapMethodToAction('GET')).toBe(ActivityAction.SYSTEM);
  });
});

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = { activityLog: { create: jest.fn() } };
    interceptor = new AuditInterceptor(mockPrisma);
  });

  it('skips GET requests', (done) => {
    const req = { method: 'GET', url: '/test', headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({ name: 'handler' }),
      getClass: () => ({ name: 'Controller' }),
    } as ExecutionContext;
    const next: CallHandler = { handle: () => of('result') };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('logs POST requests', (done) => {
    const req = {
      method: 'POST',
      url: '/api/v1/dashboard/bookings',
      originalUrl: '/api/v1/dashboard/bookings',
      ip: '127.0.0.1',
      socket: {},
      headers: {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({ name: 'CreateBookingHandler' }),
      getClass: () => ({ name: 'DashboardBookingsController' }),
    } as ExecutionContext;
    const next: CallHandler = { handle: () => of({ id: 'book-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(mockPrisma.activityLog.create).toHaveBeenCalled();
        done();
      },
    });
  });
});
