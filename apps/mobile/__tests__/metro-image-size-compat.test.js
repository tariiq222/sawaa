const { spawnSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

function getReactNativeMetroAssets(projectRoot) {
  const mobileRequire = createRequire(path.join(projectRoot, 'package.json'));
  const reactNativePackagePath = mobileRequire.resolve(
    'react-native/package.json',
  );
  const reactNativePackage = require(reactNativePackagePath);
  let communityCliPluginPackagePath;

  try {
    communityCliPluginPackagePath = createRequire(
      reactNativePackagePath,
    ).resolve('@react-native/community-cli-plugin/package.json');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }

    // pnpm keeps this peer dependency in its virtual store instead of linking
    // it next to react-native.
    const pnpmStorePath = path.join(projectRoot, 'node_modules', '.pnpm');
    const communityCliPlugin = fs
      .readdirSync(pnpmStorePath)
      .find((entry) =>
        entry.startsWith(
          `@react-native+community-cli-plugin@${reactNativePackage.version}`,
        ),
      );

    if (!communityCliPlugin) {
      throw new Error('React Native community CLI plugin is not installed');
    }

    communityCliPluginPackagePath = path.join(
      pnpmStorePath,
      communityCliPlugin,
      'node_modules',
      '@react-native',
      'community-cli-plugin',
      'package.json',
    );
  }
  const metroEntryPath = createRequire(communityCliPluginPackagePath).resolve(
    'metro',
  );

  const metroAssetsPath = path.join(path.dirname(metroEntryPath), 'Assets.js');

  return {
    metroAssets: require(metroAssetsPath),
    metroAssetsPath,
  };
}

describe('Metro image dimension compatibility', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const { metroAssets, metroAssetsPath } =
    getReactNativeMetroAssets(projectRoot);

  it('reads dimensions through React Native Metro asset processing', async () => {
    const imagePath = path.join(projectRoot, 'assets', 'bg-aqua.png');

    await expect(
      metroAssets.getAssetData(imagePath, 'bg-aqua.png', [], 'ios', '/assets'),
    ).resolves.toMatchObject({ width: 853, height: 1844 });
  });

  it('reads the dark aqua background dimensions through Metro asset processing', async () => {
    const imagePath = path.join(projectRoot, 'assets', 'bg-aqua-dark.png');

    await expect(
      metroAssets.getAssetData(imagePath, 'bg-aqua-dark.png', [], 'ios', '/assets'),
    ).resolves.toMatchObject({ width: 848, height: 1855 });
  });

  it.each([
    {
      format: 'JXL',
      payload: Buffer.from([
        0, 0, 0, 12, // first box length
        0x4a, 0x58, 0x4c, 0x20, // JXL signature
        0, 0, 0, 0,
        0, 0, 0, 12, // ftyp box length
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x6a, 0x78, 0x6c, 0x20, // jxl brand
        0, 0, 0, 0, // zero-length jxlp box
        0x6a, 0x78, 0x6c, 0x70, // jxlp
      ]),
    },
    {
      format: 'ICNS',
      payload: Buffer.from([
        0x69, 0x63, 0x6e, 0x73, // icns
        0, 0, 0, 16, // file length
        0x69, 0x63, 0x70, 0x34, // icp4
        0, 0, 0, 0, // zero-length entry
      ]),
    },
  ])('rejects malformed $format assets without hanging Metro', ({ payload }) => {
    const tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'metro-image-size-'),
    );
    const imagePath = path.join(tempDirectory, 'malformed.png');
    fs.writeFileSync(imagePath, payload);

    try {
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          `require(${JSON.stringify(metroAssetsPath)})` +
            `.getAssetData(process.argv[1], 'malformed.png', [], 'ios', '/assets')` +
            `.then(() => process.exit(1), () => process.exit(0));`,
          imagePath,
        ],
        { timeout: 5000 },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
