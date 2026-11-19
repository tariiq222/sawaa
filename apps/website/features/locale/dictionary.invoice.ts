// Website dictionary — feature group: invoice.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'invoice.title': 'فاتورة',
  'invoice.issueDate': 'تاريخ الإصدار',
  'invoice.status': 'الحالة',
  'invoice.subtotal': 'المجموع الفرعي',
  'invoice.discount': 'الخصم',
  'invoice.vat': 'ضريبة القيمة المضافة',
  'invoice.total': 'الإجمالي',
  'invoice.print': 'طباعة الفاتورة',
} as const;

const en: Record<keyof typeof ar, string> = {
  'invoice.title': 'Invoice',
  'invoice.issueDate': 'Issue Date',
  'invoice.status': 'Status',
  'invoice.subtotal': 'Subtotal',
  'invoice.discount': 'Discount',
  'invoice.vat': 'VAT',
  'invoice.total': 'Total',
  'invoice.print': 'Print Invoice',
};

export const invoiceDictionary: LocalizedDictionary<typeof ar> = { ar, en };
