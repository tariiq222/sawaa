import { Injectable } from '@nestjs/common';
import * as React from 'react';
import * as QRCode from 'qrcode';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';
import { buildZatcaQrTlv } from '../zatca/build-qr-tlv';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // If a QR data URL was supplied by the caller, use it as-is. Otherwise,
    // when a seller VAT number is present, derive the ZATCA Phase 1 TLV
    // payload and rasterize it into a PNG data URL embedded in the PDF.
    let qrDataUrl: string | null = data.qrDataUrl;
    if (!qrDataUrl && data.sellerVatNumber) {
      const tlv = buildZatcaQrTlv({
        sellerName: data.sellerNameAr,
        vatNumber: data.sellerVatNumber,
        timestamp: data.paidAt,
        totalWithVat: (data.total / 100).toFixed(2),
        vatTotal: (data.vatAmt / 100).toFixed(2),
      });
      qrDataUrl = await QRCode.toDataURL(tlv, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 240,
      });
    }

    const enriched: InvoicePdfData = { ...data, qrDataUrl };

    // Dynamic import: @react-pdf/renderer is pure ESM. Matches the
    // file-type pattern used elsewhere in the backend.
    const { pdf } = await import('@react-pdf/renderer');
    const element = React.createElement(InvoicePdf, { data: enriched });
    const instance = pdf(element as Parameters<typeof pdf>[0]);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
