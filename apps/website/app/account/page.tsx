import { theme } from '@/themes/registry';

export default async function AccountPage() {
  const AccountComponent = theme.pages.account;
  const Layout = theme.Layout;

  return (
    <Layout>
      <AccountComponent />
    </Layout>
  );
}
