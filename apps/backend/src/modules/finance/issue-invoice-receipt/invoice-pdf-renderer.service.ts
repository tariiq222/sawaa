import { Injectable } from '@nestjs/common';
import { type DocumentProps, pdf } from '@react-pdf/renderer';
import * as React from 'react';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // `pdf()` is typed to accept `ReactElement<DocumentProps>` (i.e. a
    // <Document>) directly. Our template wraps its own <Document>, so cast
    // through the expected element type. At runtime react-pdf walks the
    // tree from whatever root element it receives.
    const element = React.createElement(
      InvoicePdf,
      { data },
    ) as React.ReactElement<DocumentProps>;
    const instance = pdf(element);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
