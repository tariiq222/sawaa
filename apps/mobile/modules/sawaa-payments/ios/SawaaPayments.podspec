Pod::Spec.new do |s|
  s.name = 'SawaaPayments'
  s.version = '1.0.0'
  s.summary = 'Sawaa Apple Pay device capability check'
  s.description = 'Exposes a fail-closed PassKit network capability check to Expo.'
  s.author = 'Sawaa'
  s.homepage = 'https://sawa.sa'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
