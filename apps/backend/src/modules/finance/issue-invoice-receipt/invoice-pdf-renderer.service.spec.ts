import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import type { InvoicePdfData } from './invoice-pdf.template';

describe('InvoicePdfRendererService', () => {
  const baseData: InvoicePdfData = {
    invoiceNumber: 42,
    invoiceId: 'inv-abc',
    issuedAt: new Date('2026-05-24T10:00:00Z'),
    paidAt: new Date('2026-05-24T10:05:00Z'),
    sellerNameAr: 'مركز سواء',
    sellerVatNumber: '300000000000003',
    sellerAddress: 'الرياض',
    clientName: 'فاطمة',
    serviceName: 'استشارة أسرية',
    subtotal: 10000,
    discountAmt: 0,
    vatAmt: 1500,
    total: 11500,
    currency: 'SAR',
    paymentMethod: 'CASH',
    qrDataUrl: null,
  };

  it('renders a non-empty PDF buffer starting with %PDF', async () => {
    const service = new InvoicePdfRendererService();
    const buf = await service.render(baseData);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  }, 30_000);
});
