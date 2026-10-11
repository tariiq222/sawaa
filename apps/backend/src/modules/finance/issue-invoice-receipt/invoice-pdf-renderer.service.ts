import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as React from "react";
import * as QRCode from "qrcode";
import { InvoicePdf, type InvoicePdfData } from "./invoice-pdf.template";
import { buildZatcaQrTlv } from "../zatca/build-qr-tlv";
import { withFreshInvoiceFonts } from "./with-fresh-invoice-fonts";

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // If a QR data URL was supplied by the caller, use it as-is. Otherwise
    // derive the ZATCA Phase 1 TLV payload and rasterize it into a PNG data
    // URL embedded in the PDF. The ZATCA QR identifies a VAT-registered
    // seller, so it is produced only once the org saves its real VAT
    // registration number in settings; without one the invoice prints with
    // no QR (as the settings screen states). Never invent a number.
    // Only a receipt carries a QR, and its timestamp is the real payment time:
    // without `paidAt` there is nothing truthful to stamp, so no QR is made.
    let qrDataUrl: string | null = data.kind === "receipt" ? data.qrDataUrl : null;
    if (!qrDataUrl && data.kind === "receipt" && data.sellerVatNumber && data.paidAt) {
      const tlv = buildZatcaQrTlv({
        sellerName: data.sellerNameAr,
        vatNumber: data.sellerVatNumber,
        timestamp: data.paidAt,
        totalWithVat: (data.total / 100).toFixed(2),
        vatTotal: (data.vatAmt / 100).toFixed(2),
      });
      qrDataUrl = await QRCode.toDataURL(tlv, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      });
    }

    const enriched: InvoicePdfData = { ...data, qrDataUrl };

    // Dynamic import: @react-pdf/renderer is pure ESM. Matches the
    // file-type pattern used elsewhere in the backend.
    //
    // Use the same ESM font store as the renderer, with fresh font sources
    // and a shared gate for queued/on-demand receipt generation.
    const { pdf, Font } = await import("@react-pdf/renderer");
    const fontsDir = path.join(__dirname, "../../../../assets/fonts");
    return withFreshInvoiceFonts(Font, fontsDir, async () => {
      const element = React.createElement(InvoicePdf, { data: enriched });
      const instance = pdf(element as Parameters<typeof pdf>[0]);
      const blob = await instance.toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      return Buffer.from(arrayBuffer);
    });
  }
}
