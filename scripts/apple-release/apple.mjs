import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {releaseTarget} from './target.mjs';
import {assertCurrentSource} from './deployment.mjs';

const APP='6815632181',GROUP='e6c7ec75-2b70-471a-b07e-bec53443702d';
export function nextBuildNumber(values){
 if(values.some(v=>!/^\d+$/.test(v)))throw Error('Observed Apple build number must be numeric');
 const next=Math.max(35,...values.map(Number))+1;
 if(next>9999)throw Error('Apple build number range exhausted');return next;
}
export async function waitForValid(find,{timeoutMs=45*60*1000,intervalMs=30000,now=Date.now,sleep=delay}={}){
 const deadline=now()+timeoutMs;
 while(now()<deadline){const build=await find();const state=build?.attributes?.processingState;
  if(state==='VALID')return build;
  if(state==='INVALID'||state==='FAILED')throw Error(`Apple processing ${state}`);
  await sleep(Math.min(intervalMs,Math.max(0,deadline-now())));
 }throw Error('Apple processing timed out');
}
export async function uploadOnce({find,send,allowExisting=true,timeoutMs=20*60*1000,intervalMs=30000,now=Date.now,sleep=delay}){
 const existing=await find();if(existing){assert.ok(allowExisting,'Concurrent manual Apple build conflicts before upload');return existing;}
 // Exactly one transport call. Lost responses and nonzero altool exits are
 // reconciled against Apple; absence is NOT permission to resend the binary.
 try{await send();}catch{console.log('Upload response uncertain; querying exact Apple build');}
 const deadline=now()+timeoutMs;
 while(now()<deadline){const observed=await find();if(observed)return observed;await sleep(Math.min(intervalMs,Math.max(0,deadline-now())));}
 throw Error('Upload outcome uncertain: exact build not observed; automatic reupload blocked');
}
export async function recoverIntent(intent,expected,find){
 for(const key of ['sourceSha','environment','version'])assert.equal(intent[key],expected[key],'Prior upload intent identity mismatch');
 assert.match(intent.buildNumber,/^[1-9]\d{0,3}$/);assert.match(intent.ipaSha256,/^[a-f0-9]{64}$/);
 const build=await find();if(!build)throw Error('Prior upload intent not observed by Apple; rerun cannot reupload');
 return {...intent,mode:'resume',buildId:build.id};
}
export function appleClient({keyId,issuerId,key,request=fetch}){
 if(!keyId||!issuerId||!key)throw Error('Existing App Store Connect key required');
 return async function api(path,{method='GET',body}={}){
  assert.ok(path.startsWith('/v1/')&&!path.startsWith('//'),'Invalid Apple API path');
  const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);
  const unsigned=b({alg:'ES256',kid:keyId,typ:'JWT'})+'.'+b({iss:issuerId,iat:now,exp:now+300,aud:'appstoreconnect-v1'});
  const token=unsigned+'.'+crypto.sign('sha256',Buffer.from(unsigned),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const response=await request('https://api.appstoreconnect.apple.com'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw Error(`Apple API HTTP ${response.status}`);
  return response.status===204?{}:response.json();
 };
}
async function all(api,path){
 const rows=[];let included=[];
 for(let pages=0;path&&pages<100;pages++){
  const data=await api(path);assert.ok(Array.isArray(data.data),'Apple collection unavailable');rows.push(...data.data);included.push(...(data.included||[]));
  if(!data.links?.next)return {rows,included};
  const url=new URL(data.links.next);assert.equal(url.origin,'https://api.appstoreconnect.apple.com');path=url.pathname+url.search;
 }throw Error('Apple pagination limit reached');
}
export async function findBuild(api,version,number){
 assert.match(number,/^[1-9]\d{0,3}$/);
 const {rows,included}=await all(api,`/v1/builds?filter[app]=${APP}&filter[version]=${number}&include=preReleaseVersion&limit=200`);
 const matches=rows.filter(b=>included.some(v=>v.id===b.relationships?.preReleaseVersion?.data?.id&&v.attributes.version===version&&v.attributes.platform==='IOS'));
 assert.ok(matches.length<=1,'Apple build identity ambiguous');return matches[0]||null;
}
export async function distribute(api,build,notes,{now=Date.now,sleep=delay,timeoutMs=10*60*1000}={}){
 const id=build.id;
 await api(`/v1/builds/${id}`,{method:'PATCH',body:{data:{type:'builds',id,attributes:{usesNonExemptEncryption:false}}}});
 const {rows}=await all(api,`/v1/builds/${id}/betaBuildLocalizations?limit=200`);
 const existing=rows.find(x=>x.attributes.locale==='ar-SA');
 if(existing)await api(`/v1/betaBuildLocalizations/${existing.id}`,{method:'PATCH',body:{data:{type:'betaBuildLocalizations',id:existing.id,attributes:{whatsNew:notes}}}});
 else await api('/v1/betaBuildLocalizations',{method:'POST',body:{data:{type:'betaBuildLocalizations',attributes:{locale:'ar-SA',whatsNew:notes},relationships:{build:{data:{type:'builds',id}}}}}});
 let members=await all(api,`/v1/betaGroups/${GROUP}/builds?limit=200`);
 if(!members.rows.some(b=>b.id===id))await api(`/v1/betaGroups/${GROUP}/relationships/builds`,{method:'POST',body:{data:[{type:'builds',id}]}});
 const deadline=now()+timeoutMs;
 while(now()<deadline){
  members=await all(api,`/v1/betaGroups/${GROUP}/builds?limit=200`);
  const detail=await api(`/v1/builds/${id}/buildBetaDetail`);
  if(members.rows.some(b=>b.id===id)&&detail.data?.attributes?.internalBuildState==='IN_BETA_TESTING')return;
  await sleep(Math.min(30000,Math.max(0,deadline-now())));
 }throw Error('Apple internal-group availability timed out');
}
function altool(ipa){return new Promise((resolve,reject)=>{
 const child=spawn('xcrun',['altool','--upload-app','-f',ipa,'--type','ios','--apiKey',process.env.APPLE_ASC_KEY_ID,'--apiIssuer',process.env.APPLE_ASC_ISSUER_ID,'--output-format','json'],{stdio:['ignore','ignore','ignore'],env:process.env});
 const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Apple upload transport timeout'));},30*60*1000);
 child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(Error(`Apple upload transport exit ${code}`));});
});}
async function cli(){
 const command=process.argv[2],out=process.env.APPLE_OUTPUT_DIR;
 assert.ok(['allocate','intent','upload','resume'].includes(command),'Unknown Apple command');assert.ok(out,'Output directory required');
 const target=releaseTarget(process.env.GITHUB_REF_NAME);const sha=process.env.GITHUB_SHA;assert.match(sha,/^[a-f0-9]{40}$/);
 const version=JSON.parse(await readFile(new URL('../../apps/mobile/package.json',import.meta.url),'utf8')).version;
 const expected={sourceSha:sha,environment:target.profile,version};
 await assertCurrentSource(target,sha,process.env.GITHUB_TOKEN);
 const api=appleClient({keyId:process.env.APPLE_ASC_KEY_ID,issuerId:process.env.APPLE_ASC_ISSUER_ID,key:await readFile(process.env.APPLE_ASC_PRIVATE_KEY_PATH)});
 const save=async(name,value)=>writeFile(`${out}/${name}`,JSON.stringify(value,null,2)+'\n',{mode:0o600});
 if(command==='allocate'){
  let intent;
  try{intent=JSON.parse(await readFile(`${out}/recovery/upload-intent.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  let run;
  if(intent){const find=()=>findBuild(api,version,intent.buildNumber);const observed=await waitForValid(find,{timeoutMs:20*60*1000});run=await recoverIntent(intent,expected,async()=>observed);}
  else{const {rows}=await all(api,`/v1/builds?filter[app]=${APP}&limit=200`);run={...expected,mode:'build',buildNumber:String(nextBuildNumber(rows.map(b=>b.attributes.version)))};}
  await save('run.json',run);
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`mode=${run.mode}\nbuild_number=${run.buildNumber}\n`);
  console.log(JSON.stringify({mode:run.mode,buildNumber:run.buildNumber}));return;
 }
 const run=JSON.parse(await readFile(`${out}/run.json`,'utf8'));
 for(const key of ['sourceSha','environment','version'])assert.equal(run[key],expected[key]);assert.match(run.buildNumber,/^[1-9]\d{0,3}$/);
 if(command==='intent'){
  assert.equal(run.mode,'build');const verification=JSON.parse(await readFile(`${out}/binary-verification.json`,'utf8'));
  for(const key of ['sourceSha','environment','version','buildNumber'])assert.equal(verification[key],run[key]);
  const ipaSha256=crypto.createHash('sha256').update(await readFile(`${out}/Sawaa.ipa`)).digest('hex');assert.equal(verification.ipaSha256,ipaSha256);
  const existing=await findBuild(api,version,run.buildNumber);assert.ok(!existing,'Concurrent manual Apple build conflicts with allocated number');
  await save('upload-intent.json',{...expected,buildNumber:run.buildNumber,ipaSha256});return;
 }
 const find=()=>findBuild(api,version,run.buildNumber);
 if(command==='upload'){
  assert.equal(process.env.APPLE_ALLOW_UPLOAD,'1','Upload authorization missing');assert.equal(run.mode,'build');
  const intent=JSON.parse(await readFile(`${out}/upload-intent.json`,'utf8'));const verification=JSON.parse(await readFile(`${out}/binary-verification.json`,'utf8'));
  for(const key of ['sourceSha','environment','version','buildNumber','ipaSha256'])assert.equal(intent[key],verification[key]);
  assert.equal(intent.ipaSha256,crypto.createHash('sha256').update(await readFile(`${out}/Sawaa.ipa`)).digest('hex'));
  assert.ok(!await find(),'Concurrent Apple build conflicts before upload');
  await uploadOnce({find,allowExisting:false,send:()=>altool(`${out}/Sawaa.ipa`)});
 }else{assert.equal(run.mode,'resume');await recoverIntent(run,expected,find);}
 const build=await waitForValid(find);
 const notes=`بيئة ${target.profile==='staging'?'التجربة':'الإنتاج'} — البناء ${run.buildNumber}\nالمصدر: ${sha}\nيرجى اختبار الدخول والحجز والدفع والإشعارات. سجّل الخروج قبل تثبيت بناء البيئة الأخرى ثم ادخل بحسابها.`;
 await distribute(api,build,notes);
 const receipt={...expected,buildNumber:run.buildNumber,buildId:build.id,processingState:'VALID',groupId:GROUP,internalBuildState:'IN_BETA_TESTING',observedAt:new Date().toISOString()};
 await save('apple-release.json',receipt);console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await cli();
