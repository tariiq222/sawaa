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
});
