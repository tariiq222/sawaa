const { createRunOncePlugin, withPodfile } = require('expo/config-plugins');
const { version } = require('../package.json');

const deploymentTarget = '15.1';
const marker = '# Sawaa: Keep every CocoaPods target within the supported iOS floor.';

function withIosPodDeploymentTarget(config) {
  return withPodfile(config, (podfileConfig) => {
    let { contents } = podfileConfig.modResults;

    if (!contents.includes(marker)) {
      const postInstallCall = contents.match(
        /\n([ \t]*)react_native_post_install\([\s\S]*?\n\1\)/,
      );

      if (!postInstallCall) {
        throw new Error(
          'Could not find react_native_post_install in the generated iOS Podfile.',
        );
      }

      const indentation = postInstallCall[1];
      const floorPodTargets = [
        marker,
        `${indentation}installer.pods_project.targets.each do |target|`,
        `${indentation}  target.build_configurations.each do |build_configuration|`,
        `${indentation}    current_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']`,
        `${indentation}    if current_target && Gem::Version.new(current_target) < Gem::Version.new('${deploymentTarget}')`,
        `${indentation}      build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`,
        `${indentation}    end`,
        `${indentation}  end`,
        `${indentation}end`,
      ].join('\n');

      contents = contents.replace(
        postInstallCall[0],
        `${postInstallCall[0]}\n${floorPodTargets}`,
      );
    }

    podfileConfig.modResults.contents = contents;
    return podfileConfig;
  });
}

module.exports = createRunOncePlugin(
  withIosPodDeploymentTarget,
  'with-ios-pod-deployment-target',
  version,
);
