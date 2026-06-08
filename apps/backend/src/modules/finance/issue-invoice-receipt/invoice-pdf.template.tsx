import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import * as React from 'react';

const DEFAULT_BRAND = '#55CCB0';
const INK = '#1a1a1a';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const SOFT = '#f7f9f8';

/** Validate a hex color from tenant config; fall back to brand default. */
const safeBrand = (c: string | null | undefined): string =>
  c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_BRAND;

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 28,
    fontFamily: 'IBMPlexArabic',
    fontSize: 10,
    color: INK,
    direction: 'rtl',
  },

  // Header
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
  },
  brandBlock: { alignItems: 'flex-end', maxWidth: 240 },
  logo: { maxWidth: 150, maxHeight: 56, objectFit: 'contain', marginBottom: 4 },
  sellerName: { fontSize: 20, fontWeight: 'bold' },
  sellerSub: { fontSize: 9, color: MUTED, marginTop: 3, textAlign: 'right' },
  docTypeBox: { alignItems: 'flex-start' },
  docTitleAr: { fontSize: 13, fontWeight: 'bold' },
  docTitleEn: { fontSize: 8, color: MUTED, marginTop: 2, letterSpacing: 0.5 },
  invoiceNo: { fontSize: 9, color: MUTED, marginTop: 8 },
  invoiceNoVal: { fontSize: 12, fontWeight: 'bold', color: INK },

  // Info grid
  infoGrid: { flexDirection: 'row-reverse', marginTop: 18, gap: 12 },
  infoCard: { flex: 1, backgroundColor: SOFT, borderRadius: 6, padding: 12 },
  infoCardLabel: { fontSize: 8, color: MUTED, marginBottom: 6, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  infoKey: { fontSize: 9, color: MUTED },
  infoVal: { fontSize: 9, fontWeight: 'bold' },

  // Service line
  serviceTable: { marginTop: 18 },
  serviceHead: {
    flexDirection: 'row-reverse',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  serviceHeadText: { color: '#ffffff', fontSize: 9, fontWeight: 'bold' },
  serviceBody: {
    flexDirection: 'row-reverse',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottom: `1pt solid ${LINE}`,
    borderLeft: `1pt solid ${LINE}`,
    borderRight: `1pt solid ${LINE}`,
  },
  colDesc: { flex: 1, textAlign: 'right' },
  colAmt: { width: 90, textAlign: 'left' },

  // Totals
  totalsWrap: { flexDirection: 'row-reverse', marginTop: 14 },
  totalsBox: { width: 230, marginRight: 'auto' },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 4 },
  totalKey: { fontSize: 9, color: MUTED },
  totalVal: { fontSize: 9 },
  discountVal: { fontSize: 9, color: '#b91c1c' },
  grandRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 6,
  },
  grandKey: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  grandVal: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },

  // QR + footer
  bottom: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 28,
    paddingTop: 16,
    borderTop: `1pt solid ${LINE}`,
  },
  qrBox: { alignItems: 'center' },
  qr: { width: 96, height: 96 },
  qrCaption: { fontSize: 7, color: MUTED, marginTop: 4 },
  footerText: { fontSize: 7.5, color: MUTED, textAlign: 'left', maxWidth: 260, lineHeight: 1.5 },
  ref: { fontSize: 7, color: '#9ca3af', marginTop: 6 },
});

export interface InvoicePdfData {
  invoiceNumber: number;
  invoiceId: string;
  issuedAt: Date;
  paidAt: Date;
  sellerNameAr: string;
  sellerVatNumber: string | null;
  sellerAddress: string | null;
  /** Public logo URL from BrandingConfig; rendered in the header when present. */
  logoUrl: string | null;
  /** Brand primary color (#RRGGBB) from BrandingConfig; falls back to default. */
  brandColor: string | null;
  clientName: string;
  serviceName: string;
  subtotal: number;
  discountAmt: number;
  vatAmt: number;
  total: number;
  currency: string;
  paymentMethod: string;
  /** Base64 data URL for QR PNG. When null, no QR is rendered. */
  qrDataUrl: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'نقدي',
  CARD: 'بطاقة',
  TRANSFER: 'تحويل بنكي',
  MOYASAR: 'دفع إلكتروني',
};

