// Focused native-config check. Requires Ruby, which is part of the iOS build toolchain.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const withIosPodDeploymentTarget = require('../plugins/with-ios-pod-deployment-target');

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

async function main() {
  const firstResult = await applyPodfileMod(generatedPodfile);
  const secondResult = await applyPodfileMod(firstResult.modResults.contents);
  const contents = secondResult.modResults.contents;
  const marker = '# Sawaa: Keep every CocoaPods target within the supported iOS floor.';
  const markerIndex = contents.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'config plugin inserted the target floor');
  assert.equal(contents.indexOf(marker, markerIndex + marker.length), -1, 'plugin is idempotent');

  const insertedLines = contents.slice(markerIndex).split('\n');
  const floorLines = [insertedLines[0]];
  for (const line of insertedLines.slice(1)) {
    floorLines.push(line);
    if (line === '    end') break;
  }

  const rubyScript = `
BuildConfiguration = Struct.new(:build_settings)
Target = Struct.new(:build_configurations)
Project = Struct.new(:targets)
Installer = Struct.new(:pods_project)
targets = [
  Target.new([BuildConfiguration.new({'IPHONEOS_DEPLOYMENT_TARGET' => '13.4'})]),
  Target.new([BuildConfiguration.new({'IPHONEOS_DEPLOYMENT_TARGET' => '15.1'})]),
  Target.new([BuildConfiguration.new({'IPHONEOS_DEPLOYMENT_TARGET' => '17.0'})]),
  Target.new([BuildConfiguration.new({})]),
]
installer = Installer.new(Project.new(targets))
${floorLines.slice(1).join('\n')}
puts targets.map { |target| target.build_configurations.first.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || 'unset' }.join(',')
`;

  const output = execFileSync('ruby', ['-e', rubyScript], { encoding: 'utf8' });
  assert.equal(output.trim(), '15.1,15.1,17.0,unset');
  process.stdout.write('Pod target floor check passed: 13.4→15.1; 15.1 and 17.0 preserved; unset inherited.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
