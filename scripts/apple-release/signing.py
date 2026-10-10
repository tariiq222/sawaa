"""Validate existing App Store signing inputs, without emitting key material."""
import datetime, hashlib, json, plistlib, subprocess, sys
from pathlib import Path

def validate_profile(p):
 ent=p.get('Entitlements', {})
 expected={'application-identifier':'569M49FYA6.sa.sawa.app','com.apple.developer.team-identifier':'569M49FYA6','get-task-allow':False,'aps-environment':'production','com.apple.developer.in-app-payments':['merchant.sa.sawa.app']}
 if p.get('TeamIdentifier') != ['569M49FYA6'] or any(ent.get(k)!=v for k,v in expected.items()):raise ValueError('Signing identity/capability mismatch')
 if p.get('ProvisionedDevices') or p.get('ProvisionsAllDevices'):raise ValueError('App Store profile required')
 if p.get('ExpirationDate', datetime.datetime.min)<=datetime.datetime.utcnow():raise ValueError('Profile expired')
 if not p.get('DeveloperCertificates'):raise ValueError('Profile certificate missing')
 return {'uuid':p['UUID'],'name':p['Name'],'certificateSha1':[hashlib.sha1(c).hexdigest().upper() for c in p['DeveloperCertificates']]}

if __name__=='__main__':
 p=plistlib.loads(subprocess.check_output(['security','cms','-D','-i',sys.argv[1]],stderr=subprocess.DEVNULL))
 result=validate_profile(p)
 identities=subprocess.check_output(['security','find-identity','-v','-p','codesigning',sys.argv[2]],text=True)
 matches=[s for s in result['certificateSha1'] if s in identities]
 if len(matches)!=1:raise ValueError('Exactly one matching signing identity required')
 result['identity']=matches[0]
 Path(sys.argv[3]).write_text(json.dumps(result))
