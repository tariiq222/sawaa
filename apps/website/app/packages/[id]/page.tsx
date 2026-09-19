import { theme } from '@/themes/registry';

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const Layout = theme.Layout;
  return <Layout><theme.pages.packageDetail familyId={id} /></Layout>;
}
