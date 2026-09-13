import type { Metadata } from 'next';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Reveal, SectionHead } from '@/components/ui/reveal';
import { PlanCard } from '@/components/marketing/plan-card';
import { Comparison, Addons } from '@/components/marketing/sections';
import { TierStudio } from '@/components/marketing/tier-studio';
import { Faq, type QA } from '@/components/marketing/faq';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { planPrices } from '@/lib/plans.server';

export const metadata: Metadata = {
  title: 'الباقات',
  description:
    'ابدأ مجاناً حتى ١٥ منتجاً، وانتقل متى احتجت مساحة أكبر. لا عمولة على مبيعاتك — الاشتراك فقط.',
};

export const revalidate = 600;

const FAQ: QA[] = [
  {
    q: 'هل تأخذون عمولة على مبيعاتي؟',
    a: 'لا. الدفع يتم بينك وبين عميلك مباشرة، والمنصة لا تلمس أموال المبيعات إطلاقاً. مصدر دخلنا هو الاشتراك فقط.',
  },
  {
    q: 'ماذا يحدث إن تجاوزت حد الباقة المجانية؟',
    a: 'يبقى متجرك ومنتجاتك كما هي، لكن لن تتمكن من إضافة منتج جديد حتى ترقّي باقتك أو تحذف منتجاً. لا نحذف شيئاً ولا نُغلق متجرك.',
  },
  {
    q: 'كيف أدفع الاشتراك؟',
    a: 'التحصيل في المرحلة الحالية يدوي عبر التحويل أو المحفظة المحلية، ونعمل على تفعيل الدفع داخل المنصة.',
  },
  {
    q: 'هل يمكنني تغيير رابط متجري لاحقاً؟',
    a: 'نعم، من إعدادات المتجر. والرابط القديم يظل يعمل ويحوّل إلى الجديد، فلا تخسر ما نشرته في محادثاتك السابقة.',
  },
  {
    q: 'هل أحتاج خبرة تقنية؟',
    a: 'لا. التسجيل برقم جوالك، والإعداد خطوات معدودة. وإن أردت، نبني متجرك بدلاً عنك كخدمة منفصلة.',
  },
  {
    q: 'لماذا الباقة الأعلى تعطي تصميماً لا عدداً فقط؟',
    a: 'لأن أول ما يراه عميلك هو شكل متجرك لا عدد منتجاتك. كل درجة تغيّر واجهة متجرك فعلياً — وتستطيع معاينة الدرجات الثلاث بلونك أنت أعلى هذه الصفحة.',
  },
];

export default async function PricingPage() {
  const prices = await planPrices();

  return (
    <>
      <Header />
      <main className="pt-28">
        {/* ══ الباقات ══ */}
        <section className="bay bg-cream pt-10">
          <div className="wrap">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-3.5 text-xs font-extrabold tracking-[.2em] text-brass-deep">الباقات</p>
              <h1 className="font-display text-h1 leading-snug font-bold text-balance">
                ابدأ مجاناً، وانتقل متى احتجت مساحة أكبر
              </h1>
              <p className="mt-4 text-md leading-loose text-soft text-pretty">
                الحد المجاني اختير ليكون كافياً لتجربة الفكرة. وحين يتجاوزه متجرك،
                تكون الترقية حاجة نابعة من نجاحك — لا ضغطاً تسويقياً.
              </p>
            </Reveal>

            <div className="grid items-start gap-6 lg:grid-cols-3">
              {PLAN_ORDER.map((id, i) => (
                <Reveal key={id} delay={i * 0.09} className="h-full">
                  <PlanCard plan={PLANS[id]} price={prices[id]} featured={id === 'plus'} />
                </Reveal>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-soft">لا نأخذ أي عمولة على مبيعاتك — الاشتراك فقط.</p>
          </div>
        </section>

        {/* ══ استوديو الدرجات ══ */}
        <section className="bay bg-paper">
          <div className="wrap">
            <SectionHead
              kick="جرّبها بلونك"
              title="شاهد الدرجات الثلاث بلون علامتك"
              lede="اختر لوناً، وسترى كيف يبدو متجرك في كل باقة. المحرّك نفسه الذي يصبغ متاجر التجّار."
            />
            <TierStudio />
          </div>
        </section>

        <Comparison tone="cream" />

        <Addons tone="paper" />

        {/* ══ أسئلة شائعة ══ */}
        <section id="faq" className="bay bg-cream">
          <div className="wrap">
            <SectionHead kick="أسئلة شائعة" title="ما يسأل عنه التجار غالباً" />
            <Reveal><Faq items={FAQ} /></Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
