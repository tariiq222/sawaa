import { bigintJsonReplacer } from './json-bigint.helper';

describe('bigintJsonReplacer', () => {
  it('encodes a small bigint as a JSON number', () => {
    expect(JSON.stringify({ sequence: 42n }, bigintJsonReplacer)).toBe('{"sequence":42}');
  });

  it('encodes the largest safe integer as a number', () => {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    expect(JSON.stringify({ sequence: max }, bigintJsonReplacer)).toBe(
      `{"sequence":${Number.MAX_SAFE_INTEGER}}`,
    );
  });

  it('encodes an unsafe bigint as a decimal string so no precision is lost', () => {
    const big = BigInt('9007199254740993'); // MAX_SAFE_INTEGER + 2
    expect(JSON.stringify({ sequence: big }, bigintJsonReplacer)).toBe(
      '{"sequence":"9007199254740993"}',
    );
  });

  it('leaves every other value byte-identical', () => {
    const payload = {
      id: 'abc',
      count: 3,
      flag: false,
      nested: { when: '2026-01-01T00:00:00.000Z', list: [1, 2, null] },
      nothing: null,
    };
    expect(JSON.stringify(payload, bigintJsonReplacer)).toBe(JSON.stringify(payload));
  });

  it('reproduces the production failure without the replacer', () => {
    expect(() => JSON.stringify({ sequence: 1n })).toThrow(TypeError);
    expect(JSON.stringify({ sequence: 1n }, bigintJsonReplacer)).toBe('{"sequence":1}');
  });
});
