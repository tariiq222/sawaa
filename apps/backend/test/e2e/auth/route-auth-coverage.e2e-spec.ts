import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../src/common/guards/jwt.guard';
import { createTestApp, request } from '../../helpers/create-test-app';

/**
 * M0.2: exhaustive auth-coverage sweep over EVERY registered HTTP route.
 *
 * The global APP_GUARD JwtGuard authenticates all routes by default; only
 * routes carrying @Public() metadata (IS_PUBLIC_KEY, on the handler or the
 * controller class) are exempt. A previously shipped bug class made guard
 * misconfiguration either 401-everything or — worse — silently expose
 * endpoints. This spec enumerates every controller route via the Nest
 * container (ModulesContainer + MetadataScanner + Reflector — NOT Express
 * internals, which are private and unstable on Express 5) and asserts that
 * every non-public route rejects an unauthenticated request with 401/403.
 *
 * If this test fails listing routes, those routes are reachable without
 * authentication — treat it as a security finding, not a flaky test.
 */

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

type SupertestVerb =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head';

interface DiscoveredRoute {
  /** HTTP verb used to exercise the route via supertest. */
  verb: SupertestVerb;
  /** Original Nest method enum name (GET/POST/.../ALL) for reporting. */
  httpMethod: string;
  /** Registered route path including the global prefix (with :params). */
  path: string;
  /** Concrete path with every path param replaced by a dummy UUID. */
  testPath: string;
  /** Whether @Public() metadata is set on the handler or controller. */
  isPublic: boolean;
  /** ControllerClass.methodName, for readable failure output. */
  source: string;
}

const VERB_BY_METHOD: Partial<Record<RequestMethod, SupertestVerb>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
  // @All() routes respond to any verb; probing with GET is sufficient.
  [RequestMethod.ALL]: 'get',
};

/** Join URL segments, dropping empties and collapsing duplicate slashes. */
function joinPath(...segments: Array<string | undefined>): string {
  const parts = segments
    .flatMap((s) => String(s ?? '').split('/'))
    .filter((s) => s.length > 0);
  return '/' + parts.join('/');
}

/** Replace `:param`, `:param?` and `{param}` tokens with a dummy UUID. */
function substituteParams(path: string): string {
  return path
    .replace(/:[A-Za-z0-9_]+\??/g, DUMMY_UUID)
    .replace(/\{[A-Za-z0-9_]+\}/g, DUMMY_UUID);
}

function enumerateRoutes(app: INestApplication): DiscoveredRoute[] {
  const modulesContainer = app.get(ModulesContainer);
  const reflector = app.get(Reflector);
  const scanner = new MetadataScanner();

  const routes = new Map<string, DiscoveredRoute>();

  for (const moduleRef of modulesContainer.values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controllerClass = wrapper.metatype as
        | (new (...args: unknown[]) => unknown)
        | undefined;
      if (typeof controllerClass !== 'function') continue;

      const controllerPathMeta = Reflect.getMetadata(
        PATH_METADATA,
        controllerClass,
      ) as string | string[] | undefined;
      if (controllerPathMeta === undefined) continue; // not an HTTP controller

      const controllerPaths = Array.isArray(controllerPathMeta)
        ? controllerPathMeta
        : [controllerPathMeta];

      const prototype = controllerClass.prototype as Record<string, unknown>;

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;

        const methodPathMeta = Reflect.getMetadata(PATH_METADATA, handler) as
          | string
          | string[]
          | undefined;
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        if (methodPathMeta === undefined || requestMethod === undefined) {
          continue; // not a route handler
        }

        // Mirror exactly what JwtGuard does: handler metadata overrides class.
        const isPublic =
          reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            handler as (...args: unknown[]) => unknown,
            controllerClass,
          ]) === true;

        const verb = VERB_BY_METHOD[requestMethod];
        if (!verb) continue; // exotic WebDAV verbs — none registered today

        const methodPaths = Array.isArray(methodPathMeta)
          ? methodPathMeta
          : [methodPathMeta];

        for (const cPath of controllerPaths) {
          for (const mPath of methodPaths) {
            const path = joinPath('api/v1', cPath, mPath);
            const key = `${verb} ${path}`;
            if (routes.has(key)) continue;
            routes.set(key, {
              verb,
              httpMethod: RequestMethod[requestMethod],
              path,
              testPath: substituteParams(path),
              isPublic,
              source: `${controllerClass.name}.${methodName}`,
            });
          }
        }
      }
    }
  }

  return [...routes.values()];
}

describe('Route auth coverage — every non-@Public route rejects anonymous requests (e2e, M0.2)', () => {
  let app: INestApplication;
  let routes: DiscoveredRoute[];

  beforeAll(async () => {
    const { app: a } = await createTestApp();
    app = a;
    routes = enumerateRoutes(app);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('enumerates a meaningful number of routes (enumeration is not silently broken)', () => {
    // The backend currently registers well over 100 routes across
    // dashboard / mobile / public audiences. If this drops below the floor,
    // the enumeration mechanism broke — fix the test, do not lower the bar.
    expect(routes.length).toBeGreaterThan(100);
    const protectedRoutes = routes.filter((r) => !r.isPublic);
    const publicRoutes = routes.filter((r) => r.isPublic);
    // eslint-disable-next-line no-console -- intentional audit trail in test output
    console.log(
      `route-auth-coverage: ${routes.length} routes discovered ` +
        `(${protectedRoutes.length} protected, ${publicRoutes.length} @Public)`,
    );
    expect(protectedRoutes.length).toBeGreaterThan(50);
    expect(publicRoutes.length).toBeGreaterThan(5);
  });

  it(
    'rejects an unauthenticated request on EVERY route not marked @Public with 401/403',
    async () => {
      const protectedRoutes = routes.filter((r) => !r.isPublic);
      expect(protectedRoutes.length).toBeGreaterThan(0);

      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const violations: string[] = [];

      for (const route of protectedRoutes) {
        const res = await request(server)[route.verb](route.testPath);
        // The global JwtGuard must reject with 401 before anything else runs;
        // 403 is tolerated for routes with an additional authorization guard.
        // ANY other status (2xx, 3xx, 404, 400, 500) means the request got
        // PAST authentication — i.e. the route is reachable anonymously.
        if (res.status !== 401 && res.status !== 403) {
          violations.push(
            `${route.httpMethod} ${route.path} (${route.source}) -> ${res.status}`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `SECURITY: ${violations.length} non-@Public route(s) did not reject ` +
            `an unauthenticated request with 401/403:\n  ${violations.join('\n  ')}\n` +
            `Each listed route is reachable without authentication or bypasses ` +
            `the global JwtGuard in an unexpected way.`,
        );
      }
    },
    120_000,
  );

  it('sees @Public metadata on known-public routes (enumeration reads the decorator correctly)', () => {
    const publicSet = new Set(
      routes.filter((r) => r.isPublic).map((r) => `${r.verb} ${r.path}`),
    );
    // Client login + health probe are @Public by design. If the enumeration
    // failed to read IS_PUBLIC_KEY these would show up as protected and the
    // sweep above would mass-fail — this is the explicit inverse check.
    expect(publicSet).toContain('post /api/v1/public/auth/login');
    expect(publicSet).toContain('get /api/v1/health/live');
  });

  it('does NOT 401 a known @Public route without a token (guard honours the metadata at runtime)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
