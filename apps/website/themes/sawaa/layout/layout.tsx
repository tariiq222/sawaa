import {
  getPublicCatalog,
  selectBookableClinicServices,
} from '@/features/public-catalog/public';
import {
  getPublicGroupSessions,
  type SupportGroup,
} from '@/features/support-groups/support-groups.api';
import { listPublicEmployees } from '@/features/therapists/public';
import type { ThemeLayoutProps } from '../../types';
import { Footer, type FooterService } from '../components/layout/footer';
import { Navbar } from '../components/layout/navbar';
import { SkipLink } from '../components/ui/skip-link';
import '../theme.css';

async function loadFooterServices(): Promise<FooterService[]> {
  try {
    const [catalog, employees] = await Promise.all([
      getPublicCatalog(),
      listPublicEmployees(),
    ]);
    return selectBookableClinicServices(catalog, employees).map(({ service }) => ({
      id: service.id,
      nameAr: service.nameAr,
      nameEn: service.nameEn,
    }));
  } catch {
    return [];
  }
}

export async function SawaaLayout({ children }: ThemeLayoutProps) {
  const [services, supportGroups] = await Promise.all([
    loadFooterServices(),
    getPublicGroupSessions()
      .then((programs) => programs.slice(0, 6))
      .catch(() => [] as SupportGroup[]),
  ]);
  return (
    <div className="theme-sawaa">
      <SkipLink />
      <Navbar />
      <main id="main-content" tabIndex={-1} className="relative pt-[88px] focus:outline-none">
        {children}
      </main>
      <Footer services={services} supportGroups={supportGroups} />
    </div>
  );
}
