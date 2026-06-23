import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UserId } from './user-id.decorator';

/**
 * createParamDecorator hides the factory behind route-args metadata; this is
 * the standard way to recover it for unit testing (mirrors the pattern used in
 * current-user.decorator.spec.ts).
 */
function getParamDecoratorFactory(): (data: unknown, ctx: ExecutionContext) => string {
  class TestController {
    test(@UserId() _id: string) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
  return args[Object.keys(args)[0]].factory;
}

function executionContextWithRequest(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('UserId', () => {
  const factory = getParamDecoratorFactory();

  it('returns the user id attached by the JWT strategy', () => {
    expect(factory(undefined, executionContextWithRequest({ user: { id: 'user-123' } }))).toBe(
      'user-123',
    );
  });

  it('throws when req.user is missing', () => {
    expect(() => factory(undefined, executionContextWithRequest({}))).toThrow(
      /no authenticated user/i,
    );
  });

  it('throws when req.user.id is missing', () => {
    expect(() => factory(undefined, executionContextWithRequest({ user: {} }))).toThrow(
      /no authenticated user/i,
    );
  });

  it('throws when req.user.id is an empty string', () => {
    expect(() =>
      factory(undefined, executionContextWithRequest({ user: { id: '' } })),
    ).toThrow(/no authenticated user/i);
  });

  it('ignores the decorator data argument', () => {
    expect(
      factory('anything', executionContextWithRequest({ user: { id: 'u-2' } })),
    ).toBe('u-2');
  });
});
