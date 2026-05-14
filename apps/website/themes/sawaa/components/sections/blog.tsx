import { ArrowLeft, FileText } from 'lucide-react';
import type { SectionIntro } from '@/features/site-content/public';
import { BLOG_POSTS } from '../../lib/constants';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  intro: SectionIntro;
}

export function Blog({ intro }: Props) {
  return (
    <section id="blog" className="py-20 md:py-24 relative sw-section-cream">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<FileText className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {BLOG_POSTS.map((p, i) => (
            <AnimatedSection key={p.title} delay={i * 80}>
              <article
                className="group h-full bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
                style={{
                  border: '1px solid var(--sw-neutral-100)',
                  boxShadow: 'var(--sw-shadow-xs)',
                }}
              >
                <div
                  className="h-[180px] sm:h-[200px] md:h-[220px] relative overflow-hidden"
                  style={{ background: 'var(--sw-neutral-100)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to top, color-mix(in srgb, var(--sw-secondary-900) 50%, transparent), transparent 50%)',
                    }}
                  />
                  <span
                    className="absolute top-4 end-4 bg-white text-[0.75rem] font-extrabold px-3.5 py-1.5 rounded-full"
                    style={{
                      color: 'var(--sw-primary-700)',
                      boxShadow: 'var(--sw-shadow-md)',
                    }}
                  >
                    {p.tag}
                  </span>
                  <span
                    className="absolute bottom-4 start-4 text-[0.75rem] font-semibold text-white/95 px-3 py-1 rounded-full"
                    style={{
                      background:
                        'color-mix(in srgb, var(--sw-secondary-900) 60%, transparent)',
                    }}
                  >
                    {p.date}
                  </span>
                </div>
                <div className="p-6">
                  <h3
                    className="text-[1.125rem] font-extrabold leading-[1.45] mb-3 transition-colors line-clamp-2"
                    style={{ color: 'var(--sw-secondary-700)' }}
                  >
                    {p.title}
                  </h3>
                  <div
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: '1px solid var(--sw-neutral-100)' }}
                  >
                    {p.author ? (
                      <p
                        className="text-[0.75rem] font-bold"
                        style={{ color: 'var(--sw-primary-600)' }}
                      >
                        {p.author}
                      </p>
                    ) : (
                      <p
                        className="text-[0.75rem] font-semibold"
                        style={{ color: 'var(--sw-neutral-500)' }}
                      >
                        فريق سواء
                      </p>
                    )}
                    <span
                      className="inline-flex items-center gap-1 text-[0.75rem] font-bold transition-all group-hover:gap-2"
                      style={{ color: 'var(--sw-primary-600)' }}
                    >
                      اقرأ <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
