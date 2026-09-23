import { resolveApiUrl } from './config';

describe('resolveApiUrl', () => {
  it('uses the documented local backend default during development', () => {
    expect(resolveApiUrl({ nodeEnv: 'development' })).toBe('http://localhost:5200/api/v1');
  });

  it('rejects a missing API URL for production configuration', () => {
    expect(() => resolveApiUrl({ easBuildProfile: 'production' })).toThrow(
      'EXPO_PUBLIC_API_URL is required for production builds',
    );
  });

  it('rejects HTTP and local or private production API targets', () => {
    expect(() => resolveApiUrl({ nodeEnv: 'production', configuredApiUrl: 'http://api.sawaa.sa/api/v1' })).toThrow(
      'must use HTTPS',
    );
    expect(() => resolveApiUrl({ nodeEnv: 'production', configuredApiUrl: 'https://localhost/api/v1' })).toThrow(
      'must not target a local or private host',
    );
    expect(() => resolveApiUrl({ nodeEnv: 'production', configuredApiUrl: 'https://10.0.0.5/api/v1' })).toThrow(
      'must not target a local or private host',
    );
  });

  it('accepts an explicit public HTTPS production API URL', () => {
    expect(
      resolveApiUrl({
        nodeEnv: 'production',
        configuredApiUrl: 'https://api.sawaa.sa/api/v1',
      }),
    ).toBe('https://api.sawaa.sa/api/v1');
  });

  it('accepts public DNS names and rejects IPv6 loopback or ULA literals', () => {
    expect(
      resolveApiUrl({
        nodeEnv: 'production',
        configuredApiUrl: 'https://fcm.example.com/api/v1',
      }),
    ).toBe('https://fcm.example.com/api/v1');
    expect(() => resolveApiUrl({ nodeEnv: 'production', configuredApiUrl: 'https://[::1]/api/v1' })).toThrow(
      'must not target a local or private host',
    );
    expect(() => resolveApiUrl({ nodeEnv: 'production', configuredApiUrl: 'https://[fd00::1]/api/v1' })).toThrow(
      'must not target a local or private host',
    );
  });
});
