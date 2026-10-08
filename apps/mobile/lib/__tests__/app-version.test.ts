import { getAppVersion } from '../app-version';
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
const config = { nativeApplicationVersion: null, nativeBuildVersion: null,
  expoConfig: { name: 'Fixture', slug: 'fixture', version: '2.0.0', ios: { buildNumber: '31' }, android: { versionCode: 42 } } };
it('uses Android configured build when native metadata is unavailable', () => {
  expect(getAppVersion(config as Parameters<typeof getAppVersion>[0], 'android'))
    .toEqual({ version: '2.0.0', buildNumber: '42' });
});
it('uses iOS configured build only on iOS', () => {
  expect(getAppVersion(config as Parameters<typeof getAppVersion>[0], 'ios'))
    .toEqual({ version: '2.0.0', buildNumber: '31' });
});
it('uses no platform build for web', () => {
  expect(getAppVersion(config as Parameters<typeof getAppVersion>[0], 'web'))
    .toEqual({ version: '2.0.0', buildNumber: '—' });
});
it('native metadata outranks configuration', () => {
  expect(getAppVersion({ ...config, nativeApplicationVersion: '3.0.0', nativeBuildVersion: '77' } as Parameters<typeof getAppVersion>[0], 'android'))
    .toEqual({ version: '3.0.0', buildNumber: '77' });
});
it('shows unavailable marks instead of fabricated metadata', () => {
  expect(getAppVersion({ nativeApplicationVersion: null, nativeBuildVersion: null, expoConfig: null }))
    .toEqual({ version: '—', buildNumber: '—' });
});
it('reads the official native application module before mutable config', () => {
  expect(getAppVersion(config, 'ios', { nativeApplicationVersion: '4.0.0', nativeBuildVersion: '88' }))
    .toEqual({ version: '4.0.0', buildNumber: '88' });
});
it('uses the embedded iOS build when the optional native module is absent', () => {
  expect(getAppVersion({ ...config, platform: { ios: { buildNumber: '55' } } } as Parameters<typeof getAppVersion>[0], 'ios'))
    .toEqual({ version: '2.0.0', buildNumber: '55' });
});
