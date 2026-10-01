'use strict';

// Exercise installed dependencies rather than copies of their patched implementation.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {createRequire} = require('node:module');
const path = require('node:path');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {test} = require('node:test');

const rootRequire = createRequire(path.resolve(__dirname, '../../package.json'));
const minioRequire = createRequire(rootRequire.resolve('minio'));
const queryRequire = createRequire(minioRequire.resolve('query-string'));
const decoderPath = queryRequire.resolve('decode-uri-component');

function decodeControls(requireDecoder) {
  const decode = requireDecoder('decode-uri-component');
  assert.equal(typeof decode, 'function');
  for (const [encoded, expected] of [
    ['%D8%B3%D9%88%D8%A7%D8%A1', 'سواء'], ['a+b%2Bc', 'a b+c'],
    ['%', '%'], ['%GG', '%GG'], ['%E2%28%A1', '%E2(%A1'],
    ['%FE%FF', '\uFFFD\uFFFD'], ['%FF%FE', '\uFFFD\uFFFD'],
    ['%C2', '\uFFFD'], ['%C2%A9', '©'], ['%F0%9F%98%80', '😀'],
  ]) assert.equal(decode(encoded), expected, encoded);
  assert.throws(() => decode(null), TypeError);
}

test('MinIO query parsing retains the callable decoder and ordinary URL semantics', () => {
  decodeControls(queryRequire);
  const query = minioRequire('query-string');
  assert.equal(query.parse('name=%D8%B3%D9%88%D8%A7%D8%A1&return=%2Fbooking%2F123').name, 'سواء');
  assert.equal(query.parse('return=%2Fbooking%2F123').return, '/booking/123');
});

