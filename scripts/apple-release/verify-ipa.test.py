import importlib.util
from pathlib import Path
import unittest
import datetime

class IdentityTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('verify_ipa', Path(__file__).with_name('verify-ipa.py'))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def fixture(self):
        ent = {'application-identifier': '569M49FYA6.sa.sawa.app', 'com.apple.developer.team-identifier': '569M49FYA6', 'get-task-allow': False, 'aps-environment': 'production', 'com.apple.developer.in-app-payments': ['merchant.sa.sawa.app']}
        info = {'CFBundleIdentifier': 'sa.sawa.app', 'CFBundleVersion': '36', 'CFBundleShortVersionString': '1.0.0', 'ITSAppUsesNonExemptEncryption': False}
        profile = {'TeamIdentifier': ['569M49FYA6'], 'Entitlements': ent.copy(), 'ExpirationDate': datetime.datetime(2030, 1, 1), 'DeveloperCertificates': [b'certificate'], 'UUID': 'profile-current'}
        return info, ent, profile

    def test_wrong_identity_or_development_signing_is_rejected(self):
        mod = self.module()
        info, ent, profile = self.fixture()
        mod.verify_identity(info, ent, profile, '1.0.0', '36')
        for key, value in [('get-task-allow', True), ('aps-environment', 'development'), ('com.apple.developer.in-app-payments', []), ('application-identifier', 'OTHER.sa.sawa.app')]:
            bad = ent.copy(); bad[key] = value
            with self.assertRaises(ValueError): mod.verify_identity(info, bad, profile, '1.0.0', '36')
        with self.assertRaises(ValueError): mod.verify_identity(info, ent, profile, '1.0.0', '37')
        profile['ExpirationDate'] = datetime.datetime(2020, 1, 1)
        with self.assertRaises(ValueError): mod.verify_identity(info, ent, profile, '1.0.0', '36')

    def test_runtime_bundle_rejects_swapped_or_missing_api(self):
        mod = self.module()
        mod.verify_api(b'config:https://staging.sawaa.sa/api/v1', 'staging')
        for payload in [b'https://api.sawaa.sa/api/v1', b'no configured URL', b'https://staging.sawaa.sa/api/v1 https://api.sawaa.sa/api/v1']:
            with self.assertRaises(ValueError): mod.verify_api(payload, 'staging')

if __name__ == '__main__': unittest.main()
