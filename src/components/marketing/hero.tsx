import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ShowcaseStore } from '@/lib/showcase';
import { symbolOf } from '@/lib/countries';
import { Words, Underline } from '@/components/ui/words';
import { ClaimField } from './claim-field';
import { LiveChips } from './live-chips';
import { HeroScene } from './hero-scene';

/**
 * مشهد الهيرو: لقطة المتجر على حاسوب محمول، مُصيَّرة في Blender.
 *
 * كان هنا جهازان مبنيّان بـDOM يعرضان متجرين حقيقيين بمنتجاتهما
 * وأسعارهما، ثم جُرِّب مجسّم GLB حيّ — واستقرّ الأمر على صورة
 * مُصيَّرة: مشهد الاستوديو نفسه بلا three.js (٢٥٠ ك.ب سكربت)
 * ولا ملف مجسّم (١٫٧ م.ب)، والنتيجة أدقّ إضاءةً لأنها تُحسب
 * مرة واحدة على الجهاز لا في كل زيارة.
 *
 * والبرهان الحيّ لم يسقط من الصفحة: شريط «متاجر تعمل على المنصة
 * الآن» تحته مباشرة يعرض المتاجر الحقيقية بروابطها، وبطاقات
 * LiveChips تبقى فوق المشهد.
 *
 * المصدر: D:\مشاريع blender\Laptop_RVIOS_Hero.blend — مجموعة
 * `RVIOS_Hero` فيها الكاميرا والإضاءة، فإعادة التصيير بعد أي
 * تعديل على الواجهة لا تحتاج ضبطاً من جديد.
 */
interface Props {
  stores: ShowcaseStore[];
  lead: ShowcaseStore | null;
}

export function Hero({ lead }: Props) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-cream">
      <Aura />

      {/* العمود البصري صار أوسع من عمود النصّ: المجسّم هو أول ما
          يقول «هذا متجر يعمل»، وكان يظهر صغيراً بجوار عنوان ضخم */}
      <div className="wrap relative grid items-center gap-10 pt-24 pb-20 lg:grid-cols-[.94fr_1.06fr] lg:pt-28">
        {/* ★ min-w-0 ليس تنظيفاً بل إصلاح عطب مرئي.
            عنصر الشبكة يأخذ `min-width:auto` افتراضاً، فيرفض
            النزول تحت عرض أضيق محتوى فيه — وهو هنا صفّ حجز
            الاسم (السابقة + الحقل + الزرّ) عند ٣٧٣ بكسل. على
            شاشة ٣٧٥ كان العمود يتجاوز حاويته ٤٦ بكسل فيُقصّ
            زرّ «احجزه» خارج الشاشة، و`overflow-hidden` على
            القسم يبتلع الفيضان فلا يظهر تمرير أفقي يفضحه. */}
        <div className="min-w-0 max-w-xl">
          <p className="mb-6 inline-flex items-center gap-2.5 rounded-pill border border-cream/15
                        bg-cream/5 px-4 py-1.5 text-xs font-bold text-cream/75 backdrop-blur-sm">
            <span className="relative flex size-1.5">
              {/* نبضة واحدة بطيئة تحت النقطة: علامة حياةٍ لا لافتة.
                  والنقطة فوقها صلبة، فلا يُقرأ الوميض اهتزازاً. */}
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-shop opacity-60
                               [animation-duration:2.8s]" />
              <span className="relative inline-flex size-1.5 rounded-full bg-shop" />
            </span>
            ابدأ مجاناً · بلا خبرة تقنية
          </p>

          {/* الحجم أصغر ممّا كان: خطّ «مغفرة» أعرض بكثير من
              «مركزي» الذي ضُبط عليه المقاس، فكان «أنشئ متجرك»
              ينكسر سطرين في عمود أضيق */}
          <h1 className="mb-5 font-display text-hero leading-tight font-bold tracking-tight text-balance">
            <span className="block">
              <Words text="أنشئ متجرك" delay={0.12} />
            </span>
            <span className="block">
              <Words text="بأسلوبك،" delay={0.27} />{' '}
              <em className="not-italic text-brass">
                <Underline delay={1.15}>
                  <Words text="مجاناً" delay={0.42} />
                </Underline>
              </em>
            </span>
          </h1>

          <p className="mb-8 max-w-lg text-lg leading-loose text-cream/70 text-pretty">
            منصة متكاملة تبني بها متجرك الإلكتروني وتديره بسهولة — برابط يخصّك وحدك،
            وطلبات تصلك عبر واتساب كما اعتدت.
          </p>

          <div className="mb-8 [--shop-rgb:200,164,93]">
            <ClaimField />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link
              href="/onboarding"
              className="sheen sheen-brass group inline-flex items-center gap-2.5 rounded-pill bg-cream
                         px-8 py-4 text-md font-bold text-ink transition-transform duration-200
                         hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0"
            >
              ابدأ متجرك الآن
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </Link>
            <Link href="#steps" className="border-b border-cream/25 pb-1 text-sm font-bold text-cream/70 transition-colors hover:text-brass">
              شاهد كيف يعمل
            </Link>
          </div>
        </div>

        <HeroScene>
          <LiveChips shop={lead?.name ?? 'متجرك'} currency={lead?.currency ?? symbolOf(null)} />
        </HeroScene>
      </div>

      <Rail />
    </section>
  );
}

