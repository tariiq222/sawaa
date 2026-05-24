import { Injectable } from '@nestjs/common';
import * as React from 'react';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // Dynamic import: @react-pdf/renderer is pure ESM. Matches the
    // file-type pattern used elsewhere in the backend.
    const { pdf } = await import('@react-pdf/renderer');
    const element = React.createElement(InvoicePdf, { data });
    const instance = pdf(element as Parameters<typeof pdf>[0]);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