const formatHalalas = (h: number) => (h / 100).toFixed(2);
const formatDate = (d: Date) => d.toISOString().slice(0, 10);
const formatDateTime = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

export const InvoicePdf: React.FC<{ data: InvoicePdfData }> = ({ data }) => {
  const cur = data.currency;
  const brand = safeBrand(data.brandColor);
  const netBeforeVat = data.subtotal - data.discountAmt;
  const hasVat = data.vatAmt > 0;
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { borderBottom: `2pt solid ${brand}` }]}>
          <View style={styles.brandBlock}>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logo} />
            ) : (
              <Text style={[styles.sellerName, { color: brand }]}>{data.sellerNameAr}</Text>
            )}
            {data.logoUrl ? <Text style={styles.sellerSub}>{data.sellerNameAr}</Text> : null}
            {data.sellerAddress ? <Text style={styles.sellerSub}>{data.sellerAddress}</Text> : null}
            {data.sellerVatNumber ? (
              <Text style={styles.sellerSub}>الرقم الضريبي: {data.sellerVatNumber}</Text>
            ) : null}
          </View>
          <View style={styles.docTypeBox}>
            <Text style={styles.docTitleAr}>{hasVat ? 'فاتورة ضريبية مبسطة' : 'فاتورة'}</Text>
            <Text style={styles.docTitleEn}>{hasVat ? 'SIMPLIFIED TAX INVOICE' : 'INVOICE'}</Text>
            <Text style={styles.invoiceNo}>رقم الفاتورة</Text>
            <Text style={styles.invoiceNoVal}>#{data.invoiceNumber}</Text>
          </View>
        </View>

        {/* Info cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>بيانات العميل</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>العميل</Text>
              <Text style={styles.infoVal}>{data.clientName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>طريقة الدفع</Text>
              <Text style={styles.infoVal}>{paymentLabel}</Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>تفاصيل الفاتورة</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>تاريخ الإصدار</Text>
              <Text style={styles.infoVal}>{formatDate(data.issuedAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>تاريخ الدفع</Text>
              <Text style={styles.infoVal}>{formatDateTime(data.paidAt)}</Text>
            </View>
          </View>
        </View>

        {/* Service line item */}
        <View style={styles.serviceTable}>
          <View style={[styles.serviceHead, { backgroundColor: brand }]}>
            <Text style={[styles.serviceHeadText, styles.colDesc]}>الوصف</Text>
            <Text style={[styles.serviceHeadText, styles.colAmt]}>المبلغ</Text>
          </View>
          <View style={styles.serviceBody}>
            <Text style={styles.colDesc}>{data.serviceName}</Text>
            <Text style={styles.colAmt}>
              {formatHalalas(data.subtotal)} {cur}
            </Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>المجموع قبل الضريبة</Text>
              <Text style={styles.totalVal}>
                {formatHalalas(netBeforeVat)} {cur}
              </Text>
            </View>
            {data.discountAmt > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalKey}>الخصم</Text>
                <Text style={styles.discountVal}>
                  -{formatHalalas(data.discountAmt)} {cur}
                </Text>
              </View>
            )}
            {hasVat && (
              <View style={styles.totalRow}>
                <Text style={styles.totalKey}>ضريبة القيمة المضافة</Text>
                <Text style={styles.totalVal}>
                  {formatHalalas(data.vatAmt)} {cur}
                </Text>
              </View>
            )}
            <View style={[styles.grandRow, { backgroundColor: brand }]}>
              <Text style={styles.grandKey}>الإجمالي</Text>
              <Text style={styles.grandVal}>
                {formatHalalas(data.total)} {cur}
              </Text>
            </View>
          </View>
        </View>

        {/* QR + footer */}
        <View style={styles.bottom}>
          {data.qrDataUrl ? (
            <View style={styles.qrBox}>
              <Image src={data.qrDataUrl} style={styles.qr} />
              <Text style={styles.qrCaption}>امسح للتحقق — هيئة الزكاة والضريبة والجمارك</Text>
            </View>
          ) : (
            <View />
          )}
          <View>
            <Text style={styles.footerText}>شكراً لكم.</Text>
            <Text style={styles.ref}>رقم المرجع: {data.invoiceId}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
