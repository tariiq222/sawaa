require 'digest'
require 'fileutils'
require 'rubygems/package'
require 'tmpdir'

version = '1.17.0'
checksum = 'a9e3d0dd36ab1b48935236d77a15cad9171217f13c6010c8e2ae3c0f455daf5b'
archive = ARGV.shift
abort 'Usage: prepare-cocoapods-core.rb [gem archive]' unless ARGV.empty?

vendor = File.join(__dir__, 'vendor')
target = File.join(vendor, 'cocoapods-core')
marker_name = '.sawaa-generated-core'
FileUtils.mkdir_p(vendor)

Dir.mktmpdir('cocoapods-core-', vendor) do |temporary|
  unless archive
    archive = File.join(temporary, "cocoapods-core-#{version}.gem")
    system('curl', '--fail', '--silent', '--show-error', '--location',
      '--proto', '=https', '--proto-redir', '=https', '--max-time', '60',
      '--output', archive, "https://rubygems.org/downloads/cocoapods-core-#{version}.gem",
      exception: true)
  end
  abort 'CocoaPods Core archive checksum does not match the locked upstream gem' unless Digest::SHA256.file(archive).hexdigest == checksum

  package = Gem::Package.new(archive)
  spec = package.spec
  dependency = spec.runtime_dependencies.find { |entry| entry.name == 'activesupport' }
  abort 'Unexpected CocoaPods Core package or dependency' unless spec.name == 'cocoapods-core' &&
    spec.version.to_s == version && dependency&.requirement&.to_s == '>= 5.0, < 8'

  # Keep the upstream CocoaPods code and permit the tested, patched ActiveSupport line.
  spec.dependencies.delete(dependency)
  spec.add_runtime_dependency('activesupport', '>= 8.1.4.1', '< 8.2')
  prepared = File.join(temporary, 'prepared')
  package.extract_files(prepared)
  File.write(File.join(prepared, 'cocoapods-core.gemspec'), spec.to_ruby)
  File.write(File.join(prepared, marker_name), checksum)

  if File.exist?(target) || File.symlink?(target)
    marker = File.join(target, marker_name)
    abort 'Refusing to replace an unrecognized CocoaPods Core directory' unless !File.symlink?(target) &&
      File.file?(marker) && File.read(marker) == checksum
    FileUtils.remove_entry_secure(target)
  end
  File.rename(prepared, target)
end
