const withIosSceneLifecycle = require('../with-ios-scene-lifecycle');

const original = `import Expo
import React
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  func launch(_ launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let factory = makeFactory()
    reactNativeFactory = factory
    window = UIWindow(frame: UIScreen.main.bounds)
    FirebaseApp.configure()
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  func existingLinkHandler() { preserveMe() }
}
`;

async function apply(source = original, infoPlist = {}) {
  const config = withIosSceneLifecycle({ name: 'Sawaa', slug: 'sawa' });
  const request = { projectRoot: process.cwd(), platformProjectRoot: process.cwd() };
  const delegate = await config.mods.ios.appDelegate({
    modResults: { contents: source, language: 'swift' }, modRequest: request,
  });
  const plist = await config.mods.ios.infoPlist({ modResults: infoPlist, modRequest: request });
  return { source: delegate.modResults.contents, plist: plist.modResults };
}

describe('iOS scene lifecycle config plugin', () => {
  it('declares a single application scene without replacing unrelated plist settings', async () => {
    const result = await apply(original, { CFBundleURLTypes: [{ CFBundleURLSchemes: ['sawa'] }] });
    expect(result.plist.CFBundleURLTypes).toEqual([{ CFBundleURLSchemes: ['sawa'] }]);
    expect(result.plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Sawaa',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SawaaSceneDelegate',
        }],
      },
    });
  });

  it('moves window startup to the scene and preserves provider setup and existing link handlers', async () => {
    const { source } = await apply();
    const appDelegate = source.split('class SawaaSceneDelegate')[0];
    expect(appDelegate).not.toContain('factory.startReactNative(');
    expect(appDelegate).not.toContain('UIWindow(frame:');
    expect(appDelegate).toContain('FirebaseApp.configure()');
    expect(appDelegate).toContain('func existingLinkHandler() { preserveMe() }');
    expect(appDelegate).toContain('sceneLaunchOptions = launchOptions');
    expect(source).toContain('UIWindow(windowScene: windowScene)');
    expect(source.match(/factory\.startReactNative\(/g)).toHaveLength(1);
  });

  it('can regenerate the same native project without duplicating the scene or startup', async () => {
    const first = await apply();
    const second = await apply(first.source, first.plist);
    expect(second).toEqual(first);
  });

  it('refuses an unrecognized startup template instead of generating an app with two runtimes', async () => {
    await expect(apply(original.replace('in: window,', 'in: customWindow,')))
      .rejects.toThrow(/startup/);
  });

  it('refuses to overwrite a different scene configuration', async () => {
    await expect(apply(original, { UIApplicationSceneManifest: { custom: true } }))
      .rejects.toThrow(/scene manifest/);
  });
});
