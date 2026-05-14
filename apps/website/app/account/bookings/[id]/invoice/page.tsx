import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { InvoiceView } from '@/features/account/invoice-view';
import { getMyBookingInvoice } from '@/features/account/invoice.api';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export const dynamic = 'force-dynamic';

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountBookingInvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  let invoice;
  try {
    invoice = await getMyBookingInvoice(id, cookieHeader);
  } catch {
    notFound();
  }

  const branding = await getPublicBrandingForSsr();
  const Layout = themes[branding.activeWebsiteTheme].Layout;

  return (
    <Layout>
      <InvoiceView invoice={invoice} />
    </Layout>
  );
}
