import type { Metadata } from 'next';
import { theme } from '@/themes/registry';

export const metadata: Metadata = { title: 'Therapy packages | Sawaa' };

export default function PackagesPage() {
  const Layout = theme.Layout;
  return <Layout><theme.pages.packages /></Layout>;
}
