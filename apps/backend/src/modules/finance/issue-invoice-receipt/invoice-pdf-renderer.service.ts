import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as React from 'react';
import * as QRCode from 'qrcode';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';
import { buildZatcaQrTlv } from '../zatca/build-qr-tlv';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // If a QR data URL was supplied by the caller, use it as-is. Otherwise
    // derive the ZATCA Phase 1 TLV payload and rasterize it into a PNG data
    // URL embedded in the PDF. The ZATCA QR identifies a VAT-registered
    // seller, so it is produced only once the org saves its real VAT
    // registration number in settings; without one the invoice prints with
    // no QR (as the settings screen states). Never invent a number.
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
    //
    // Register the Arabic font on THIS dynamically-imported module instance.
    // A static `Font.register` in the template runs against a different module
    // copy in the built CJS bundle, so the layout engine here would not see it
    // ("Font family not registered: IBMPlexArabic"). Registering inline keeps
    // registration and rendering on the same font store.
    const { pdf, Font } = await import('@react-pdf/renderer');
    const fontsDir = path.join(__dirname, '../../../../assets/fonts');
    Font.register({
      family: 'IBMPlexArabic',
      fonts: [
        { src: path.join(fontsDir, 'IBMPlexSansArabic-Regular.ttf') },
        { src: path.join(fontsDir, 'IBMPlexSansArabic-Bold.ttf'), fontWeight: 'bold' },
      ],
    });
    const element = React.createElement(InvoicePdf, { data: enriched });
    const instance = pdf(element as Parameters<typeof pdf>[0]);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
