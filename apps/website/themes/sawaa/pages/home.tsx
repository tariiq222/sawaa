import { listPublicEmployees } from '@/features/therapists/public';
import { getPublicCatalog } from '@/features/public-catalog/public';
import { listPublicTestimonials } from '@/features/testimonials/public';
import {
  fetchSiteSettingsMap,
  resolveFeatureCards,
  resolveHeroContent,
  resolveSectionIntros,
  resolveBlogPosts,
  resolveFaqItems,
  resolveSupportGroups,
  type FeatureCards,
  type HeroContent,
  type HomeSectionIntros,
  type SiteSettingsMap,
  type BlogPost,
  type FaqItem,
  type SupportGroup,
} from '@/features/site-content/public';
import type { PublicEmployee } from '@sawaa/api-client';
import { getLocale } from '@/features/locale/public';
import { Blog } from '../components/sections/blog';
import { Clinics, type ClinicItem } from '../components/sections/clinics';
import dynamic from 'next/dynamic';

const FAQ = dynamic(() => import('../components/sections/faq').then((m) => m.FAQ), {
  loading: () => <div className="py-20" />,
});
import { CTA } from '../components/sections/cta';
import { Features } from '../components/sections/features';
import { Hero } from '../components/sections/hero';
import { SupportGroups } from '../components/sections/support-groups';
import { Team } from '../components/sections/team';
import { Testimonials } from '../components/sections/testimonials';

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function SawaaHomePage() {
  const [locale, [therapists, catalog, settings, testimonials]] = await Promise.all([
    getLocale(),
    Promise.all([
      safeFetch<PublicEmployee[]>(() => listPublicEmployees(), []),
      safeFetch(() => getPublicCatalog(), { departments: [], categories: [], services: [] }),
      safeFetch<SiteSettingsMap>(() => fetchSiteSettingsMap(), new Map()),
      safeFetch(() => listPublicTestimonials(6), []),
    ]),
  ]);

  const hero: HeroContent = resolveHeroContent(settings, locale);
  const intros: HomeSectionIntros = resolveSectionIntros(settings, locale);
  const featureCards: FeatureCards = resolveFeatureCards(settings);
  const blogPosts: BlogPost[] = resolveBlogPosts(settings);
  const faqItems: FaqItem[] = resolveFaqItems(settings);
  const supportGroups: SupportGroup[] = resolveSupportGroups(settings);

  const clinicsDept = catalog.departments.find((d) => d.nameAr === 'عيادات سواء');
  const clinics: ClinicItem[] = clinicsDept
    ? catalog.categories
        .filter((c) => c.departmentId === clinicsDept.id)
        .filter((c) => {
          // Hide clinics with no bookable services/therapists — they'd dead-end on the booking wizard.
          const categoryServiceIds = new Set(
            catalog.services.filter((s) => s.categoryId === c.id).map((s) => s.id),
          );
          if (categoryServiceIds.size === 0) return false;
          return therapists.some((th) =>
            th.serviceIds.some((id) => categoryServiceIds.has(id)),
          );
        })
        .map((c) => ({
          id: c.id,
          nameAr: c.nameAr,
          nameEn: c.nameEn,
          descriptionAr: null,
          descriptionEn: null,
          icon: null,
          image: null,
        }))
    : [];

  return (
    <>
      <Hero content={hero} />
      <Features intro={intros.features} cards={featureCards} />
      <Clinics clinics={clinics} intro={intros.clinics} />
      <SupportGroups intro={intros.supportGroups} items={supportGroups} />
      <Team therapists={therapists} intro={intros.team} />
      <Testimonials intro={intros.testimonials} items={testimonials} />
      <Blog intro={intros.blog} items={blogPosts} />
      <FAQ intro={intros.faq} items={faqItems} />
      <CTA />
    </>
  );
}
