import test from 'node:test';
import assert from 'node:assert/strict';

test('build numbers exceed observed Apple values and the reserved floor',async()=>{
 const {nextBuildNumber}=await import('./apple.mjs');assert.equal(nextBuildNumber(['34','29']),36);assert.equal(nextBuildNumber(['38']),39);assert.throws(()=>nextBuildNumber(['9999']),/exhausted/);assert.throws(()=>nextBuildNumber(['bad']),/numeric/);
});
test('processing VALID succeeds; INVALID and timeout fail',async()=>{
 const {waitForValid}=await import('./apple.mjs');let clock=0;const options={now:()=>clock,sleep:async ms=>{clock+=ms;},timeoutMs:20,intervalMs:10};
 assert.equal((await waitForValid(async()=>({id:'build',attributes:{processingState:'VALID'}}),options)).id,'build');
 await assert.rejects(waitForValid(async()=>({attributes:{processingState:'INVALID'}}),options),/INVALID/);
 await assert.rejects(waitForValid(async()=>null,options),/timed out/);
});
test('an uncertain upload is queried and never sent twice',async()=>{
 const {uploadOnce}=await import('./apple.mjs');let sent=0,queries=0;
 const result=await uploadOnce({find:async()=>{queries++;return queries===1?null:{id:'accepted'};},send:async()=>{sent++;throw Error('lost response');},sleep:async()=>{},timeoutMs:20,now:()=>0});assert.equal(result.id,'accepted');assert.equal(sent,1);
});
test('pre-existing Apple build resumes without upload; absent uncertain build fails closed',async()=>{
 const {uploadOnce}=await import('./apple.mjs');let sent=0;
 assert.equal((await uploadOnce({find:async()=>({id:'existing'}),send:async()=>{sent++;}})).id,'existing');assert.equal(sent,0);
 let clock=0;await assert.rejects(uploadOnce({find:async()=>null,send:async()=>{sent++;return {exitCode:1};},timeoutMs:20,intervalMs:10,now:()=>clock,sleep:async ms=>{clock+=ms;}}),/uncertain/);assert.equal(sent,1);
});
test('durable prior upload intent cannot allocate or upload another binary',async()=>{
 const {recoverIntent}=await import('./apple.mjs');const intent={sourceSha:'a'.repeat(40),environment:'staging',version:'1.0.0',buildNumber:'36',ipaSha256:'b'.repeat(64)};
 assert.deepEqual(await recoverIntent(intent,intent,async()=>({id:'build'})),{...intent,mode:'resume',buildId:'build'});
 await assert.rejects(recoverIntent(intent,{...intent,environment:'production'},async()=>({id:'build'})),/identity mismatch/);
 await assert.rejects(recoverIntent(intent,intent,async()=>null),/not observed/);
});

test('exact Apple lookup checks marketing version and iOS platform',async()=>{
 const {findBuild}=await import('./apple.mjs');const api=async()=>({data:[{id:'build',attributes:{version:'36'},relationships:{preReleaseVersion:{data:{id:'release'}}}}],included:[{id:'release',attributes:{version:'1.0.0',platform:'IOS'}}]});assert.equal((await findBuild(api,'1.0.0','36')).id,'build');assert.equal(await findBuild(api,'2.0.0','36'),null);await assert.rejects(findBuild(api,'1.0.0','bad'));
});
test('internal distribution is verified from fresh group membership and beta state',async()=>{
 const {distribute}=await import('./apple.mjs');let added=false;const writes=[];
 const api=async(path,options={})=>{if(options.method){writes.push({path,...options});if(path.endsWith('/relationships/builds'))added=true;return {};}
 if(path.includes('/betaBuildLocalizations'))return {data:[]};
 if(path.includes('/betaGroups/'))return {data:added?[{id:'build'}]:[]};
 if(path.endsWith('/buildBetaDetail'))return {data:{attributes:{internalBuildState:'IN_BETA_TESTING'}}};throw Error('Unexpected API path');};
 await distribute(api,{id:'build'},'staging source');assert.equal(writes.length,3);assert.equal(writes[0].body.data.attributes.usesNonExemptEncryption,false);assert.equal(writes[1].body.data.attributes.locale,'ar-SA');assert.ok(added);
 let clock=0;await assert.rejects(distribute(async(path,options)=>options?{}:{data:path.endsWith('/buildBetaDetail')?{attributes:{internalBuildState:'PROCESSING'}}:[]},{id:'build'},'test',{now:()=>clock,sleep:async ms=>{clock+=ms;},timeoutMs:20}),/availability timed out/);
});
test('a first upload cannot adopt a concurrent manual build',async()=>{
 const {uploadOnce}=await import('./apple.mjs');let sent=0;await assert.rejects(uploadOnce({find:async()=>({id:'manual'}),send:async()=>{sent++;},allowExisting:false}),/manual Apple build/);assert.equal(sent,0);
});