test('malformed percent runs finish within a bounded subprocess', () => {
  const result = spawnSync(process.execPath, ['-e',
    `const decode = require(${JSON.stringify(decoderPath)}); const input = '%C0%AF'.repeat(50000); if (decode(input) !== input) process.exit(2);`,
  ], {timeout: 3000, encoding: 'utf8'});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('many distinct partly-invalid runs do not trigger repeated full-input scans', () => {
  const result = spawnSync(process.execPath, ['-e',
    `const decode = require(${JSON.stringify(decoderPath)}); const runs = Array.from({length: 32000}, (_, i) => '%FF' + String(i).padStart(6, '0').split('').map(c => '%' + c.charCodeAt(0).toString(16)).join('')); const output = decode(runs.join('!')); if (output !== Array.from({length: 32000}, (_, i) => '%FF' + String(i).padStart(6, '0')).join('!')) process.exit(2);`,
  ], {timeout: 3000, encoding: 'utf8'});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('fallback does not decode escaped percent text twice or interpret replacement syntax', () => {
  const decode = queryRequire('decode-uri-component');
  assert.equal(decode('%25C2!%FF'), '%C2!%FF');
  assert.equal(decode('%25FE%25FF!%FF'), '%FE%FF!%FF');
  assert.equal(decode('%FF%24%26'), '%FF$&');
});

async function filtered(Filter, json, options) {
  const tokens = [];
  const {parser} = minioRequire('stream-json');
  await pipeline(Readable.from([json]), parser(), new Filter(options), async source => {
    for await (const token of source) tokens.push(token);
  });
  return tokens;
}

for (const name of ['Pick', 'Ignore', 'Filter', 'Replace']) {
  const Filter = minioRequire(`stream-json/filters/${name}.js`);
  test(`${name} rejects excessive filter path depth using stream error semantics`, async () => {
    await assert.rejects(filtered(Filter, '['.repeat(1100) + '0' + ']'.repeat(1100), {filter: 'missing'}),
      error => error instanceof RangeError && /maxDepth/.test(error.message));
  });
  test(`${name} respects an explicit depth bound and allows ordinary nesting`, async () => {
    await filtered(Filter, '[[0]]', {filter: 'missing', maxDepth: 2});
    await assert.rejects(filtered(Filter, '[[[0]]]', {filter: 'missing', maxDepth: 2}), RangeError);
  });
  test(`${name} bounds shallow long-key amplification and combined ancestor path length`, async () => {
    const shallow = JSON.stringify({['k'.repeat(20000)]: Array(1000).fill(0)});
    const combined = JSON.stringify({['k'.repeat(9000)]: {['v'.repeat(9000)]: 0}});
    for (const json of [shallow, combined]) {
      await assert.rejects(filtered(Filter, json, {filter: /never/}),
        error => error instanceof RangeError && /maxPathLength/.test(error.message));
    }
  });
  test(`${name} allows bounded long keys and respects an explicit path length`, async () => {
    await filtered(Filter, JSON.stringify({['k'.repeat(15000)]: 0}), {filter: /never/});
    await filtered(Filter, '{"abc":0}', {filter: /never/, maxPathLength: 3});
    await assert.rejects(filtered(Filter, '{"abcd":0}', {filter: /never/, maxPathLength: 3}), RangeError);
    await assert.rejects(filtered(Filter, '{"ab":{"cd":0}}', {filter: /never/, maxPathLength: 4}), RangeError);
  });
}

test('normal filtering and MinIO JSONL notification imports remain compatible', async () => {
  const Pick = minioRequire('stream-json/filters/Pick.js');
  const Ignore = minioRequire('stream-json/filters/Ignore.js');
  const Replace = minioRequire('stream-json/filters/Replace.js');
  const Filter = minioRequire('stream-json/filters/Filter.js');
  const json = '{"keep":42,"drop":13}';
  assert.deepEqual((await filtered(Pick, json, {filter: 'keep'})).filter(t => t.name === 'numberValue').map(t => t.value), ['42']);
  assert.deepEqual((await filtered(Ignore, json, {filter: 'drop'})).filter(t => t.name === 'numberValue').map(t => t.value), ['42']);
  assert.deepEqual((await filtered(Filter, json, {filter: 'keep'})).filter(t => t.name === 'numberValue').map(t => t.value), ['42']);
  assert.ok((await filtered(Replace, json, {filter: 'drop'})).some(t => t.name === 'nullValue'));
  const Parser = minioRequire('stream-json/jsonl/Parser.js');
  const records = [];
  await pipeline(Readable.from(['{"Records":[]}\n{"event":"ok"}\n']), new Parser(), async source => {
    for await (const record of source) records.push(record.value);
  });
  assert.deepEqual(records, [{Records: []}, {event: 'ok'}]);
  assert.equal(typeof rootRequire('minio').Client, 'function');
});

test('updated request parsers preserve original JSON bytes and reject oversized bodies', async () => {
  const express = rootRequire('express');
  const bodyParser = rootRequire('body-parser');
  const request = rootRequire('supertest');
  const app = express();
  app.use(bodyParser.json({verify: (req, _res, bytes) => { req.rawBody = bytes; }}));
  app.post('/', (req, res) => res.json({parsed: req.body, raw: req.rawBody.toString('utf8')}));
  const raw = '{ "name": "سواء", "amount": 0 }';
  const response = await request(app).post('/').set('Content-Type', 'application/json').send(raw);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {parsed: {name: 'سواء', amount: 0}, raw});
  app.use((error, _req, res, _next) => res.sendStatus(error.status || 500));
  assert.equal((await request(app).post('/').set('Content-Type', 'application/json').send(JSON.stringify({data: 'a'.repeat(101 * 1024)}))).status, 413);
});

test('updated multer retains bounded memory uploads', async () => {
  const app = rootRequire('express')();
  const upload = rootRequire('multer')({limits: {fileSize: 64}});
  app.post('/', upload.single('file'), (req, res) => res.json({text: req.file.buffer.toString('utf8')}));
  app.use((error, _req, res, _next) => res.status(400).json({code: error.code}));
  const request = rootRequire('supertest');
  const ordinary = await request(app).post('/').attach('file', Buffer.from('سواء'), 'note.txt');
  assert.equal(ordinary.status, 200);
  assert.equal(ordinary.body.text, 'سواء');
  const oversized = await request(app).post('/').attach('file', Buffer.alloc(65), 'large.txt');
  assert.equal(oversized.status, 400);
  assert.equal(oversized.body.code, 'LIMIT_FILE_SIZE');
});

test('interrupted multipart uploads settle once instead of leaving pending storage work', async () => {
  const http = require('node:http');
  const upload = rootRequire('multer')().single('file');
  let client;
  let calls = 0;
  let timer;
  let settle;
  const completed = new Promise((resolve, reject) => {
    settle = resolve;
    timer = setTimeout(() => reject(new Error('Interrupted upload callback did not settle')), 2000);
  });
  const server = http.createServer((req, res) => {
    req.once('data', () => setImmediate(() => client.destroy()));
    upload(req, res, error => { calls++; settle(error); });
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    client = http.request({host: '127.0.0.1', port: server.address().port, method: 'POST', headers: {
      'Content-Type': 'multipart/form-data; boundary=sawaa-regression', 'Content-Length': '4096',
    }});
    client.on('error', () => {});
    client.write('--sawaa-regression\r\nContent-Disposition: form-data; name="file"; filename="partial.txt"\r\nContent-Type: text/plain\r\n\r\npartial');
    assert.ok(await completed);
    assert.equal(calls, 1);
  } finally {
    clearTimeout(timer);
    client?.destroy();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('IPv6 rate-limit grouping and address conversion retain their existing contracts', () => {
  const {ipKeyGenerator} = rootRequire('express-rate-limit');
  assert.equal(ipKeyGenerator('2001:db8:1234:5601::1', 56), ipKeyGenerator('2001:db8:1234:56ff::2', 56));
  assert.notEqual(ipKeyGenerator('2001:db8:1234:5601::1', 56), ipKeyGenerator('2001:db8:1234:5700::1', 56));
  assert.equal(ipKeyGenerator('192.0.2.1', 56), '192.0.2.1');
  const {Address6} = rootRequire('ip-address');
  assert.equal(Address6.fromAddress4('192.0.2.1').to4().correctForm(), '192.0.2.1');
});

test('protobuf loader preserves int64, maps and bytes in an offline RPC roundtrip', () => {
  const {mkdtempSync, writeFileSync, rmSync} = require('node:fs');
  const {tmpdir} = require('node:os');
  const directory = mkdtempSync(path.join(tmpdir(), 'sawaa-protobuf-regression-'));
  try {
    const file = path.join(directory, 'roundtrip.proto');
    writeFileSync(file, 'syntax = "proto3"; package regression; message Record { int64 id = 1; map<string, string> tags = 2; bytes payload = 3; } service Echo { rpc Roundtrip(Record) returns (Record); }\n');
    const definition = rootRequire('@grpc/proto-loader').loadSync(file, {longs: String, bytes: Buffer});
    const method = definition['regression.Echo'].Roundtrip;
    const record = {id: '9007199254740993', tags: {name: 'سواء'}, payload: Buffer.from('payload')};
    assert.deepEqual(method.requestDeserialize(method.requestSerialize(record)), record);
    assert.deepEqual(method.responseDeserialize(method.responseSerialize(record)), record);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('Firebase messaging initializes offline with an explicit non-network credential', async () => {
  const {initializeApp, deleteApp} = rootRequire('firebase-admin/app');
  const {getMessaging} = rootRequire('firebase-admin/messaging');
  const app = initializeApp({projectId: 'sawaa-offline-regression', credential: {
    getAccessToken: async () => { throw new Error('Network credential use is outside this offline test'); },
  }}, 'sawaa-dependency-regression');
  try { assert.equal(typeof getMessaging(app).send, 'function'); }
  finally { await deleteApp(app); }
});

test('ExcelJS exports and imports workbooks with its updated CommonJS UUID caller', async () => {
  const ExcelJS = rootRequire('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('سواء');
  sheet.getCell('A1').value = 'خدمة محجوزة';
  sheet.addConditionalFormatting({ref: 'A1', rules: [{type: 'expression', formulae: ['1=1'], style: {font: {bold: true}}}]});
  const bytes = await book.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  assert.equal(restored.getWorksheet('سواء').getCell('A1').value, 'خدمة محجوزة');
});

test('updated tsx/esbuild tooling still transforms TSX', async () => {
  const esbuild = createRequire(rootRequire.resolve('tsx'))('esbuild');
  const result = await esbuild.transform('const n: number = 1; export const view = <div>{n}</div>;', {loader: 'tsx'});
  assert.match(result.code, /createElement/);
});

if (process.env.SAWAA_INCLUDE_MOBILE_DEPENDENCIES === '1') {
  const mobileRequire = createRequire(path.resolve(__dirname, '../../apps/mobile/package.json'));
  const nativeRequire = createRequire(mobileRequire.resolve('@react-navigation/native'));
  const coreRequire = createRequire(nativeRequire.resolve('@react-navigation/core'));
  const mobileQueryRequire = createRequire(coreRequire.resolve('query-string'));

  test('independently installed React Navigation decoder has the patch and preserves URL controls', () => {
    decodeControls(mobileQueryRequire);
    const decodePath = mobileQueryRequire.resolve('decode-uri-component');
    assert.notEqual(decodePath, decoderPath);
    const result = spawnSync(process.execPath, ['-e',
      `const decode=require(${JSON.stringify(decodePath)}); const input='%C0%AF'.repeat(50000); if(decode(input)!==input)process.exit(2);`,
    ], {timeout: 3000, encoding: 'utf8'});
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(coreRequire('query-string').parse('redirect=%2Fbooking%2F123&name=%D8%B3%D9%88%D8%A7%D8%A1').redirect, '/booking/123');
  });

  test('Expo xcode parse/write and generated project IDs remain compatible with UUID 11', () => {
    const {mkdtempSync, writeFileSync, rmSync} = require('node:fs');
    const {tmpdir} = require('node:os');
    const expoRequire = createRequire(createRequire(mobileRequire.resolve('jest-expo')).resolve('@expo/config'));
    const pluginsRequire = createRequire(expoRequire.resolve('@expo/config-plugins'));
    const xcode = pluginsRequire('xcode');
    const directory = mkdtempSync(path.join(tmpdir(), 'sawaa-xcode-regression-'));
    const projectFile = path.join(directory, 'project.pbxproj');
    try {
      writeFileSync(projectFile, '{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = { AAAAAAAAAAAAAAAAAAAAAAAA = { isa = PBXProject; mainGroup = BBBBBBBBBBBBBBBBBBBBBBBB; targets = (); }; BBBBBBBBBBBBBBBBBBBBBBBB = { isa = PBXGroup; children = (); sourceTree = "<group>"; }; }; rootObject = AAAAAAAAAAAAAAAAAAAAAAAA; }\n');
      const project = xcode.project(projectFile).parseSync();
      assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
      writeFileSync(projectFile, project.writeSync());
      assert.equal(xcode.project(projectFile).parseSync().hash.project.rootObject, 'AAAAAAAAAAAAAAAAAAAAAAAA');
    } finally { rmSync(directory, {recursive: true, force: true}); }
  });

  test('calendar moment dependency preserves Arabic labels, leap days and month selection', () => {
    const calendarRequire = createRequire(mobileRequire.resolve('react-native-calendars'));
    const moment = calendarRequire('moment');
    calendarRequire('moment/locale/ar');
    const selected = moment('2024-02-29', 'YYYY-MM-DD', 'en', true);
    assert.equal(selected.isValid(), true);
    assert.equal(selected.clone().locale('ar').format('MMMM'), 'فبراير');
    assert.equal(selected.clone().add(1, 'month').locale('en').format('YYYY-MM-DD'), '2024-03-29');
    assert.equal(selected.locale('en').format('YYYY-MM-DD'), '2024-02-29');
    assert.equal(moment('2025-02-29', 'YYYY-MM-DD', 'en', true).isValid(), false);
  });
}
