export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  /** Decimal string with 2 places, e.g. "115.00". */
  totalWithVat: string;
  /** Decimal string with 2 places, e.g. "15.00". */
  vatTotal: string;
}

function encodeTlv(tag: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, 'utf8');
  if (valueBuf.length > 255) {
    throw new Error(
      `ZATCA TLV value for tag ${tag} exceeds 255 bytes (got ${valueBuf.length})`,
    );
  }
  const header = Buffer.from([tag, valueBuf.length]);
  return Buffer.concat([header, valueBuf]);
}

export function buildZatcaQrTlv(fields: ZatcaQrFields): string {
  const blocks = [
    encodeTlv(1, fields.sellerName),
    encodeTlv(2, fields.vatNumber),
    encodeTlv(3, fields.timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z')),
    encodeTlv(4, fields.totalWithVat),
    encodeTlv(5, fields.vatTotal),
  ];
  return Buffer.concat(blocks).toString('base64');
}
