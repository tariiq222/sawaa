import { buildZatcaQrTlv } from './build-qr-tlv';

describe('buildZatcaQrTlv', () => {
  it('matches the ZATCA reference example', () => {
    const result = buildZatcaQrTlv({
      sellerName: 'Salla',
      vatNumber: '310122393500003',
      timestamp: new Date('2022-04-25T15:30:00Z'),
      totalWithVat: '100.00',
      vatTotal: '15.00',
    });
    expect(result).toBe(
      'AQVTYWxsYQIPMzEwMTIyMzkzNTAwMDAzAxQyMDIyLTA0LTI1VDE1OjMwOjAwWgQGMTAwLjAwBQUxNS4wMA==',
    );
  });

  it('handles multi-byte Arabic seller name length correctly (byte length, not char count)', () => {
    const result = buildZatcaQrTlv({
      sellerName: 'سواء',
      vatNumber: '300000000000003',
      timestamp: new Date('2026-05-24T10:00:00Z'),
      totalWithVat: '115.00',
      vatTotal: '15.00',
    });
    // 'سواء' = 8 bytes in UTF-8
    // Decode and inspect first tag block manually
    const bytes = Buffer.from(result, 'base64');
    expect(bytes[0]).toBe(1); // tag 1
    expect(bytes[1]).toBe(8); // 8 bytes, not 4 chars
  });

  it('strips sub-second milliseconds from the timestamp before encoding (regex branch)', () => {
    // toISOString() yields "2022-04-25T15:30:00.123Z" — the regex trims ".123".
    // After trim, tag 3 length must match the trimmed ISO string, NOT the raw one.
    const result = buildZatcaQrTlv({
      sellerName: 'X',
      vatNumber: '1',
      timestamp: new Date('2022-04-25T15:30:00.123Z'),
      totalWithVat: '0.00',
      vatTotal: '0.00',
    });
    const bytes = Buffer.from(result, 'base64');
    // Each TLV block is [tag, len, value...]. First block: tag=1, len=1, val="X"
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(1);
    expect(bytes[2]).toBe('X'.charCodeAt(0)); // 88
    // Second block: tag=2, len=1, val="1"
    expect(bytes[3]).toBe(2);
    expect(bytes[4]).toBe(1);
    expect(bytes[5]).toBe('1'.charCodeAt(0));
    // Third block: tag=3, len = 20 (after ms trim: "2022-04-25T15:30:00Z")
    expect(bytes[6]).toBe(3);
    expect(bytes[7]).toBe(20);
  });

  it('leaves a no-ms timestamp untouched (regex no-match branch)', () => {
    // Without ms the regex no-ops; tag 3 length is still 20.
    const result = buildZatcaQrTlv({
      sellerName: 'X',
      vatNumber: '1',
      timestamp: new Date('2022-04-25T15:30:00Z'),
      totalWithVat: '0.00',
      vatTotal: '0.00',
    });
    const bytes = Buffer.from(result, 'base64');
    expect(bytes[6]).toBe(3);
    expect(bytes[7]).toBe(20);
  });

  it('throws when a UTF-8 value exceeds 255 bytes (size-cap branch)', () => {
    // 256 chars × 2 bytes/char (Arabic) → 512-byte value, well over the cap.
    const longArabic = 'س'.repeat(256);
    expect(() =>
      buildZatcaQrTlv({
        sellerName: longArabic,
        vatNumber: '1',
        timestamp: new Date('2022-04-25T15:30:00Z'),
        totalWithVat: '0.00',
        vatTotal: '0.00',
      }),
    ).toThrow(/exceeds 255 bytes/);
  });

  it('accepts a value at exactly the 255-byte boundary', () => {
    // 255 chars × 2 bytes/char = 510 — that's still over. Use ASCII: 255 chars × 1 byte.
    const value = 'a'.repeat(255);
    expect(() =>
      buildZatcaQrTlv({
        sellerName: value,
        vatNumber: '1',
        timestamp: new Date('2022-04-25T15:30:00Z'),
        totalWithVat: '0.00',
        vatTotal: '0.00',
      }),
    ).not.toThrow();
  });

  it('encodes each field as its own TLV block in order (tags 1..5)', () => {
    const result = buildZatcaQrTlv({
      sellerName: 'S',
      vatNumber: 'V',
      timestamp: new Date('2022-04-25T15:30:00Z'),
      totalWithVat: '115.00',
      vatTotal: '15.00',
    });
    const bytes = Buffer.from(result, 'base64');
    // Walk the blocks: each is [tag, len, value...]
    let offset = 0;
    const tags: number[] = [];
    while (offset < bytes.length) {
      const tag = bytes[offset];
      const len = bytes[offset + 1];
      tags.push(tag);
      offset += 2 + len;
    }
    expect(tags).toEqual([1, 2, 3, 4, 5]);
  });
});
