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
