"""Fail the build after signing setup; verify recovery of existing user state."""
import subprocess,tempfile,os,pathlib,json,plistlib,datetime,hashlib,unittest
class CleanupTest(unittest.TestCase):
 def test_failed_build_restores_profile_keychain_and_removes_session(self):
  with tempfile.TemporaryDirectory() as d:
   r=pathlib.Path(d);mock=r/'bin';mock.mkdir();profile=r/'profiles';profile.mkdir();old=profile/'test-profile.mobileprovision';old.write_text('original')
   ent={'application-identifier':'569M49FYA6.sa.sawa.app','com.apple.developer.team-identifier':'569M49FYA6','get-task-allow':False,'aps-environment':'production','com.apple.developer.in-app-payments':['merchant.sa.sawa.app']}
   p={'UUID':'test-profile','Name':'Sawaa store','TeamIdentifier':['569M49FYA6'],'ExpirationDate':datetime.datetime.utcnow()+datetime.timedelta(days=1),'DeveloperCertificates':[b'certificate'],'Entitlements':ent}
   (r/'decoded.plist').write_bytes(plistlib.dumps(p));(r/'input.mobileprovision').write_text('new');(r/'password').write_text('fake')
   security=mock/'security';security.write_text('''#!/usr/bin/env python3
import sys,os,json,pathlib
r=pathlib.Path(os.environ['MOCK_ROOT']);args=sys.argv[1:]
with (r/'calls.jsonl').open('a') as f:f.write(json.dumps(args)+'\\n')
if args[0]=='cms':sys.stdout.buffer.write((r/'decoded.plist').read_bytes())
if args[0]=='find-identity':print('''+repr(hashlib.sha1(b'certificate').hexdigest().upper())+''')
if args[0]=='list-keychains' and '-s' not in args:print('"/original.keychain"')
''');security.chmod(0o755)
   pnpm=mock/'pnpm';pnpm.write_text('#!/bin/sh\nexit 23\n');pnpm.chmod(0o755)
   env=dict(os.environ,PATH=str(mock)+':'+os.environ['PATH'],MOCK_ROOT=d,TMPDIR=d,GITHUB_SHA='a'*40,GITHUB_REF_NAME='develop',IOS_BUILD_NUMBER='36',APPLE_P12_PATH=str(r/'fake.p12'),APPLE_P12_PASSWORD_FILE=str(r/'password'),APPLE_PROFILE_PATH=str(r/'input.mobileprovision'),FIREBASE_IOS_GOOGLE_SERVICES_FILE=str(r/'firebase'),APPLE_OUTPUT_DIR=str(r/'output'),APPLE_PROFILE_DIRECTORY=str(profile))
   result=subprocess.run(['bash',str(pathlib.Path(__file__).with_name('build-ios.sh'))],env=env,capture_output=True)
   self.assertEqual(result.returncode,23,result.stderr.decode());self.assertEqual(old.read_text(),'original');self.assertEqual(list(r.glob('sawaa-signing.*')),[])
   calls=[json.loads(x) for x in (r/'calls.jsonl').read_text().splitlines()]
   self.assertTrue(any(x[:4]==['list-keychains','-d','user','-s'] and x[-1]=='/original.keychain' and len(x)==5 for x in calls));self.assertTrue(any(x[0]=='delete-keychain' for x in calls))
unittest.main()
