import { getPublicCatalog } from '@/features/public-catalog/public';
import type { ThemeLayoutProps } from '../../types';
import { Footer, type FooterClinic } from '../components/layout/footer';
import { Navbar } from '../components/layout/navbar';
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
  const clinics = await loadFooterClinics();
  return (
    <div className="theme-sawaa">
      <Navbar />
      <main className="relative">{children}</main>
      <Footer clinics={clinics} />
    </div>
  );
}
