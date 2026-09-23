const withIosPodDeploymentTarget = require('../with-ios-pod-deployment-target');

const generatedPodfile = `
target 'SawaApp' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

async function applyPodfileMod(contents) {
  const config = withIosPodDeploymentTarget({
    name: 'Sawa test',
    slug: 'sawa-test',
    version: '1.0.0',
  });

  return config.mods.ios.podfile({
    modResults: { contents },
    modRequest: { projectRoot: process.cwd(), platformProjectRoot: process.cwd() },
  });
}

describe('iOS CocoaPods deployment target config plugin', () => {
  it('floors old pod targets at iOS 15.1 and preserves later or inherited targets', async () => {
    const firstResult = await applyPodfileMod(generatedPodfile);
    const firstContents = firstResult.modResults.contents;
    const secondResult = await applyPodfileMod(firstContents);
    const contents = secondResult.modResults.contents;
    const marker = '# Sawaa: Keep every CocoaPods target within the supported iOS floor.';
    const markerIndex = contents.indexOf(marker);

    expect(markerIndex).toBeGreaterThanOrEqual(0);
    expect(contents.indexOf(marker, markerIndex + marker.length)).toBe(-1);
    expect(contents).toContain(
      "if current_target && Gem::Version.new(current_target) < Gem::Version.new('15.1')",
    );
    expect(contents).toContain(
      "build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'",
    );
  });
});