test('a source superseded during Apple processing cannot be distributed', async () => {
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');const {generateKeyPairSync}=await import('node:crypto');
 const dir=await mkdtemp(join(tmpdir(),'sawaa-apple-source-'));
 try {
  const sourceSha='a'.repeat(40);
  await writeFile(join(dir,'run.json'),JSON.stringify({sourceSha,environment:'staging',version:'1.0.0',buildNumber:'36',ipaSha256:'b'.repeat(64),mode:'resume'}));
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  await writeFile(join(dir,'key.p8'),privateKey.export({type:'pkcs8',format:'pem'}));
  await writeFile(join(dir,'writes.json'),'[]');
  await writeFile(join(dir,'fake-fetch.mjs'),`
   import {writeFile} from 'node:fs/promises';
   let processed=false;const writes=[];
   globalThis.fetch=async(url,options={})=>{
    const u=new URL(url);let body;
    if(u.hostname==='api.github.com')body={object:{sha:(processed?'c':'a').repeat(40)}};
    else if(options.method&&options.method!=='GET'){writes.push(options.method+' '+u.pathname);await writeFile(process.env.APPLE_OUTPUT_DIR+'/writes.json',JSON.stringify(writes));body={};}
    else if(u.pathname==='/v1/builds'){processed=true;body={data:[{id:'build',attributes:{version:'36',processingState:'VALID'},relationships:{preReleaseVersion:{data:{id:'release'}}}}],included:[{id:'release',attributes:{version:'1.0.0',platform:'IOS'}}]};}
    else if(u.pathname.includes('/betaBuildLocalizations'))body={data:[]};
    else if(u.pathname.includes('/betaGroups/'))body={data:[{id:'build'}]};
    else if(u.pathname.endsWith('/buildBetaDetail'))body={data:{attributes:{internalBuildState:'IN_BETA_TESTING'}}};
    else throw Error('Unexpected request '+u.pathname);
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
   };
  `);
  const result=spawnSync(process.execPath,['--import',join(dir,'fake-fetch.mjs'),'scripts/apple-release/apple.mjs','resume'],{encoding:'utf8',env:{...process.env,APPLE_OUTPUT_DIR:dir,GITHUB_REF_NAME:'develop',GITHUB_SHA:sourceSha,GITHUB_TOKEN:'test',APPLE_ASC_KEY_ID:'TESTKEY123',APPLE_ASC_ISSUER_ID:'test',APPLE_ASC_PRIVATE_KEY_PATH:join(dir,'key.p8')}});
  assert.notEqual(result.status,0,'superseded source must fail before distribution');
  assert.match(result.stderr,/superseded/);
  assert.deepEqual(JSON.parse(await readFile(join(dir,'writes.json'),'utf8')),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('distribution preserves an already declared encryption exemption without a forbidden rewrite',async()=>{
 const {distribute}=await import('./apple.mjs');const writes=[];
 const api=async(path,options={})=>{if(options.method){writes.push({path,...options});if(path==='/v1/builds/build')throw Error('Apple API HTTP 403');return {};}
 if(path.includes('/betaBuildLocalizations'))return {data:[{id:'notes',attributes:{locale:'ar-SA'}}]};
 if(path.includes('/betaGroups/'))return {data:[{id:'build'}]};
 if(path.endsWith('/buildBetaDetail'))return {data:{attributes:{internalBuildState:'IN_BETA_TESTING'}}};throw Error('Unexpected API path');};
 await distribute(api,{id:'build',attributes:{usesNonExemptEncryption:false}},'staging source');
 assert.equal(writes.length,1);assert.equal(writes[0].path,'/v1/betaBuildLocalizations/notes');
});
