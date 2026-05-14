import { listPublicEmployees } from '@/features/therapists/public';
import { getPublicCatalog } from '@/features/public-catalog/public';
import {
  fetchSiteSettingsMap,
  resolveFeatureCards,
  resolveHeroContent,
  resolveSectionIntros,
  type FeatureCards,
  type HeroContent,
  type HomeSectionIntros,
  type SiteSettingsMap,
} from '@/features/site-content/public';
import type { PublicEmployee } from '@deqah/api-client';
import { Blog } from '../components/sections/blog';
import { Clinics, type ClinicItem } from '../components/sections/clinics';
import { CTA } from '../components/sections/cta';
import { FAQ } from '../components/sections/faq';
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
  const [therapists, catalog, settings] = await Promise.all([
    safeFetch<PublicEmployee[]>(() => listPublicEmployees(), []),
    safeFetch(() => getPublicCatalog(), { departments: [], categories: [], services: [] }),
    safeFetch<SiteSettingsMap>(() => fetchSiteSettingsMap('home.'), new Map()),
  ]);

  const hero: HeroContent = resolveHeroContent(settings);
  const intros: HomeSectionIntros = resolveSectionIntros(settings);
  const featureCards: FeatureCards = resolveFeatureCards(settings);

  const clinics: ClinicItem[] = catalog.departments.map((d) => ({
    id: d.id,
    nameAr: d.nameAr,
    descriptionAr: d.descriptionAr,
    icon: d.icon,
    image: null,
  }));

  return (
    <>
      <Hero content={hero} />
      <Features intro={intros.features} cards={featureCards} />
      <Clinics clinics={clinics} intro={intros.clinics} />
      <SupportGroups intro={intros.supportGroups} />
      <Team therapists={therapists} intro={intros.team} />
      <Testimonials intro={intros.testimonials} />
      <Blog intro={intros.blog} />
      <CTA />
      <FAQ intro={intros.faq} />
    </>
  );
}
