import { getPublicCatalog } from '@/features/public-catalog/public';
import { fetchSiteSettingsMap, resolveSupportGroups } from '@/features/site-content/public';
import type { ThemeLayoutProps } from '../../types';
import { Footer, type FooterClinic } from '../components/layout/footer';
import { Navbar } from '../components/layout/navbar';
import { SkipLink } from '../components/ui/skip-link';
import '../theme.css';

async function loadFooterClinics(): Promise<FooterClinic[]> {
  try {
    const catalog = await getPublicCatalog();
    return catalog.departments
      .filter((d) => d.isActive && d.isVisible)
      .map((d) => ({ id: d.id, nameAr: d.nameAr }));
  } catch {
    return [];
  }
}

export async function SawaaLayout({ children }: ThemeLayoutProps) {
  const [clinics, settings] = await Promise.all([
    loadFooterClinics(),
    fetchSiteSettingsMap().catch(() => new Map()),
  ]);
  const supportGroups = resolveSupportGroups(settings);
  return (
    <div className="theme-sawaa">
      <SkipLink />
      <Navbar />
      <main id="main-content" className="relative pt-[88px]">
        {children}
      </main>
      <Footer clinics={clinics} supportGroups={supportGroups} />
    </div>
  );
}