/**
 * ضوء المشهد.
 *
 * كان هنا قرصان ضخمان أحمر ونحاسي على شبكة نقاط — وهي بالضبط
 * الخلفية التي تراها في كل صفحة هبوط تُولَّد اليوم: صبغة عريضة
 * مسطّحة لا تصف مصدر ضوء ولا تتّفق مع ما فوقها.
 *
 * البديل هنا **إضاءة استوديو موجّهة** تتّفق مع الصورة المُصيَّرة:
 *   · مفتاحٌ نحاسيّ بارد الحدّة من أعلى جهة الجهاز — هو نفسه
 *     الضوء الذي أضاء المجسّم في Blender، ممتدّاً إلى الأرضية.
 *   · وهجُ المتجر الأحمر **محصور خلف الجهاز** لا يصبغ القسم:
 *     الأحمر العريض يبتلع كل شيء ويجعل النصّ يسبح فيه.
 *   · قاعٌ داكن أسفل عمود النصّ يمنع الجهة الثانية من الاستواء.
 *   · تعتيمٌ للزوايا يجمع العين إلى الوسط.
 * وفوق ذلك كلّه حبيبات: الضوء الرقمي النظيف يُقرأ رخيصاً،
 * والضوء ذو التوتّر يُقرأ مصوَّراً.
 */
function Aura() {
  return (
    <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 overflow-hidden [--grain:.16]">
      <div className="absolute -top-[30%] -end-[6%] size-[46vw] rounded-full bg-brass/[.16] blur-[130px]" />
      <div className="absolute top-[10%] end-[12%] size-[34vw] rounded-full bg-shop/35 blur-[120px]" />
      <div className="absolute -bottom-[28%] -start-[14%] size-[40vw] rounded-full bg-shop-deep/45 blur-[140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(118%_88%_at_50%_22%,transparent_36%,rgba(10,8,7,.6))]" />
    </div>
  );
}

/**
 * شريط الطمأنة أسفل المشهد.
 *
 * البند الأخير أُضيف بعد أن صارت المنصة تعرف تسع دول بعملاتها
 * وأنماط جوّالاتها (`countries.js`): كان الشريط يوحي بمنتج
 * يمنيّ حصراً، وهو ما لم يعد صحيحاً.
 */
function Rail() {
  const items = [
    'بلا عمولة على مبيعاتك',
    'رابط متجر خاص بك',
    'طلباتك عبر واتساب',
    'بلا بطاقة بنكية',
    'تسع دول بعملاتها',
  ];
  return (
    <div className="hairline relative bg-cream/[.03] backdrop-blur-sm">
      <div className="wrap flex items-center justify-center gap-7 overflow-x-auto py-4
                      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((t, i) => (
          <span key={t} className="flex shrink-0 items-center gap-2.5 text-xs font-bold text-cream/60">
            {i > 0 && <i className="me-4 h-4 w-px bg-cream/15" />}
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
