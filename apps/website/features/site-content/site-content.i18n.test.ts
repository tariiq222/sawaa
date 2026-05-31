import { describe, it, expect } from 'vitest';
import { resolveHeroContent } from './hero-content';
import { resolveSectionIntros } from './section-intros';
import type { SiteSettingRow, SiteSettingsMap } from './types';

function row(partial: Partial<SiteSettingRow>): SiteSettingRow {
  return {
    key: partial.key ?? '',
    valueText: partial.valueText ?? null,
    valueAr: partial.valueAr ?? null,
    valueEn: partial.valueEn ?? null,
    valueJson: partial.valueJson ?? null,
    valueMedia: partial.valueMedia ?? null,
  };
}

function mapOf(rows: SiteSettingRow[]): SiteSettingsMap {
  return new Map(rows.map((r) => [r.key, r]));
}

describe('resolveHeroContent — locale', () => {
  it('returns the Arabic defaults under the ar locale', () => {
    const hero = resolveHeroContent(new Map(), 'ar');
    expect(hero.titlePrefix).toBe('رحلتك نحو');
    expect(hero.ctaPrimaryText).toBe('احجز موعدك');
  });

  it('defaults are byte-identical with and without an explicit ar locale', () => {
    expect(resolveHeroContent(new Map())).toEqual(resolveHeroContent(new Map(), 'ar'));
  });

  it('returns the English defaults under the en locale', () => {
    const hero = resolveHeroContent(new Map(), 'en');
    expect(hero.titlePrefix).toBe('Your journey toward');
    expect(hero.ctaPrimaryText).toBe('Book your appointment');
    // hrefs / media are locale-agnostic
    expect(hero.ctaPrimaryHref).toBe('/booking');
  });

  it('prefers the .en setting value under the en locale', () => {
    const map = mapOf([
      row({ key: 'home.hero.titlePrefix.en', valueEn: 'Begin your path to' }),
    ]);
    expect(resolveHeroContent(map, 'en').titlePrefix).toBe('Begin your path to');
  });

  it('falls back to the admin-provided Arabic value when no .en setting exists', () => {
    // Documented behavior: prefer the *En field, fall back to the AR value when EN is missing.
    const map = mapOf([
      row({ key: 'home.hero.subtitle.ar', valueAr: 'نص عربي' }),
    ]);
    expect(resolveHeroContent(map, 'en').subtitle).toBe('نص عربي');
  });

  it('falls back to the English default when neither .en nor .ar settings exist', () => {
    const hero = resolveHeroContent(new Map(), 'en');
    expect(hero.subtitle).toBe(
      'A therapist who understands your culture, a safe non-judgmental space, and full professional confidentiality. In-person sessions in Riyadh or remote — whenever you are ready.',
    );
  });

  it('keeps Arabic settings intact under the ar locale', () => {
    const map = mapOf([
      row({ key: 'home.hero.titlePrefix.ar', valueAr: 'ابدأ رحلتك' }),
    ]);
    expect(resolveHeroContent(map, 'ar').titlePrefix).toBe('ابدأ رحلتك');
  });
});

describe('resolveSectionIntros — locale', () => {
  it('returns Arabic defaults under the ar locale', () => {
    const intros = resolveSectionIntros(new Map(), 'ar');
    expect(intros.clinics.tag).toBe('عياداتنا');
    expect(intros.blog.titleHighlight).toBe('ونصائح');
  });

  it('defaults are byte-identical with and without an explicit ar locale', () => {
    expect(resolveSectionIntros(new Map())).toEqual(resolveSectionIntros(new Map(), 'ar'));
  });

  it('returns English defaults under the en locale', () => {
    const intros = resolveSectionIntros(new Map(), 'en');
    expect(intros.clinics.tag).toBe('Our Clinics');
    expect(intros.blog.titleHighlight).toBe('& tips');
  });

  it('prefers the .en setting value under the en locale', () => {
    const map = mapOf([
      row({ key: 'home.clinics.tag.en', valueEn: 'Clinics' }),
    ]);
    expect(resolveSectionIntros(map, 'en').clinics.tag).toBe('Clinics');
  });

  it('falls back to the admin-provided Arabic value when no .en setting exists', () => {
    const map = mapOf([
      row({ key: 'home.clinics.tag.ar', valueAr: 'عياداتنا المحدثة' }),
    ]);
    expect(resolveSectionIntros(map, 'en').clinics.tag).toBe('عياداتنا المحدثة');
  });

  it('falls back to the English default when neither .en nor .ar settings exist', () => {
    expect(resolveSectionIntros(new Map(), 'en').clinics.tag).toBe('Our Clinics');
  });
});
