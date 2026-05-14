import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

interface AccountBookingsPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export default async function AccountBookingsPage({ searchParams }: AccountBookingsPageProps) {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const AccountBookingsComponent = theme.pages.accountBookings;
  const Layout = theme.Layout;

  return (
    <Layout>
      <AccountBookingsComponent searchParams={searchParams} />
    </Layout>
  );
}
