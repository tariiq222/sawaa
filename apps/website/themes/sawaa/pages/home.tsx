import { listPublicEmployees } from '@/features/therapists/public';
import {
  getPublicCatalog,
  selectBookableClinicServices,
} from '@/features/public-catalog/public';
import { listPublicTestimonials } from '@/features/testimonials/public';
import {
  getPublicGroupSessionsResult,
  type SupportGroup,
  type PublicProgramsResult,
} from '@/features/support-groups/support-groups.api';
import {
  resolveFeatureCards,
  resolveHeroContent,
  resolveSectionIntros,
  resolveBlogPosts,
  resolveFaqItems,
  type FeatureCards,
  type HeroContent,
  type HomeSectionIntros,
  type BlogPost,
  type FaqItem,
} from '@/features/site-content/public';
import type { PublicEmployee } from '@sawaa/api-client';
import { getLocale } from '@/features/locale/public';
import { Blog } from '../components/sections/blog';
import { Services } from '../components/sections/services';
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
  const [locale, [therapists, catalog, testimonials, programsResult]] = await Promise.all([
    getLocale(),
    Promise.all([
      safeFetch<PublicEmployee[]>(() => listPublicEmployees(), []),
      safeFetch(() => getPublicCatalog(), { departments: [], categories: [], services: [] }),
      safeFetch(() => listPublicTestimonials(6), []),
      safeFetch<PublicProgramsResult>(() => getPublicGroupSessionsResult(), {
        programs: [] as SupportGroup[],
        status: 'error',
      }),
    ]),
  ]);
  // NOTE: getPublicCatalog is also called by SawaaLayout for the footer clinics;
  // the API is wrapped in React.cache so both consumers share one network request
  // (and one 3s timeout) per render instead of paying it twice.

  const hero: HeroContent = resolveHeroContent(locale);
  const intros: HomeSectionIntros = resolveSectionIntros(locale);
  const featureCards: FeatureCards = resolveFeatureCards();
  const blogPosts: BlogPost[] = resolveBlogPosts();
  const faqItems: FaqItem[] = resolveFaqItems();
  const services = selectBookableClinicServices(catalog, therapists);

  return (
    <>
      <Hero content={hero} />
      <Features intro={intros.features} cards={featureCards} />
      <Services services={services} intro={intros.services} vatRate={catalog.vatRate ?? 0} />
      <SupportGroups
        intro={intros.supportGroups}
        items={programsResult.programs}
        loadFailed={programsResult.status === 'error'}
      />
      <Team therapists={therapists} intro={intros.team} />
      <Testimonials intro={intros.testimonials} items={testimonials} />
      <Blog intro={intros.blog} items={blogPosts} />
      <FAQ intro={intros.faq} items={faqItems} />
      <CTA />
    </>
  );
}
