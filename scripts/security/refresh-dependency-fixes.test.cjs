'use strict';

const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');

const rootRequire = createRequire(path.resolve(__dirname, '../../package.json'));
const busboyRequire = createRequire(rootRequire.resolve('@fastify/busboy/package.json'));

test('multipart headers named after prototype properties do not crash the installed parser', () => {
  const HeaderParser = busboyRequire('./deps/dicer/lib/HeaderParser');
  for (const name of ['__proto__', 'constructor', 'toString']) {
    const parser = new HeaderParser();
    let headers;
    parser.on('header', value => { headers = value; });
    assert.doesNotThrow(() => parser.push(Buffer.from(`${name}: safe\r\nContent-Type: text/plain\r\n\r\n`)));
    assert.deepEqual(headers[name.toLowerCase()], ['safe']);
    assert.deepEqual(headers['content-type'], ['text/plain']);
  }
});

test('a 252-byte multipart boundary cannot stall the parser on unmatched input', () => {
  const code = `
    const Busboy = require(${JSON.stringify(rootRequire.resolve('@fastify/busboy'))});
    const parser = new Busboy({headers: {'content-type': 'multipart/form-data; boundary=' + 'a'.repeat(252)}});
    parser.on('error', () => {});
    parser.end(Buffer.from('b'.repeat(1024)));
  `;
  const result = spawnSync(process.execPath, ['-e', code], {timeout: 2000, encoding: 'utf8'});
  assert.equal(result.error, undefined, `multipart parser stalled: ${result.error}`);
  assert.equal(result.status, 0, result.stderr);
});

test('legitimate multipart fields survive every two-chunk boundary', async () => {
  const Busboy = rootRequire('@fastify/busboy');
  const body = Buffer.from('--test-boundary\r\nContent-Disposition: form-data; name="field"\r\n\r\nhello\r\n--test-boundary--\r\n');
  for (let split = 1; split < body.length; split++) {
    const parser = new Busboy({headers: {'content-type': 'multipart/form-data; boundary=test-boundary'}});
    const fields = [];
    parser.on('field', (name, value) => fields.push({name, value}));
    await new Promise((resolve, reject) => {
      parser.on('finish', resolve);
      parser.on('error', reject);
      parser.write(body.subarray(0, split));
      parser.end(body.subarray(split));
    });
    assert.deepEqual(fields, [{name: 'field', value: 'hello'}], `split at byte ${split}`);
  }
});

const installs = [['root', rootRequire]];
if (process.env.SAWAA_INCLUDE_MOBILE_DEPENDENCIES === '1') {
  const mobileRequire = createRequire(path.resolve(__dirname, '../../apps/mobile/package.json'));
  // Resolve through an installed mobile dependency so Node cannot fall back to root's hoist.
  installs.push(['mobile', createRequire(mobileRequire.resolve('expo/package.json'))]);
}

function directAst(depth) {
  const root = {type: 'root', nodes: []};
  let node = root;
  for (let i = 0; i < depth; i++) {
    const child = {type: 'paren', nodes: [], parent: node};
    node.nodes.push(child);
    node = child;
  }
  node.nodes.push({type: 'text', value: 'x', parent: node});
  return root;
}

for (const [installation, requireFrom] of installs) {
  const braces = requireFrom('braces');
  for (const [label, open, close] of [['braces', '{', '}'], ['parentheses', '(', ')'], ['mixed', '{(', ')}']]) {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      test(`${installation} ${method} rejects deeply nested ${label} with a controlled depth error`, () => {
        const depth = label === 'mixed' ? 2200 : 4400;
        const pattern = open.repeat(depth) + 'x' + close.repeat(depth);
        assert.throws(() => braces[method](pattern), /exceeds max depth/);
      });
    }
  }
  for (const method of ['compile', 'expand', 'stringify']) {
    test(`${installation} ${method} also bounds caller-provided ASTs and cannot disable the cap`, () => {
      for (const maxDepth of [100000, Infinity, NaN]) {
        assert.throws(() => braces[method](directAst(4400), {maxDepth}), /exceeds max depth/);
      }
      assert.equal(braces[method](directAst(10)).toString(), 'x');
      assert.equal(braces[method](directAst(100)).toString(), 'x');
      assert.throws(() => braces[method](directAst(101)), /exceeds max depth/);
      const subtree = directAst(100).nodes[0];
      delete subtree.parent;
      assert.equal(braces[method](subtree).toString(), 'x');
      assert.throws(() => braces[method](directAst(101).nodes[0]), /exceeds max depth/);
    });
  }
  test(`${installation} parsing bounds combined nesting at the boundary and respects smaller limits`, () => {
    const atLimit = '{'.repeat(100) + 'x' + '}'.repeat(100);
    assert.doesNotThrow(() => braces.parse(atLimit));
    assert.throws(() => braces.parse('{' + atLimit + '}'), /exceeds max depth/);
    assert.throws(() => braces.parse('{(x)}', {maxDepth: 1}), /exceeds max depth/);
    assert.doesNotThrow(() => braces.parse('{(x)}', {maxDepth: 2}));
  });
  test(`${installation} expansion bounds invalid, dollar and range AST stringify fallbacks`, () => {
    for (const flag of ['invalid', 'dollar', 'ranges']) {
      const ast = directAst(4400);
      ast.nodes[0][flag] = flag === 'ranges' ? 1 : true;
      assert.throws(() => braces.expand(ast), /exceeds max depth/);
      for (const maxDepth of [2, 100]) {
        const nested = directAst(maxDepth + 1);
        let fallback = nested;
        for (let depth = 0; depth < maxDepth; depth++) fallback = fallback.nodes[0];
        fallback[flag] = flag === 'ranges' ? 1 : true;
        assert.throws(() => braces.expand(nested, {maxDepth}), /exceeds max depth/);
      }
    }
  });
  test(`${installation} ordinary ranges, alternatives, escaping and globs retain their output`, () => {
    assert.deepEqual(braces.expand('file-{1..3}.{js,ts}'), ['file-1.js', 'file-1.ts', 'file-2.js', 'file-2.ts', 'file-3.js', 'file-3.ts']);
    assert.equal(braces.compile('src/{app,{lib,test}}/*.ts'), 'src/(app|(lib|test))/*.ts');
    assert.equal(braces.stringify('{a,b}'), '{a,b}');
    assert.deepEqual(braces.expand('{a,a,,b}', {nodupes: true, noempty: true}), ['a', 'b']);
    for (const literal of ['\\{'.repeat(110) + 'x', '"' + '{'.repeat(110) + '"', '[' + '{'.repeat(110) + ']']) {
      assert.doesNotThrow(() => braces.compile(literal));
    }
    assert.equal(braces.compile('a{b'), 'a{b');
    assert.equal(braces.stringify(braces.parse('a{b'), {escapeInvalid: true}), 'a{b');
  });
}
