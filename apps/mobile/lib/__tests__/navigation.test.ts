import { decodeRedirect, encodeRedirect, goBackOrHome, guardedRoute, loginRedirectHref } from '../navigation';

describe('encodeRedirect', () => {
  it('keeps a bare pathname when there are no params', () => {
    expect(encodeRedirect('/(client)/(tabs)/appointments')).toBe('/(client)/(tabs)/appointments');
  });

  it('carries the params a protected route needs to render', () => {
    expect(encodeRedirect('/(client)/video-call', { bookingId: 'b-1' }))
      .toBe('/(client)/video-call?bookingId=b-1');
  });

  it('drops empty, undefined and nested redirect params', () => {
    expect(encodeRedirect('/(client)/packages/return', {
      purchaseId: 'p-1',
      clientId: '',
      familyId: undefined,
      redirect: '/(client)/elsewhere',
    })).toBe('/(client)/packages/return?purchaseId=p-1');
  });

  it('encodes repeated params instead of losing them', () => {
    expect(encodeRedirect('/(client)/groups/[id]', { tag: ['a', 'b'] }))
      .toBe('/(client)/groups/[id]?tag=a&tag=b');
  });
});

describe('decodeRedirect', () => {
  it('accepts an in-app path', () => {
    expect(decodeRedirect('/(client)/(tabs)/appointments')).toBe('/(client)/(tabs)/appointments');
  });

  it('restores query params as an href object', () => {
    expect(decodeRedirect('/(client)/video-call?bookingId=b-1')).toEqual({
      pathname: '/(client)/video-call',
      params: { bookingId: 'b-1' },
    });
  });

  it('rejects anything that could leave the app', () => {
    expect(decodeRedirect('https://evil.example/steal')).toBeNull();
    expect(decodeRedirect('//evil.example/steal')).toBeNull();
    expect(decodeRedirect('sawa://login')).toBeNull();
    expect(decodeRedirect(undefined)).toBeNull();
    expect(decodeRedirect('')).toBeNull();
  });

  it('rejects auth routes so login cannot bounce back into itself', () => {
    expect(decodeRedirect('/(auth)/login')).toBeNull();
    expect(decodeRedirect('/(auth)/register?redirect=/(auth)/login')).toBeNull();
    expect(decodeRedirect('/register')).toBeNull();
  });

  it('uses the first value when the param arrives repeated', () => {
    expect(decodeRedirect(['/(client)/(tabs)/home', '/(client)/(tabs)/chat']))
      .toBe('/(client)/(tabs)/home');
  });
});

describe('guardedRoute', () => {
  it('keeps the group segments so a tab route cannot resolve to the public home', () => {
    expect(guardedRoute(['(client)', '(tabs)', 'home'])).toEqual({
      pathname: '/(client)/(tabs)/home',
      params: {},
    });
  });

  it('substitutes a dynamic segment and drops it from the query params', () => {
    expect(guardedRoute(['(client)', 'appointment', '[id]'], { id: 'booking-9' })).toEqual({
      pathname: '/(client)/appointment/booking-9',
      params: {},
    });
  });

  it('keeps the query params the route still needs', () => {
    expect(guardedRoute(['(client)', 'video-call'], { bookingId: 'booking-9' })).toEqual({
      pathname: '/(client)/video-call',
      params: { bookingId: 'booking-9' },
    });
  });

  it('expands a catch-all segment', () => {
    expect(guardedRoute(['(client)', 'packages', '[...slug]'], { slug: ['a', 'b'] })).toEqual({
      pathname: '/(client)/packages/a/b',
      params: {},
    });
  });

  it('gives up on a route whose dynamic value is missing', () => {
    expect(guardedRoute(['(client)', 'appointment', '[id]'])).toBeNull();
  });

  it('drops the params the router adds to the route state itself', () => {
    expect(guardedRoute(['(client)', 'appointment', '[id]'], {
      id: 'booking-9',
      pop: 'true',
      initial: 'true',
      path: 'appointment/booking-9',
    })).toEqual({
      pathname: '/(client)/appointment/booking-9',
      params: {},
    });
  });

  it('percent-encodes dynamic values instead of letting them add segments', () => {
    expect(guardedRoute(['(client)', 'appointment', '[id]'], { id: 'a/b' })).toEqual({
      pathname: '/(client)/appointment/a%2Fb',
      params: {},
    });
  });
});

describe('loginRedirectHref', () => {
  it('hands login the requested route when it can be described', () => {
    expect(loginRedirectHref(['(client)', '(tabs)', 'appointments'])).toEqual({
      pathname: '/(auth)/login',
      params: { redirect: '/(client)/(tabs)/appointments' },
    });
  });

  it('falls back to a plain login href when the router state is incomplete', () => {
    expect(loginRedirectHref(['(client)', 'appointment', '[id]'])).toBe('/(auth)/login');
  });
});

describe('goBackOrHome', () => {
  it('returns to the previous screen when there is history', () => {
    const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };

    goBackOrHome(router as never);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to the public home when the screen has no history', () => {
    const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };

    goBackOrHome(router as never);

    expect(router.replace).toHaveBeenCalledWith('/(guest)/home');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('falls back to custom href when provided and screen has no history', () => {
    const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };

    goBackOrHome(router as never, '/(client)/(tabs)/home');

    expect(router.replace).toHaveBeenCalledWith('/(client)/(tabs)/home');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('prefers going back over custom fallback when history exists', () => {
    const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };

    goBackOrHome(router as never, '/(client)/(tabs)/home');

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
