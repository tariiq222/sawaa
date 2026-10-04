const { createRunOncePlugin, withMod } = require('expo/config-plugins');
const { version } = require('../package.json');

// Expo's legacy splash storyboard can resolve its named background to white
// while Metro is bundling. An explicit storyboard color keeps the letterbox
// around our square artwork the same teal as the artwork itself.
function splashColor(hex) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid iOS splash background color: ${hex}`);
  return {
    key: 'backgroundColor',
    red: String(parseInt(match[1], 16) / 255),
    green: String(parseInt(match[2], 16) / 255),
    blue: String(parseInt(match[3], 16) / 255),
    alpha: '1',
    colorSpace: 'custom',
    customColorSpace: 'sRGB',
  };
}

function applySplashBackground(storyboard, hex) {
  const view = storyboard.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
  const colors = view.color?.filter((entry) => entry.$?.key === 'backgroundColor') ?? [];
  if (colors.length !== 1) throw new Error('Expected one splash storyboard background color');
  colors[0].$ = splashColor(hex);
  return storyboard;
}

function withIosSplashBackground(config) {
  return withMod(config, { platform: 'ios', mod: 'splashScreenStoryboard', action: (mod) => {
    const hex = mod.splash?.backgroundColor;
    if (!hex) throw new Error('The iOS splash backgroundColor is required');
    mod.modResults = applySplashBackground(mod.modResults, hex);
    return mod;
  } });
}

module.exports = createRunOncePlugin(withIosSplashBackground, 'with-ios-splash-background', version);
module.exports.applySplashBackground = applySplashBackground;
