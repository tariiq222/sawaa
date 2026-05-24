import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import type { InvoicePdfData } from './invoice-pdf.template';
import { buildZatcaQrTlv } from '../zatca/build-qr-tlv';

// Mock `qrcode` so the renderer-level tests can verify the wiring
// (TLV → QRCode.toDataURL) without rasterizing a real PNG and without
// fighting the frozen ES-module namespace object that `import * as QRCode`
// produces under ts-jest.
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require('qrcode') as { toDataURL: jest.Mock };

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

  beforeEach(() => {
    QRCode.toDataURL.mockReset();
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,STUB');
  });

  it('renders a non-empty PDF buffer starting with %PDF', async () => {
    const service = new InvoicePdfRendererService();
    const buf = await service.render(baseData);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  }, 30_000);

  // The renderer-level integration test for "/Image" PDF content cannot be
  // run against the @react-pdf/renderer CJS mock used in this Jest config
  // (the mock emits a fixed fake PDF skeleton — see
  // src/__mocks__/react-pdf-renderer.ts). Instead we verify the actual
  // wiring this file is responsible for: building the ZATCA TLV from the
  // invoice fields and asking QRCode to rasterize it before handing the
  // resulting data URL to the template. Visual QR rendering is covered by
  // the out-of-VM integration smoke tests.
  describe('ZATCA QR wiring', () => {
    it('builds a QR code from the ZATCA TLV when sellerVatNumber is provided', async () => {
      const service = new InvoicePdfRendererService();
      await service.render({ ...baseData, sellerVatNumber: '310122393500003' });

      const expectedTlv = buildZatcaQrTlv({
        sellerName: baseData.sellerNameAr,
        vatNumber: '310122393500003',
        timestamp: baseData.paidAt,
        totalWithVat: (baseData.total / 100).toFixed(2),
        vatTotal: (baseData.vatAmt / 100).toFixed(2),
      });

      expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        expectedTlv,
        expect.objectContaining({
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 240,
        }),
      );
    }, 30_000);

    it('omits the QR when sellerVatNumber is null', async () => {
      const service = new InvoicePdfRendererService();
      await service.render({ ...baseData, sellerVatNumber: null });
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
    }, 30_000);

    it('preserves an incoming qrDataUrl without recomputing', async () => {
      const service = new InvoicePdfRendererService();
      await service.render({
        ...baseData,
        sellerVatNumber: '310122393500003',
        qrDataUrl: 'data:image/png;base64,CALLER_PROVIDED',
      });
      expect(QRCode.toDataURL).not.toHaveBeenCalled();
    }, 30_000);
  });
});
