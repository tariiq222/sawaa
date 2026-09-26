const { readFileSync } = require('node:fs');
const { createRunOncePlugin, withAppDelegate, withInfoPlist } = require('expo/config-plugins');
const { version } = require('../package.json');

const marker = '// Sawaa: scene lifecycle adapter for Expo SDK 55.';
const sceneManifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [{
      UISceneConfigurationName: 'Sawaa',
      UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SawaaSceneDelegate',
    }],
  },
};

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    const existing = mod.modResults.UIApplicationSceneManifest;
    if (existing && JSON.stringify(existing) !== JSON.stringify(sceneManifest)) {
      throw new Error('Sawaa scene lifecycle: refusing to overwrite an existing scene manifest.');
    }
    mod.modResults.UIApplicationSceneManifest = sceneManifest;
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    let { contents, language } = mod.modResults;
    if (language !== 'swift') {
      throw new Error('Sawaa scene lifecycle requires a Swift AppDelegate.');
    }
    if (contents.includes(marker)) return mod;

    const windowCreation = /window = UIWindow\(frame: UIScreen\.main\.bounds\)/;
    const startup = /factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)/;
    const windowProperty = /var window: UIWindow\?/;
    if (!windowCreation.test(contents) || !startup.test(contents) || !windowProperty.test(contents)) {
      throw new Error('Sawaa scene lifecycle: unrecognized Expo startup; review the generated AppDelegate.');
    }

    contents = contents
      .replace(windowProperty, 'var window: UIWindow?\n  var sceneLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?')
      .replace(windowCreation, '// The scene owns the window.')
      .replace(startup, 'sceneLaunchOptions = launchOptions');
    // Keep this class in the existing compiled file so prebuild needs no manual
    // Xcode target membership and preserves other plugins' AppDelegate hooks.
    mod.modResults.contents = `${contents.trimEnd()}\n\n${readFileSync(require.resolve('./ios-scene-delegate.swift'), 'utf8')}`;
    return mod;
  });
}

module.exports = createRunOncePlugin(withIosSceneLifecycle, 'with-ios-scene-lifecycle', version);
