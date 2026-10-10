"""Verify a signed Sawaa IPA before allowing upload. Never emits signing material."""
from pathlib import Path
import datetime
import hashlib
import json
import plistlib
import re
import subprocess
import sys
import tempfile
import zipfile

BUNDLE = 'sa.sawa.app'
TEAM = '569M49FYA6'
MERCHANT = 'merchant.sa.sawa.app'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def verify_identity(info, ent, profile, version, build):
    require(info.get('CFBundleIdentifier') == BUNDLE, 'Bundle identity mismatch')
    require(info.get('CFBundleShortVersionString') == version and info.get('CFBundleVersion') == build, 'Version/build mismatch')
    require(info.get('ITSAppUsesNonExemptEncryption') is False, 'Encryption declaration missing')
    require(ent.get('application-identifier') == TEAM + '.' + BUNDLE, 'Application identity mismatch')
    require(ent.get('com.apple.developer.team-identifier') == TEAM, 'Signing team mismatch')
    require(ent.get('get-task-allow') is False, 'Development signing is forbidden')
    require(ent.get('aps-environment') == 'production', 'APNS capability mismatch')
    require(ent.get('com.apple.developer.in-app-payments') == [MERCHANT], 'Apple Pay capability mismatch')
    require(profile.get('TeamIdentifier') == [TEAM], 'Profile team mismatch')
    require(profile.get('ExpirationDate', datetime.datetime.min) > datetime.datetime.utcnow(), 'Profile expired')
    require(not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'App Store profile required')
    require(bool(profile.get('DeveloperCertificates')), 'Profile certificate missing')
    for key in ['application-identifier', 'com.apple.developer.team-identifier', 'get-task-allow', 'aps-environment', 'com.apple.developer.in-app-payments']:
        require(profile.get('Entitlements', {}).get(key) == ent.get(key), 'Profile entitlement mismatch: ' + key)

def verify_api(bundle, environment):
    require(environment in ['staging', 'production'], 'Unknown release environment')
    expected = ('https://' + ('staging' if environment == 'staging' else 'api') + '.sawaa.sa/api/v1').encode()
    other = ('https://' + ('api' if environment == 'staging' else 'staging') + '.sawaa.sa/api/v1').encode()
    require(expected in bundle and other not in bundle, 'Runtime API target mismatch')

def verify_payment_registration(contents):
    count = sum(len(re.findall(r"requireNativeComponent\s*\(\s*['\"]PKPaymentButton['\"]", c or '')) for c in contents)
    require(count == 1, 'Apple Pay native view must be registered once')

def cms(path):
    return plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(path)], stderr=subprocess.DEVNULL))

def verify(ipa, environment, version, build, sha, profile_path, sourcemap):
    require(re.fullmatch('[a-f0-9]{40}', sha) is not None, 'Full source SHA required')
    with zipfile.ZipFile(ipa) as archive:
        require(archive.testzip() is None, 'Corrupt IPA')
        require(all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in archive.namelist()), 'Unsafe IPA paths')
    with tempfile.TemporaryDirectory(prefix='sawaa-ipa-') as tmp:
        subprocess.run(['ditto', '-x', '-k', str(ipa), tmp], check=True)
        apps = list((Path(tmp) / 'Payload').glob('*.app'))
        require(len(apps) == 1, 'One app payload required')
        app = apps[0]
        info = plistlib.loads((app / 'Info.plist').read_bytes())
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True, capture_output=True)
        ent = plistlib.loads(subprocess.check_output(['codesign', '-d', '--entitlements', ':-', str(app)], stderr=subprocess.DEVNULL))
        embedded = cms(app / 'embedded.mobileprovision')
        supplied = cms(profile_path)
        verify_identity(info, ent, embedded, version, build)
        require(embedded['UUID'] == supplied['UUID'] and embedded['DeveloperCertificates'] == supplied['DeveloperCertificates'], 'Embedded profile differs from supplied profile')
        cert_prefix = Path(tmp) / 'certificate-'
        subprocess.run(['codesign', '-d', '--extract-certificates=' + str(cert_prefix), str(app)], check=True, capture_output=True)
        leaf = Path(str(cert_prefix) + '0').read_bytes()
        require(leaf in supplied['DeveloperCertificates'], 'Signature certificate is not authorized by profile')
        expected_api = 'https://' + ('staging' if environment == 'staging' else 'api') + '.sawaa.sa/api/v1'
        require(info.get('SawaaApiUrl') == expected_api, 'Expo release API origin mismatch')
        require(info.get('SawaaSourceSha') == sha and info.get('SawaaReleaseEnvironment') == environment, 'Release provenance mismatch')
        bundles = list(app.glob('*.jsbundle'))
        require(len(bundles) == 1, 'Native JS bundle missing')
        verify_api(bundles[0].read_bytes(), environment)
        native = (app / info['CFBundleExecutable']).read_bytes()
        require(b'SawaaPayments' in native and b'PKPaymentAuthorizationController' in native, 'Native payment module missing')
        firebase = plistlib.loads((app / 'GoogleService-Info.plist').read_bytes())
        require(firebase.get('BUNDLE_ID') == BUNDLE, 'Firebase app mismatch')
        require(sum('IBMPlexSansArabic' in f.name for f in app.rglob('*') if f.is_file()) >= 4, 'Arabic fonts missing')
        source_map = json.loads(Path(sourcemap).read_text())
        verify_payment_registration(source_map.get('sourcesContent', []))
        return {
            'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'sourceSha': sha, 'environment': environment, 'bundleIdentifier': BUNDLE,
            'version': version, 'buildNumber': build, 'sdk': info.get('DTSDKName'),
            'profileId': embedded['UUID'], 'team': TEAM,
            'ipaSha256': hashlib.sha256(Path(ipa).read_bytes()).hexdigest(),
            'signatureVerified': True, 'runtimeApiVerified': True, 'nativePaymentVerified': True,
        }

if __name__ == '__main__':
    ipa, environment, version, build, sha, profile_path, sourcemap, output = sys.argv[1:]
    result = verify(Path(ipa), environment, version, build, sha, Path(profile_path), Path(sourcemap))
    Path(output).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['environment', 'sourceSha', 'version', 'buildNumber', 'ipaSha256']}))
