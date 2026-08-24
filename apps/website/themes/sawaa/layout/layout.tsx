import type { ThemeLayoutProps } from '../../types';
import { Footer } from '../components/layout/footer';
import { Navbar } from '../components/layout/navbar';
import { SkipLink } from '../components/ui/skip-link';
import '../theme.css';

export async function SawaaLayout({ children }: ThemeLayoutProps) {
  return (
    <div className="theme-sawaa">
      <SkipLink />
      <Navbar />
      <main id="main-content" tabIndex={-1} className="relative pt-[88px] focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
