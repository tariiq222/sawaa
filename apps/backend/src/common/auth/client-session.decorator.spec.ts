import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ClientSession } from './client-session.decorator';

function getParamDecoratorFactory(): (
  data: unknown,
  ctx: ExecutionContext,
) => ClientSession {
  class TestController {
    test(@ClientSession() _session: ClientSession) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  return args[Object.keys(args)[0]].factory;
}

function executionContextWithRequest(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ClientSession', () => {
  const factory = getParamDecoratorFactory();

  it('returns the session the ClientSessionGuard attached to the request', () => {
    const session: ClientSession = {
      id: 'c-1',
      email: 'client@example.com',
      phone: null,
    };
    expect(factory(undefined, executionContextWithRequest({ user: session }))).toBe(
      session,
    );
  });

  it('returns undefined when no guard populated request.user (failure path)', () => {
    expect(
      factory(undefined, executionContextWithRequest({})),
    ).toBeUndefined();
  });

  it('preserves nullable contact fields as-is', () => {
    const session: ClientSession = { id: 'c-2', email: null, phone: null };
    const result = factory(
      undefined,
      executionContextWithRequest({ user: session }),
    );
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });
});
