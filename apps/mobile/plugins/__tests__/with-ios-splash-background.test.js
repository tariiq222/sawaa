const { applySplashBackground } = require('../with-ios-splash-background');

function storyboard() {
  return {
    document: {
      scenes: [{ scene: [{ objects: [{ viewController: [{ view: [{ color: [{ $: { key: 'backgroundColor', name: 'SplashScreenBackground' } }] }] }] }] }] }],
    },
  };
}

describe('iOS splash background', () => {
  it('writes an explicit full-screen color and stays stable on a second pass', () => {
    const xml = storyboard();
    applySplashBackground(xml, '#14a89a');
    const color = xml.document.scenes[0].scene[0].objects[0].viewController[0].view[0].color[0].$;
    expect(color).toEqual({
      key: 'backgroundColor',
      red: String(20 / 255),
      green: String(168 / 255),
      blue: String(154 / 255),
      alpha: '1',
      colorSpace: 'custom',
      customColorSpace: 'sRGB',
    });
    expect(applySplashBackground(xml, '#14a89a')).toBe(xml);
  });

  it('fails if Expo changes the storyboard contract', () => {
    expect(() => applySplashBackground(storyboard(), 'teal')).toThrow('Invalid iOS splash background color');
    const xml = storyboard();
    xml.document.scenes[0].scene[0].objects[0].viewController[0].view[0].color = [];
    expect(() => applySplashBackground(xml, '#14a89a')).toThrow('Expected one splash storyboard background color');
  });
});
