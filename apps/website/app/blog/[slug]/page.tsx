import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Calendar, Tag, User } from 'lucide-react';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { fetchSiteSettingsMap, resolveBlogPosts } from '@/features/site-content/public';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { theme } from '@/themes/registry';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const branding = await getPublicBrandingForSsr();
  const settings = await fetchSiteSettingsMap().catch(() => new Map());
  const posts = resolveBlogPosts(settings);
  const post = posts.find((p) => p.slug === slug);

  return buildPageMetadata({
    branding,
    path: `/blog/${slug}`,
    titleAr: post?.title ?? slug,
    descriptionAr: post?.title ?? '',
  });
}

export default async function BlogPostRoute({ params }: Props) {
  const { slug } = await params;
  const settings = await fetchSiteSettingsMap().catch(() => new Map());
  const posts = resolveBlogPosts(settings);
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const otherPosts = posts.filter((p) => p.slug !== slug).slice(0, 3);
  const Layout = theme.Layout;

  return (
    <Layout>
      <article>
        {/* ─── Hero: title + meta + image ─── */}
        <section
          className="relative -mt-[88px] pt-[112px] md:pt-[128px] pb-12 md:pb-16 overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 720px 420px at 92% 8%, color-mix(in srgb, var(--accent) 7%, transparent) 0%, transparent 60%),' +
              'radial-gradient(ellipse 640px 380px at 5% 95%, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 60%),' +
              'linear-gradient(180deg, #FBF7F2 0%, #FDFAF6 100%)',
          }}
        >
          <div className="max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
            {/* Breadcrumb */}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium mb-8 transition-colors hover:opacity-70"
              style={{ color: 'var(--sw-neutral-500)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              العودة للرئيسية
            </Link>

            <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
              {/* Text column */}
              <div className="md:col-span-7 lg:col-span-8">
                {/* Eyebrow */}
                <div
                  className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-4"
                  style={{ color: 'var(--sw-primary-700)' }}
                >
                  <Tag className="w-3 h-3" />
                  {post.tag}
                </div>

                {/* Title */}
                <h1
                  className="font-extrabold tracking-tight mb-6"
                  style={{
                    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                    lineHeight: 1.12,
                    color: 'var(--sw-secondary-700)',
                    letterSpacing: '-0.02em',
                    maxWidth: '22ch',
                  }}
                >
                  {post.title}
                </h1>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4">
                  <span
                    className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {post.date}
                  </span>
                  {post.author && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
                      style={{ color: 'var(--sw-neutral-500)' }}
                    >
                      <User className="w-3.5 h-3.5" />
                      {post.author}
                    </span>
                  )}
                </div>
              </div>

              {/* Image column */}
              <div className="md:col-span-5 lg:col-span-4">
                <div
                  className="relative aspect-[4/3] w-full rounded-[24px] overflow-hidden"
                  style={{
                    background: 'var(--sw-neutral-100)',
                    boxShadow: 'var(--sw-shadow-md)',
                  }}
                >
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 380px, (min-width: 768px) 42vw, 100vw"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Content ─── */}
        <section className="py-12 md:py-16">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
            <div className="md:grid md:grid-cols-12 md:gap-12">
              <div className="md:col-span-8 lg:col-span-7">
                {post.content ? (
                  <div
                    className="text-[1rem] md:text-[1.0625rem]"
                    style={{
                      color: 'var(--sw-body)',
                      lineHeight: 1.9,
                      maxWidth: '60ch',
                    }}
                  >
                    <h2
                      className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-4"
                      style={{ color: 'var(--sw-neutral-500)' }}
                    >
                      المحتوى
                    </h2>
                    {post.content.split('\n').map((paragraph, i) => (
                      <p key={i} className="mb-5 whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div
                    className="text-center py-16 rounded-2xl"
                    style={{
                      background: 'var(--sw-neutral-50)',
                      border: '1px dashed var(--sw-neutral-200)',
                    }}
                  >
                    <p
                      className="text-[0.875rem] font-medium"
                      style={{ color: 'var(--sw-neutral-400)' }}
                    >
                      المحتوى قيد الإعداد
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Other posts ─── */}
        {otherPosts.length > 0 && (
          <section className="py-16 md:py-20 sw-section-cream">
            <div className="max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
              <div className="flex items-end justify-between gap-6 mb-8">
                <h2
                  className="font-extrabold tracking-tight"
                  style={{
                    fontSize: 'clamp(1.25rem, 2.4vw, 1.625rem)',
                    color: 'var(--sw-secondary-700)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  مقالات أخرى
                </h2>
                <Link
                  href="/"
                  className="hidden sm:inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold transition-all hover:gap-2.5"
                  style={{ color: 'var(--sw-secondary-700)' }}
                >
                  العودة للرئيسية
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {otherPosts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group block h-full"
                  >
                    <article
                      className="h-full bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
                      style={{
                        border: '1px solid var(--sw-neutral-100)',
                        boxShadow: 'var(--sw-shadow-xs)',
                      }}
                    >
                      <div
                        className="h-[180px] relative overflow-hidden"
                        style={{ background: 'var(--sw-neutral-100)' }}
                      >
                        <Image
                          src={p.image}
                          alt={p.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width:640px) 100vw, (max-width:768px) 50vw, 33vw"
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
                      </div>
                      <div className="p-5">
                        <h3
                          className="text-[1rem] font-extrabold leading-[1.5] mb-2 line-clamp-2"
                          style={{ color: 'var(--sw-secondary-700)' }}
                        >
                          {p.title}
                        </h3>
                        <div
                          className="flex items-center justify-between pt-3"
                          style={{ borderTop: '1px solid var(--sw-neutral-100)' }}
                        >
                          <span
                            className="text-[0.75rem] font-semibold"
                            style={{ color: 'var(--sw-neutral-500)' }}
                          >
                            {p.date}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-[0.75rem] font-bold transition-all group-hover:gap-2"
                            style={{ color: 'var(--sw-primary-600)' }}
                          >
                            اقرأ <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </Layout>
  );
}
