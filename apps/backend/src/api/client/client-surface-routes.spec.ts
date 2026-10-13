import 'reflect-metadata';
import { readdirSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { IS_PUBLIC_KEY } from '../../common/guards/jwt.guard';
import { ClientApiModule } from './client-api.module';

/** Route map from docs/architecture/client-api-unification.md §4.2. */
const TARGET: string[] = [
  // profile
  'GET /client/profile',

  'GET /client/profile/email',
  'PATCH /client/profile',
  'DELETE /client/profile',
  'POST /client/profile/email/request',
  'POST /client/profile/email/verify',
  'POST /client/profile/email/decline',
  'POST /client/profile/phone/request',
  'POST /client/profile/phone/verify',
  // bookings
  'GET /client/bookings',
  'POST /client/bookings',
  'GET /client/bookings/:id',
  'GET /client/bookings/:id/cancellation-preview',
  'PATCH /client/bookings/:id/cancel',
  'PATCH /client/bookings/:id/reschedule',
  'POST /client/bookings/:id/rate',
  'GET /client/bookings/:id/join',
  'GET /client/bookings/:id/invoice',
  // invoices
  'GET /client/invoices',
  'GET /client/invoices/:id',
  'GET /client/invoices/:id/pdf',
  // payments
  'GET /client/payments',
  'POST /client/payments/init',
  'GET /client/payments/native/config',
  'POST /client/payments/native/init',
  'POST /client/payments/native/:paymentId/reconcile',
  'POST /client/payments/bank-transfer',
  'GET /client/payments/bank-transfer/settings',
  // packages, package purchases, programs, refunds
  'GET /client/packages/purchases',
  'GET /client/packages/purchases/:id',
  'POST /client/packages/book',
  'POST /client/package-purchases/init',
  'POST /client/package-purchases/native/init',
  'POST /client/programs/:id/enroll',
  'POST /client/refunds/request',
  // notifications
  'GET /client/notifications',
  'GET /client/notifications/unread-count',
  'PATCH /client/notifications/mark-read',
  'POST /client/notifications/fcm-token',
  'DELETE /client/notifications/fcm-token',
  // chat (today's /public/me/chat routes, unchanged shape)
  'GET /client/chat/conversations',
  'GET /client/chat/conversations/current',
  'GET /client/chat/conversations/:conversationId',
  'GET /client/chat/conversations/:conversationId/messages',
  'POST /client/chat/conversations/:conversationId/claim',
  'POST /client/chat/conversations/:conversationId/handoff',
  'POST /client/chat/conversations/:conversationId/messages',
  'POST /client/chat/conversations/:conversationId/messages/:messageId/retry',
  'POST /client/chat/operations/:operationId/acknowledge',
  'POST /client/chat/operations/:operationId/confirm',
  'POST /client/chat/operations/:operationId/decline',
  // portal
  'GET /client/portal/home',
  'GET /client/portal/summary',
  'GET /client/portal/upcoming',
];

type ControllerClass = new (...args: never[]) => unknown;

function loadControllers(): ControllerClass[] {
  return readdirSync(__dirname)
    .filter((f) => f.endsWith('.controller.ts') && !f.endsWith('.spec.ts'))
    .flatMap((f) => {
      const mod = require(join(__dirname, f)) as Record<string, unknown>;
      return Object.values(mod).filter(
        (v): v is ControllerClass =>
          typeof v === 'function' && Reflect.getMetadata(PATH_METADATA, v) !== undefined,
      );
    });
}

const join2 = (...parts: string[]) =>
  '/' + parts.flatMap((p) => p.split('/')).filter(Boolean).join('/');

function routesOf(ctrl: ControllerClass): string[] {
  const base = Reflect.getMetadata(PATH_METADATA, ctrl) as string | string[];
  const bases = Array.isArray(base) ? base : [base];
  const out: string[] = [];
  for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
    const handler = (ctrl.prototype as Record<string, unknown>)[name];
    if (typeof handler !== 'function') continue;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) continue;
    const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[];
    for (const b of bases) {
      for (const p of Array.isArray(path) ? path : [path]) {
        out.push(`${RequestMethod[method]} ${join2(b, p === '/' ? '' : p)}`);
      }
    }
  }
  return out;
}

describe('client surface routes', () => {
  const controllers = loadControllers();

  it('finds the controllers under src/api/client', () => {
    expect(controllers.length).toBeGreaterThan(0);
  });

  it.each(controllers.map((c) => [c.name, c] as const))(
    '%s is protected by ClientRoute (ClientSessionGuard) and lives under /client',
    (_name, ctrl) => {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, ctrl) ?? []) as unknown[];
      expect(guards).toContain(ClientSessionGuard);
      const base = Reflect.getMetadata(PATH_METADATA, ctrl) as string | string[];
      for (const b of Array.isArray(base) ? base : [base]) {
        expect(b.startsWith('client/') || b === 'client').toBe(true);
      }
    },
  );

  it('every *.controller.ts file is registered in ClientApiModule', () => {
    const registered = (Reflect.getMetadata('controllers', ClientApiModule) ?? []) as ControllerClass[];
    expect(registered.length).toBeGreaterThan(0);
    for (const ctrl of controllers) expect(registered).toContain(ctrl);
    for (const ctrl of registered) expect(controllers).toContain(ctrl);
  });

  it.each(controllers.map((c) => [c.name, c] as const))('%s is marked public for the staff JwtGuard', (_name, ctrl) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ctrl)).toBe(true);
  });

  it('every non-GET route carries throttler metadata', () => {
    const missing: string[] = [];
    for (const ctrl of controllers) {
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const handler = (ctrl.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined || method === RequestMethod.GET) continue;
        const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
        const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);
        if (typeof limit !== 'number' || typeof ttl !== 'number') missing.push(`${ctrl.name}.${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('exposes exactly the target route map', () => {
    const actual = controllers.flatMap(routesOf).sort();
    expect(actual).toEqual([...TARGET].sort());
  });
});
