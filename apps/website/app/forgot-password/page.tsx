import { theme } from '@/themes/registry';

export default async function ForgotPasswordPage() {
  const ForgotPasswordComponent = theme.pages.forgotPassword;
  const Layout = theme.Layout;

  return (
    <Layout>
      <ForgotPasswordComponent />
    </Layout>
  );
}
