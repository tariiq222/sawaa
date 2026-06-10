import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser, JwtUser } from './current-user.decorator';

/**
 * createParamDecorator hides the factory behind route-args metadata; this is
 * the standard way to recover it for unit testing.
 */
function getParamDecoratorFactory(): (
  data: unknown,
  ctx: ExecutionContext,
) => JwtUser {
  class TestController {
    test(@CurrentUser() _user: JwtUser) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  return args[Object.keys(args)[0]].factory;
}

function executionContextWithRequest(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser', () => {
  const factory = getParamDecoratorFactory();

  it('returns the user the JWT guard attached to the request', () => {
    const user: JwtUser = {
      sub: 'u-1',
      roles: ['ADMIN'],
      permissions: [{ action: 'manage', subject: 'all' }],
    };
    expect(factory(undefined, executionContextWithRequest({ user }))).toBe(
      user,
    );
  });

  it('returns undefined when no guard populated request.user (failure path)', () => {
    expect(
      factory(undefined, executionContextWithRequest({})),
    ).toBeUndefined();
  });

  it('ignores the decorator data argument', () => {
    const user: JwtUser = { sub: 'u-2', roles: [], permissions: [] };
    expect(
      factory('some-data', executionContextWithRequest({ user })),
    ).toBe(user);
  });
});
