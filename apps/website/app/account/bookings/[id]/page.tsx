import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

interface AccountBookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountBookingDetailPage({ params }: AccountBookingDetailPageProps) {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const AccountBookingDetailComponent = theme.pages.accountBookingDetail;
  const Layout = theme.Layout;
  const resolvedParams = await params;

  return (
    <Layout>
      <AccountBookingDetailComponent bookingId={resolvedParams.id} />
    </Layout>
  );
}
