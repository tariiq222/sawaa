import importlib.util, pathlib, unittest, plistlib, datetime, tempfile
path=pathlib.Path(__file__).with_name('signing.py')
spec=importlib.util.spec_from_file_location('signing',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SigningTest(unittest.TestCase):
 def fixture(self):
  return {'UUID':'test-profile','Name':'Sawaa store','TeamIdentifier':['569M49FYA6'],'ExpirationDate':datetime.datetime.utcnow()+datetime.timedelta(days=1),'DeveloperCertificates':[b'certificate'],'Entitlements':{'application-identifier':'569M49FYA6.sa.sawa.app','com.apple.developer.team-identifier':'569M49FYA6','get-task-allow':False,'aps-environment':'production','com.apple.developer.in-app-payments':['merchant.sa.sawa.app']}}
 def test_profile(self):
  p=self.fixture(); self.assertEqual(m.validate_profile(p)['uuid'],'test-profile')
  for mutation in [{'TeamIdentifier':['wrong']},{'ProvisionedDevices':['device']},{'ExpirationDate':datetime.datetime.utcnow()-datetime.timedelta(days=1)},{'DeveloperCertificates':[]}]:
   with self.assertRaises(ValueError):m.validate_profile(p|mutation)
 def test_capability(self):
  p=self.fixture();p['Entitlements']['get-task-allow']=True
  with self.assertRaises(ValueError):m.validate_profile(p)
unittest.main()
