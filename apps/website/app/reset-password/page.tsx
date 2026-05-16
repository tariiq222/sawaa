import { theme } from '@/themes/registry';

export default async function ResetPasswordPage() {
  const ResetPasswordComponent = theme.pages.resetPassword;
  const Layout = theme.Layout;

  return (
    <Layout>
      <ResetPasswordComponent />
    </Layout>
  );
}
