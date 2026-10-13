import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { ClientSessionGuard } from '../guards/client-session.guard';
import { WebChatEnabledGuard } from '../../modules/comms/chat/web-chat-availability.service';
import { MyChatController } from '../../api/public/my-chat.controller';

const API_ROOT = join(__dirname, '..', '..', 'api');

/**
 * Controllers that mix anonymous and client-session methods and therefore guard
 * individual methods with `@UseGuards(ClientSessionGuard)`. Everything else must
 * use `@ClientRoute()`.
 */
const CLIENT_SESSION_GUARD_ALLOWLIST: string[] = [
  'public/bookings.controller.ts',
  'public/intake-forms.controller.ts',
  'public/invoices.controller.ts',
  'public/payments.controller.ts',
  'public/refunds.controller.ts',
];

const LEGACY_PREFIXES = ['mobile/client', 'public/me'];

const LEGACY_ROUTE_SNAPSHOT: string[] = [
  "DELETE /mobile/client/notifications/fcm-token",
  "DELETE /mobile/client/profile",
  "GET /mobile/client/bookings",
  "GET /mobile/client/bookings/:id",
  "GET /mobile/client/bookings/:id/cancellation-preview",
  "GET /mobile/client/bookings/:id/join",
  "GET /mobile/client/notifications",
  "GET /mobile/client/notifications/unread-count",
  "GET /mobile/client/packages/purchases",
  "GET /mobile/client/packages/purchases/:id",
  "GET /mobile/client/payments",
  "GET /mobile/client/payments/bank-transfer/settings",
  "GET /mobile/client/payments/invoices/:id",
  "GET /mobile/client/payments/native/config",
  "GET /mobile/client/portal/home",
  "GET /mobile/client/portal/summary",
  "GET /mobile/client/portal/upcoming",
  "GET /mobile/client/profile",
  "GET /mobile/client/profile/email",
  "GET /public/me",
  "GET /public/me/bookings",
  "GET /public/me/bookings/:id",
  "GET /public/me/bookings/:id/cancellation-preview",
  "GET /public/me/bookings/:id/invoice",
  "GET /public/me/chat/conversations",
  "GET /public/me/chat/conversations/:conversationId",
  "GET /public/me/chat/conversations/:conversationId/messages",
  "GET /public/me/chat/conversations/current",
  "GET /public/me/invoices",
  "GET /public/me/packages/purchases",
  "GET /public/me/packages/purchases/:id",
  "PATCH /mobile/client/bookings/:id/cancel",
  "PATCH /mobile/client/bookings/:id/reschedule",
  "PATCH /mobile/client/notifications/mark-read",
  "PATCH /mobile/client/profile",
  "PATCH /public/me",
  "PATCH /public/me/bookings/:id/cancel",
  "PATCH /public/me/bookings/:id/reschedule",
  "POST /mobile/client/bookings",
  "POST /mobile/client/bookings/:id/rate",
  "POST /mobile/client/notifications/fcm-token",
  "POST /mobile/client/packages/book",
  "POST /mobile/client/payments/bank-transfer",
  "POST /mobile/client/payments/init",
  "POST /mobile/client/payments/native/:paymentId/reconcile",
  "POST /mobile/client/payments/native/init",
  "POST /mobile/client/payments/package-purchases/init",
  "POST /mobile/client/payments/package-purchases/native/init",
  "POST /mobile/client/profile/email/decline",
  "POST /mobile/client/profile/email/request",
  "POST /mobile/client/profile/email/verify",
  "POST /mobile/client/profile/phone/request",
  "POST /mobile/client/profile/phone/verify",
  "POST /mobile/client/programs/:id/enroll",
  "POST /public/me/chat/conversations/:conversationId/claim",
  "POST /public/me/chat/conversations/:conversationId/handoff",
  "POST /public/me/chat/conversations/:conversationId/messages",
  "POST /public/me/chat/conversations/:conversationId/messages/:messageId/retry",
  "POST /public/me/chat/operations/:operationId/acknowledge",
  "POST /public/me/chat/operations/:operationId/confirm",
  "POST /public/me/chat/operations/:operationId/decline",
  "POST /public/me/packages/book",
];

const HTTP_DECORATOR = /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/g;
const CONTROLLER_DECORATOR = /@Controller\(\s*(\[[^\]]*\]|'[^']*')?\s*\)/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function joinPath(...parts: string[]): string {
  return parts
    .join('/')
    .split('/')
    .filter(Boolean)
    .join('/');
}

function extractRoutes(source: string): string[] {
  const controller = CONTROLLER_DECORATOR.exec(source);
  if (!controller) return [];
  const prefixes = controller[1]
    ? [...controller[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
    : [''];
  const body = source.slice(controller.index + controller[0].length);
  const routes: string[] = [];
  for (const match of body.matchAll(HTTP_DECORATOR)) {
    for (const prefix of prefixes) {
      routes.push(`${match[1].toUpperCase()} /${joinPath(prefix, match[2] ?? '')}`);
    }
  }
  return routes;
}

function isLegacy(route: string): boolean {
  const path = route.split(' ')[1].slice(1);
  return LEGACY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

describe('client surface architecture', () => {
  const files = listSourceFiles(API_ROOT);

  it('only allowlisted controllers import ClientSessionGuard directly', () => {
    const offenders = files
      .filter((f) => /\bClientSessionGuard\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(API_ROOT, f))
      .filter((f) => !CLIENT_SESSION_GUARD_ALLOWLIST.includes(f))
      .sort();
    expect(offenders).toEqual([]);
  });

  it('allowlist has no stale entries', () => {
    const stale = CLIENT_SESSION_GUARD_ALLOWLIST.filter(
      (f) => !/\bClientSessionGuard\b/.test(readFileSync(join(API_ROOT, f), 'utf8')),
    );
    expect(stale).toEqual([]);
  });

  it('legacy client route prefixes are frozen', () => {
    const actual = files
      .flatMap((f) => extractRoutes(readFileSync(f, 'utf8')))
      .filter(isLegacy)
      .sort();
    expect({
      message:
        'New client routes must be added under api/client (see docs/architecture/client-api-unification.md), not under legacy prefixes.',
      routes: actual,
    }).toEqual({
      message:
        'New client routes must be added under api/client (see docs/architecture/client-api-unification.md), not under legacy prefixes.',
      routes: [...LEGACY_ROUTE_SNAPSHOT].sort(),
    });
  });

  it('runs WebChatEnabledGuard before ClientSessionGuard on my-chat', () => {
    const guards = Reflect.getMetadata('__guards__', MyChatController) as unknown[];
    expect(guards).toEqual([WebChatEnabledGuard, ClientSessionGuard]);
  });
});
