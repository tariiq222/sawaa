const path = require('node:path');
const { createRequire } = require('node:module');

describe('Metro image dimension compatibility', () => {
  it('reads dimensions from the image paths Metro passes to image-size', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const expoMetroConfigPath = createRequire(
      path.join(projectRoot, 'package.json'),
    ).resolve('expo/metro-config');
    const expoRequire = createRequire(expoMetroConfigPath);
    const metroEntryPath = expoRequire.resolve('metro');
    const metroRequire = createRequire(metroEntryPath);
    const imageSizeModule = metroRequire('image-size');
    const imageSize =
      imageSizeModule.default ?? imageSizeModule.imageSize ?? imageSizeModule;
    const imagePath = path.join(projectRoot, 'assets', 'bg-aqua.png');

    expect(imageSize(imagePath)).toMatchObject({ width: 853, height: 1844 });
  });
});
