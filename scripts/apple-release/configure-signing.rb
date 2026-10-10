require 'json'
require 'xcodeproj'
path, metadata_path, output = ARGV
metadata = JSON.parse(File.read(metadata_path))
project = Xcodeproj::Project.open(path)
apps = project.targets.select { |target| target.product_type == 'com.apple.product-type.application' }
raise 'Exactly one app target required' unless apps.length == 1
app = apps.first
app.build_configurations.each do |config|
  next unless config.name == 'Release'
  settings = config.build_settings
  raise 'App bundle mismatch' unless settings['PRODUCT_BUNDLE_IDENTIFIER'] == 'sa.sawa.app'
  settings['CODE_SIGN_STYLE'] = 'Manual'
  settings['DEVELOPMENT_TEAM'] = '569M49FYA6'
  settings['CODE_SIGN_IDENTITY'] = metadata.fetch('identity')
  settings['PROVISIONING_PROFILE_SPECIFIER'] = metadata.fetch('uuid')
end
project.save
File.write(output, app.name)
