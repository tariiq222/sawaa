import { describe, it, expect } from 'vitest';
import { resolveHeroContent } from './hero-content';
import { resolveSectionIntros } from './section-intros';

describe('resolveHeroContent — locale', () => {
  it('returns the Arabic defaults under the ar locale', () => {
    const hero = resolveHeroContent('ar');
    expect(hero.titlePrefix).toBe('رحلتك نحو');
    expect(hero.ctaPrimaryText).toBe('احجز موعدك');
  });

  it('defaults are byte-identical with and without an explicit ar locale', () => {
    expect(resolveHeroContent()).toEqual(resolveHeroContent('ar'));
  });

  it('returns the English defaults under the en locale', () => {
    const hero = resolveHeroContent('en');
    expect(hero.titlePrefix).toBe('Your journey toward');
    expect(hero.ctaPrimaryText).toBe('Book your appointment');
    // hrefs / media are locale-agnostic
    expect(hero.ctaPrimaryHref).toBe('/booking');
  });

  it('returns Arabic subtitle under the ar locale', () => {
    const hero = resolveHeroContent('ar');
    expect(hero.subtitle).toBe(
      'معالج يفهم ثقافتك، بيئة آمنة لا تحاسب، وسرّية مهنية تامة. جلسات حضورية في الرياض أو عن بُعد — متى ما كنت جاهزاً.',
    );
  });

  it('returns English subtitle under the en locale', () => {
    const hero = resolveHeroContent('en');
    expect(hero.subtitle).toBe(
      'A therapist who understands your culture, a safe non-judgmental space, and full professional confidentiality. In-person sessions in Riyadh or remote — whenever you are ready.',
    );
  });

  it('returns distinct values for ar and en locales', () => {
    const ar = resolveHeroContent('ar');
    const en = resolveHeroContent('en');
    expect(ar.titlePrefix).not.toBe(en.titlePrefix);
    expect(ar.ctaPrimaryText).not.toBe(en.ctaPrimaryText);
  });
});

describe('resolveSectionIntros — locale', () => {
  it('returns Arabic defaults under the ar locale', () => {
    const intros = resolveSectionIntros('ar');
    expect(intros.clinics.tag).toBe('عياداتنا');
    expect(intros.blog.titleHighlight).toBe('ونصائح');
  });

  it('defaults are byte-identical with and without an explicit ar locale', () => {
    expect(resolveSectionIntros()).toEqual(resolveSectionIntros('ar'));
  });

  it('returns English defaults under the en locale', () => {
    const intros = resolveSectionIntros('en');
    expect(intros.clinics.tag).toBe('Our Clinics');
    expect(intros.blog.titleHighlight).toBe('& tips');
  });

  it('returns all 8 section keys', () => {
    const intros = resolveSectionIntros('ar');
    const keys: (keyof typeof intros)[] = [
      'features', 'clinics', 'supportGroups', 'team',
      'testimonials', 'blog', 'faq', 'cta',
    ];
    for (const key of keys) {
      expect(intros[key]).toBeDefined();
      expect(typeof intros[key].tag).toBe('string');
    }
  });

  it('returns distinct values for ar and en locales', () => {
    const ar = resolveSectionIntros('ar');
    const en = resolveSectionIntros('en');
    expect(ar.clinics.tag).not.toBe(en.clinics.tag);
    expect(ar.blog.titleHighlight).not.toBe(en.blog.titleHighlight);
  });
});
