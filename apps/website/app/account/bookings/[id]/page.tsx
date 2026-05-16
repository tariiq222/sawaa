import { theme } from '@/themes/registry';

interface AccountBookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountBookingDetailPage({ params }: AccountBookingDetailPageProps) {
  const AccountBookingDetailComponent = theme.pages.accountBookingDetail;
  const Layout = theme.Layout;
  const resolvedParams = await params;

  return (
    <Layout>
      <AccountBookingDetailComponent bookingId={resolvedParams.id} />
    </Layout>
  );
}
