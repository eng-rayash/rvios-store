import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Reveal } from '@/components/ui/reveal';
import { SectorPlate } from '@/components/marketing/sector-plate';
import { SECTORS } from '@/lib/sectors';

export const metadata: Metadata = {
  title: 'القطاعات',
  description:
    'الثيم الموحّد بُني ليكون محايداً: شبكة تتعامل مع صور بأي أبعاد بلا كسر، وتصنيفات تكتبها أنت بنفسك.',
};

/**
 * صفحة القطاعات.
 *
 * القائمة تأتي من `@/lib/sectors` — المصدر نفسه الذي يقرأه مُنتقي
 * الإعداد، فلا تَعِد الصفحةُ بقطاع لا يجده التاجر عند التسجيل.
 *
 * ملاحظة على الصدق: هذه القطاعات **أمثلة لا قوالب**. المنصة لا
 * تملك ثيماً خاصاً بالعطور وآخر بالإلكترونيات، والادّعاء بذلك
 * كذب يكتشفه التاجر في أول دقيقة. الصفحة تقول ذلك صراحةً في
 * آخرها بدل أن توحي بعكسه — وتوسّع القائمة لا يغيّر ذلك.
 */
export default function SectorsPage() {
  return (
    <>
      <Header />
      <main className="pt-28">
        <section className="bay bg-cream pt-10">
          <div className="wrap">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-3.5 text-xs font-extrabold tracking-[.2em] text-brass-deep">القطاعات</p>
              <h1 className="mb-4 font-display text-h1 leading-snug font-bold text-balance">
                متجرك بنفس البساطة، أياً كان مجالك
              </h1>
              <p className="text-md leading-loose text-soft text-pretty">
                الثيم الموحّد بُني ليكون محايداً: شبكة تتعامل مع صور بأي أبعاد بلا كسر،
                وتصنيفات تكتبها أنت بنفسك بدل قوائم مفروضة لا تناسب نشاطك.
              </p>
            </Reveal>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SECTORS.map((s, i) => (
                <Reveal key={s.id} delay={(i % 3) * 0.08}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-paper
                                      transition-[transform,box-shadow] duration-300
                                      hover:-translate-y-1 hover:shadow-lift">
                    <div className="overflow-hidden bg-sand">
                      <SectorPlate sector={s} size={560} pad="7%" />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="mb-2 font-display text-h3 font-bold">{s.name}</h2>
                      <p className="mb-4 flex-1 text-sm leading-loose text-soft text-pretty">{s.blurb}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.tags.map((t) => (
                          <span key={t} className="rounded-pill bg-sand px-2.5 py-1 text-xs font-bold text-soft">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.15}>
              <div className="mx-auto mt-14 max-w-2xl rounded-xl border border-line bg-paper p-8 text-center">
                <h2 className="mb-3 font-display text-h3 font-bold">لا ترى نشاطك في القائمة؟</h2>
                <p className="mb-6 text-sm leading-loose text-soft text-pretty">
                  هذه أمثلة لا قوالب. الثيم عام بالكامل ولا يفترض قطاعاً بعينه —
                  أنشئ متجرك واكتب تصنيفاتك كما تريدها تماماً.
                </p>
                <Link
                  href="/onboarding"
                  className="group inline-flex items-center gap-2.5 rounded-pill bg-ink px-7 py-3.5
                             text-md font-bold text-cream transition-transform hover:-translate-y-0.5"
                >
                  ابدأ متجرك مجاناً
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
