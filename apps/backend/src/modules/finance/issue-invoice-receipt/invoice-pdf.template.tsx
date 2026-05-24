import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import * as path from 'path';
import * as React from 'react';

Font.register({
  family: 'IBMPlexArabic',
  fonts: [
    { src: path.join(__dirname, '../../../../assets/fonts/IBMPlexSansArabic-Regular.ttf') },
    { src: path.join(__dirname, '../../../../assets/fonts/IBMPlexSansArabic-Bold.ttf'), fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'IBMPlexArabic', fontSize: 11 },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 'bold' },
  meta: { marginVertical: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  table: { marginTop: 16, borderTop: '1pt solid #000', borderBottom: '1pt solid #000', paddingVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  grandTotal: { fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  qrSection: { marginTop: 24, alignItems: 'center' },
  qr: { width: 120, height: 120 },
  footer: { marginTop: 24, fontSize: 9, textAlign: 'center', color: '#666' },
});

export interface InvoicePdfData {
  invoiceNumber: number;
  invoiceId: string;
  issuedAt: Date;
  paidAt: Date;
  sellerNameAr: string;
  sellerVatNumber: string | null;
  sellerAddress: string | null;
  clientName: string;
  serviceName: string;
  subtotal: number;
  discountAmt: number;
  vatAmt: number;
  total: number;
  currency: string;
  paymentMethod: string;
  /** Base64 data URL for QR PNG. When null, no QR is rendered (Phase 2 default). */
  qrDataUrl: string | null;
}

const formatHalalas = (h: number) => (h / 100).toFixed(2);

export const InvoicePdf: React.FC<{ data: InvoicePdfData }> = ({ data }) => (
  <Document>
    <Page size="A5" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{data.sellerNameAr}</Text>
        <Text>فاتورة ضريبية مبسطة</Text>
        <Text>Simplified Tax Invoice</Text>
      </View>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text>رقم الفاتورة:</Text>
          <Text>#{data.invoiceNumber}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>تاريخ الإصدار:</Text>
          <Text>{data.issuedAt.toISOString().slice(0, 10)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>تاريخ الدفع:</Text>
          <Text>{data.paidAt.toISOString().slice(0, 16).replace('T', ' ')}</Text>
        </View>
        {data.sellerVatNumber && (
          <View style={styles.metaRow}>
            <Text>الرقم الضريبي:</Text>
            <Text>{data.sellerVatNumber}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text>العميل:</Text>
          <Text>{data.clientName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>الخدمة:</Text>
          <Text>{data.serviceName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>طريقة الدفع:</Text>
          <Text>{data.paymentMethod}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.totalRow}>
          <Text>المجموع قبل الضريبة:</Text>
          <Text>{formatHalalas(data.subtotal - data.discountAmt)} {data.currency}</Text>
        </View>
        {data.discountAmt > 0 && (
          <View style={styles.totalRow}>
            <Text>الخصم:</Text>
            <Text>-{formatHalalas(data.discountAmt)} {data.currency}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text>ضريبة القيمة المضافة (15%):</Text>
          <Text>{formatHalalas(data.vatAmt)} {data.currency}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text>الإجمالي:</Text>
          <Text>{formatHalalas(data.total)} {data.currency}</Text>
        </View>
      </View>

      {data.qrDataUrl && (
        <View style={styles.qrSection}>
          <Image src={data.qrDataUrl} style={styles.qr} />
          <Text style={{ fontSize: 9, marginTop: 4 }}>امسح الباركود للتحقق</Text>
        </View>
      )}

      <Text style={styles.footer}>
        رقم المرجع: {data.invoiceId}
      </Text>
    </Page>
  </Document>
);
