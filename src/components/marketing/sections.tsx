import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, BadgeCheck, Smartphone, Palette, Link2, Check, Minus, Layers, Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ShowcaseStore } from '@/lib/showcase';
import { PLANS, PLAN_ORDER, COMPARISON_ROWS, ADDONS, type Plan } from '@/lib/plans';
import { SECTORS } from '@/lib/sectors';
import { planPrices } from '@/lib/plans.server';
import { accentOn, paletteStyle } from '@/lib/theme';
import { ar, initial } from '@/lib/utils';
import { Reveal, SectionHead, GrowRule } from '@/components/ui/reveal';
import { LumeSurface } from '@/components/ui/lume';
import { FeatureCarousel } from './feature-carousel';
import { PlanCard } from './plan-card';
import { SectorPlate } from './sector-plate';
import { Marquee } from './marquee';
import { Faq, type QA } from './faq';
import { ScrollX } from '@/components/ui/scroll-x';

/* ══════════ متاجر تعمل على المنصة الآن ══════════ */
/**
 * ★ `bg-white border-white` صريحان، لا `bg-cream border-line`.
 *
 *   كل بطاقة تحمل لوحة متجرها في `style`، واللوحة تُعيد تعريف
 *   `--cream` و`--line` بدرجةٍ مصبوغة بلون التاجر (انظر
 *   `derivePalette`). فكان الشريط صفَّ مربّعات كلٌّ منها بلون
 *   خافت مختلف — والعين تقرأ ذلك تشويشاً لا هويّة. الأبيض
 *   الصريح يُخرج البطاقات من اللوحة ويترك اللون للشعار وحده،
 *   وهو المقصود من الشريط أصلاً.
 *
 *   ولأن السطح صار أبيض المنصة لا ورق المتجر، تُحقن `accentOn`
 *   لا `paletteFor`: لون المتجر وحده — للحرف الاحتياطي وعلامة
 *   التوثيق — بلا أسطحه التي كانت تسحب `--soft` معها فيُكتب
 *   رابط متجرٍ داكن السكِن بلونٍ لا يُقرأ فوق الأبيض.
 */
export function StoresStrip({ stores }: { stores: ShowcaseStore[] }) {
  if (!stores.length) return null;
  return (
    <section className="overflow-hidden border-y border-line bg-paper py-10" aria-label="متاجر على المنصة">
      <p className="wrap mb-6 text-center text-xs font-extrabold tracking-[.2em] text-brass-deep">
        متاجر تعمل على المنصة الآن
      </p>
      <Marquee>
        {stores.map((s) => (
          <Link
            key={s.slug}
            href={`/${s.slug}`}
            style={paletteStyle(accentOn(s))}
            className="flex shrink-0 items-center gap-3 rounded-lg border border-white bg-white
                       px-4 py-3 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-soft"
          >
            {/* الشعار عارياً: لا مربّع مصبوغ تحته ولا اقتصاص له.
                و`object-contain` لازمة بعد رفع المربّع — كان
                `cover` يملأ مساحةً لها لون، فيُقتصّ الشعار غير
                المربّع بلا أن يظهر النقص. وبلا خلفية يصير
                الاقتصاص بتراً ظاهراً. */}
            <span className="grid size-9 shrink-0 place-items-center text-sm font-extrabold text-shop-text">
              {s.logo
                ? <Image src={s.logo} alt="" width={36} height={36} className="size-full object-contain" />
                : initial(s.name)}
            </span>
            <span className="grid leading-tight">
              <b className="flex items-center gap-1 text-sm font-bold whitespace-nowrap">
                {s.name}
                {s.verified && <BadgeCheck className="size-3 text-shop-text" />}
              </b>
              <i dir="ltr" className="text-2xs not-italic text-soft">rviosstore.com/{s.slug}</i>
            </span>
          </Link>
        ))}
      </Marquee>
    </section>
  );
}

/* ══════════ كيف يعمل ══════════ */
/**
 * ★ نصّ الخطوة الأولى كان يقول «بلا بريد إلكتروني، بلا نماذج
 *   طويلة» — وهذا لم يعد صحيحاً منذ صار التسجيل يطلب بيانات
 *   التاجر (`src/profile.js`) ويعرض توثيق البريد عبر جوجل
 *   (`src/google.js`). ووعدٌ تنقضه الشاشة التالية أسوأ من وعدٍ
 *   لم يُقَل: الزائر لا ينسى أنه خُدع في أول خطوة.
 *
 *   والصياغة الجديدة لا تعتذر عن البيانات بل **تُعلّلها**: المتجر
 *   يبيع باسم التاجر، والبيانات هي ما يحتكم إليه عند النزاع.
 *   وهو التعليل نفسه المكتوب في شاشة الإعداد، فلا يقرأ الزائر
 *   نبرتين.
 */
const STEPS = [
  {
    icon: Smartphone,
    title: 'سجّل برقم جوالك',
    body: 'رمز تحقق واحد وتدخل، ثم تعريف قصير بك وبنشاطك — لأن المتجر يبيع باسمك. بلا بطاقة بنكية.',
  },
  {
    icon: Palette,
    title: 'اصنع لوحتك',
    body: 'اسم متجرك، شعارك، لونك، وأول منتج. المعاينة تتحدّث معك حرفاً بحرف.',
  },
  {
    icon: Link2,
    title: 'شارك رابطك وابدأ',
    body: 'متجرك يفتح فور انتهائك بلا انتظار موافقة. تصلك الطلبات مسجّلة، وتؤكدها عبر واتساب كما اعتدت.',
  },
];

export function Steps() {
  return (
    <section id="steps" className="bay bg-cream">
      <div className="wrap">
        <SectionHead
          kick="كيف يعمل"
          title="من التسجيل إلى أول عملية بيع، ثلاث محطّات"
          lede="شاشات معدودة تُنجزها من جوالك، ثم يفتح متجرك في اللحظة نفسها — ولا يقف بينك وبين أول بيع أحد."
        />

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* خيط يربط ١←٢←٣ فيُقرأ الصفّ تسلسلاً لا ثلاث بطاقات
              منفصلة — ويُرسم من جهة القراءة حين يدخل الشاشة */}
          <GrowRule className="absolute inset-x-[16%] top-9 hidden h-px bg-line md:block" />

          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.09} className="relative text-center">
              <span className="relative z-10 mx-auto mb-5 grid size-18 place-items-center rounded-full
                               border border-line bg-cream shadow-soft">
                <s.icon aria-hidden className="size-6 text-shop-text" />
              </span>
              <p className="mb-2 font-display text-xl font-bold text-brass-deep tabular">
                {['٠١', '٠٢', '٠٣'][i]}
              </p>
              <h3 className="mb-2.5 font-heading text-h3 font-bold">{s.title}</h3>
              <p className="mx-auto max-w-xs text-sm leading-loose text-soft text-pretty">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════ ما تحصل عليه ══════════ */
/**
 * ثماني بطاقات متجاورة كانت تُقرأ صفّاً من المربّعات: أيقونات
 * متشابهة الوزن، ولا شيء يقول للعين أين تبدأ. صارت لوحاً واحداً
 * يعرض ميزة واحدة في كل لحظة برسمها الخاص — فتُقرأ الميزة بدل
 * أن تُمسح. والقائمة تبقى ظاهرة كاملةً إلى جانبها كي لا تُخفي
 * الحركةُ ما لم يُعرض بعد.
 *
 * البيانات والرسوم داخل المكوّن نفسه لأنهما لا يُستعملان خارجه،
 * وفصلهما هنا كان سيُنتج ملفّاً ثالثاً بلا قارئ ثانٍ.
 */
export function Features() {
  return (
    <section id="features" className="bay bg-paper">
      <div className="wrap">
        <SectionHead
          kick="ما تحصل عليه"
          title="متجر كامل، لا صفحة منتجات"
          lede="كل ما تحتاجه لتبيع من اليوم الأول — ولا شيء تحتاج خبرة تقنية لتشغيله."
        />

        <Reveal>
          <FeatureCarousel />
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════ على أي جهاز ══════════ */
/**
 * القسم الوحيد الذي يحمل صورة مركّبة بدل واجهة حيّة.
 *
 * الحجّة هنا عن **الأجهزة** لا عن متجر بعينه، وعرضها بثلاث
 * لقطات حقيقية كان سيضيف ثلاث صور ثقيلة ليقول ما تقوله صورة
 * واحدة. ولأنها تمثيل لا لقطة، لا يُدّعى فيها رقمٌ ولا اسم متجر.
 */
const DEVICE_POINTS = [
  'تدير متجرك من جوالك كما تديره من الحاسوب — بلا تطبيق تُنزّله',
  'متجرك يفتح على أي شاشة بنفس الترتيب ونفس السرعة',
  'الصور تُهيَّأ قبل الرفع، فلا تستنزف باقة بيانات عميلك',
];

export function Devices() {
  return (
    <section id="devices" className="bay bg-cream">
      <div className="wrap grid items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
        <Reveal>
          <p className="mb-3.5 text-xs font-extrabold tracking-[.2em] text-brass-deep">أينما كنت</p>
          <h2 className="mb-5 font-display text-h2 leading-snug font-bold text-balance">
            متجرك في جيبك، ولوحتك معه
          </h2>
          <p className="mb-7 text-md leading-loose text-soft text-pretty">
            أغلب تجّارنا يديرون متاجرهم من الجوّال وحده — فبُنيت اللوحة لتعمل عليه أولاً،
            لا لتكون نسخة مصغّرة من شاشة حاسوب.
          </p>

          <ul className="mb-8 grid gap-3.5">
            {DEVICE_POINTS.map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm leading-loose">
                <Check aria-hidden className="mt-1 size-4 shrink-0 text-ok" />
                <span className="text-pretty">{t}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/onboarding"
            className="group inline-flex items-center gap-2.5 rounded-pill bg-ink px-7 py-3.5
                       text-md font-bold text-cream transition-transform duration-200 hover:-translate-y-0.5"
          >
            جرّبها الآن مجاناً
            <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </Reveal>

        <Reveal delay={0.1}>
          <figure className="m-0">
            <Image
              src="/images/devices-dashboard.png"
              alt="متجر ولوحة تحكّم معروضان على جوّال وحاسوب محمول ولوح إلكتروني"
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 620px, 100vw"
              className="w-full rounded-xl border border-line object-cover shadow-lift"
            />
            <figcaption className="mt-3 text-center text-2xs text-soft">
              صورة تمثيلية للواجهة على الأجهزة المختلفة
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════ القطاعات ══════════ */
/**
 * القائمة تأتي من `@/lib/sectors` — المصدر نفسه الذي يقرأه مُنتقي
 * الإعداد، فلا يَعِد الشريط بقطاع لا يجده التاجر عند التسجيل.
 */
export function Sectors() {
  return (
    <section id="sectors" className="bay bg-paper">
      <div className="wrap">
        <SectionHead
          kick="لأي نوع من التجارة"
          title="متجرك بنفس البساطة، أياً كان مجالك"
          lede="هذه أمثلة لا قوالب: الثيم محايد بالكامل، وتصنيفاتك تكتبها أنت كما تريدها."
        />

        {/* خمسة عشر قطاعاً تقسم على خمسة بلا صفٍّ مبتور، ولا تقسم على ستّة */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SECTORS.map((s, i) => (
            <Reveal key={s.id} delay={(i % 5) * 0.06}>
              <Link href="/sectors" className="group block text-center">
                <div className="mb-3 overflow-hidden rounded-xl border border-line bg-paper">
                  <SectorPlate sector={s} size={360} />
                </div>
                <span className="text-sm font-bold transition-colors group-hover:text-shop-text">{s.name}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════ الباقات ══════════ */
export async function Pricing() {
  const prices = await planPrices();
  return (
    <section id="pricing" className="bay bg-cream">
      <div className="wrap">
        <SectionHead
          kick="الباقات"
          title="ابدأ مجاناً، وانتقل متى احتجت مساحة أكبر"
          lede="الحد المجاني اختير ليكون كافياً لتجربة الفكرة. وحين يتجاوزه متجرك، تكون الترقية نابعة من نجاحك لا من ضغط تسويقي."
        />
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((id, i) => (
            <Reveal key={id} delay={i * 0.09} className="h-full">
              <PlanCard plan={PLANS[id]} price={prices[id]} featured={id === 'plus'} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <p className="mt-8 text-center text-sm text-soft">
            الدعم والأمان والنسخ الاحتياطي ليست ميزات مدفوعة — هي حقّ في كل الباقات.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════ المقارنة الكاملة ══════════ */
/**
 * الجدول ينقل قرار الشراء من «أيّهما أغلى» إلى «أيّهما يكفيني».
 * وصفوفه في `@/lib/plans` — تستعملها هذه الصفحة وصفحة الباقات.
 *
 * ★ و`tone` ليست ترفاً: الأقسام تتناوب بين الورق والكريمي ليُقرأ
 * كلٌّ منها قسماً مستقلاً، وترتيب التناوب يختلف بين الصفحتين.
 * قسمٌ مشترك يفرض أرضيته يُلصق سطحين متطابقين ببعضهما في إحداهما.
 */

export function Comparison({ tone = 'paper' }: { tone?: 'cream' | 'paper' }) {
  return (
    <section id="compare" className={`bay ${tone === 'cream' ? 'bg-cream' : 'bg-paper'}`}>
      <div className="wrap">
        <SectionHead kick="مقارنة كاملة" title="ما الذي تحصل عليه في كل باقة" />
        <Reveal>
          {/* ★ `relative` هنا ليست تمهيداً لشيء يُوضَع فوقها بل
              **إصلاح تجاوز أفقي** يصيب الصفحة كلها على الجوّال.
              خلايا الجدول تحوي عشرات `sr-only` (نصّ «مشمول» لقارئ
              الشاشة)، و`sr-only` تعني `position: absolute`. والعنصر
              المطلق يُقصّ بأقرب سلفٍ **مُوضَّع** لا بأقرب سلفٍ
              يُمرَّر؛ فما دامت هذه الحاوية ساكنة كان صندوق احتوائها
              خارجها، فتفلت تلك الأمداد إلى عرض الجدول الكامل
              (٥٦٠ بكسل) بلا قصّ — ويُقرأ ذلك في مساحة تمرير
              المستند نفسه: صفحة ٣٧٥ بكسل تصير ٥٣٤، فتنزلق أفقياً
              تحت إصبع الزائر وينزاح الشريط العلوي معها. وسطر
              `relative` واحد يُعيد صندوق الاحتواء إلى داخل حاوية
              التمرير، فتُقصّ كما يُقصّ الجدول. */}
          <ScrollX
            label="جدول مقارنة الباقات"
            hint="مرّر الجدول أفقياً لرؤية الباقات الثلاث"
            className="relative rounded-xl border border-line bg-cream"
          >
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">مقارنة ميزات الباقات الثلاث</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-4 text-start text-xs font-extrabold tracking-wider text-soft">
                    الميزة
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} scope="col" className="px-5 py-4 text-center font-display text-xl font-bold">
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(([label, get], i) => (
                  <tr key={label} className={i % 2 ? 'bg-paper/60' : ''}>
                    <th scope="row" className="border-b border-line px-5 py-3.5 text-start font-medium">
                      {label}
                    </th>
                    {PLAN_ORDER.map((id) => {
                      const v = get(PLANS[id]);
                      return (
                        <td key={id} className="border-b border-line px-5 py-3.5 text-center">
                          {v === true ? (
                            <>
                              <Check aria-hidden className="mx-auto size-4 text-ok" />
                              <span className="sr-only">مشمول</span>
                            </>
                          ) : v === false ? (
                            <>
                              <Minus aria-hidden className="mx-auto size-4 text-line" />
                              <span className="sr-only">غير مشمول</span>
                            </>
                          ) : (
                            <span className="font-bold tabular">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mt-6 text-center text-sm text-soft">
            التحصيل في المرحلة الحالية يدوي عبر التحويل أو المحفظة المحلية، ونعمل على تفعيل الدفع داخل المنصة.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════ خدمات إضافية ══════════ */

/**
 * ★ الأيقونة تُربط بالمعرّف هنا لا تُحمل في البيانات.
 * `ADDONS` صارت في `@/lib/plans` لتشترك فيها صفحتان، و`plans.ts`
 * بياناتٌ خالصة يقرؤها ما ليس React أيضاً — فحشو مكوّنات أيقونات
 * فيها يربط طبقة البيانات بمكتبة رسم. والربط بالمعرّف يُبقي كلاً
 * في مكانه، ويسقط بأمان إلى أيقونة معلومة لو أُضيفت خدمة جديدة.
 */
const ADDON_ICONS: Record<string, LucideIcon> = {
  build: Wallet,
  domain: Link2,
  store: Layers,
};

function AddonIcon({ id }: { id: string }) {
  const Icon = ADDON_ICONS[id] ?? Wallet;
  return <Icon aria-hidden className="size-4.5 text-shop-text" />;
}

export function Addons({ tone = 'cream' }: { tone?: 'cream' | 'paper' }) {
  return (
    <section id="addons" className={`bay ${tone === 'paper' ? 'bg-paper' : 'bg-cream'}`}>
      <div className="wrap">
        <SectionHead
          kick="خدمات إضافية"
          title="خدمات تُطلب مرة واحدة، منفصلة عن الاشتراك"
          lede="هذه ليست جزءاً من أي باقة — تطلبها متى احتجتها، وتُحاسب عليها وحدها."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {ADDONS.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.09}>
              <LumeSurface
                as="article"
                className="flex h-full flex-col rounded-xl border border-line bg-paper p-6
                           transition-shadow duration-300 hover:shadow-soft"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-lg border border-line bg-cream">
                    <AddonIcon id={a.id} />
                  </span>
                  <span className="rounded-pill bg-sand px-3 py-1 text-2xs font-extrabold tracking-widest text-brass-deep">
                    {a.kind}
                  </span>
                </div>
                <h3 className="mb-2 font-heading text-h3 font-bold">{a.name}</h3>
                <p className="mb-6 flex-1 text-sm leading-loose text-soft text-pretty">{a.desc}</p>
                <Link
                  href="/contact"
                  className="inline-block self-start rounded-pill border border-line px-5 py-2.5
                             text-sm font-bold transition-colors hover:border-shop hover:text-shop-text"
                >
                  اطلب الخدمة
                </Link>
              </LumeSurface>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════ أسئلة شائعة ══════════ */
const QUESTIONS: QA[] = [
  {
    q: 'هل تأخذون عمولة على مبيعاتي؟',
    a: 'لا. الدفع يتم بينك وبين عميلك مباشرة، والمنصة لا تلمس أموال المبيعات إطلاقاً. مصدر دخلنا هو الاشتراك فقط.',
  },
  {
    q: 'هل أحتاج خبرة تقنية؟',
    a: 'لا. التسجيل برقم جوالك، والإعداد خطوات معدودة تُنجزها من جوالك. وإن أردت، نبني متجرك بدلاً عنك كخدمة منفصلة.',
  },
  {
    q: 'ماذا يحدث إن تجاوزت حد الباقة المجانية؟',
    a: 'يبقى متجرك ومنتجاتك كما هي، لكن لن تتمكن من إضافة منتج جديد حتى ترقّي باقتك أو تحذف منتجاً. لا نحذف شيئاً ولا نُغلق متجرك.',
  },
  {
    q: 'من يستطيع تقييم منتجاتي؟ وهل أتحكّم في ذلك؟',
    a: 'أي زائر يقيّم، والتقييم يظهر فوراً بلا طابور مراجعة — لأن تقييمات مُنتقاة لا يصدّقها أحد. '
     + 'ومن اشترى فعلاً تظهر عليه شارة «مشترٍ موثَّق» تُحسب من طلباته لا يمنحها أحد. '
     + 'وأنت تردّ على أي تقييم وتُخفي المسيء من لوحتك.',
  },
  {
    q: 'هل المنصة لليمن وحدها؟',
    a: 'لا. تعمل في تسع دول — اليمن والسعودية ومصر والأردن والعراق والسودان وسوريا وليبيا وعُمان. '
     + 'تسجّل برقم بلدك، وتعرض أسعارك بعملة بلدك. واخترنا أسواقاً تتشابه في شكل التجارة: '
     + 'الدفع عند الاستلام والبيع عبر واتساب.',
  },
  {
    q: 'كيف تصلني الطلبات؟',
    a: 'كل طلب يُسجَّل في لوحتك برقم مرجعي وتفاصيله كاملة، ويصلك جاهزاً على واتساب لتؤكّده مع عميلك كما اعتدت.',
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
    q: 'لماذا الباقة الأعلى تعطي تصميماً لا عدداً فقط؟',
    a: 'لأن أول ما يراه عميلك هو شكل متجرك لا عدد منتجاتك. كل درجة تغيّر واجهة متجرك فعلياً — وتستطيع معاينة الدرجات الثلاث بلونك أنت في صفحة الباقات.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bay bg-paper">
      <div className="wrap">
        <SectionHead kick="أسئلة شائعة" title="ما يسأل عنه التجار غالباً" />
        <Reveal><Faq items={QUESTIONS} /></Reveal>

        <Reveal delay={0.15}>
          <p className="mt-8 text-center text-sm text-soft">
            سؤالك ليس هنا؟{' '}
            <Link href="/contact" className="border-b border-line font-bold text-shop-text">
              تواصل معنا مباشرة ←
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════ الختام ══════════ */
export function ClosingCta() {
  return (
    <section className="bay bg-cream">
      <div className="wrap">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-xl bg-ink px-8 py-20 text-center text-cream">
            {/* المشهد يحمل هوية المنصة، والحجاب فوقه ليس تجميلاً:
                بدونه يهبط تباين النصّ فوق المناطق الفاتحة من الصورة */}
            <Image
              src="/images/brand-scene.jpg"
              alt=""
              aria-hidden
              width={1376}
              height={768}
              sizes="(min-width: 1180px) 1100px, 100vw"
              className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-45"
            />
            {/* الحجاب يحمل الحبيبات: `::after` يُرسم بعد كل الأبناء،
                فلو وُضعت على اللوح نفسه لطُليت فوق العنوان. وهنا
                هي داخل طبقة `-z-10` — تحت النصّ حيث ينبغي. */}
            <div
              aria-hidden
              className="grain pointer-events-none absolute inset-0 -z-10 [--grain:.13]
                         bg-[radial-gradient(120%_100%_at_50%_50%,rgba(36,31,27,.72),rgba(36,31,27,.94))]"
            />
            <h2 className="mx-auto mb-4 max-w-2xl font-display text-h2
                           leading-snug font-bold text-balance">
              لوحتك جاهزة، ينقصها اسمك فقط
            </h2>
            <p className="mx-auto mb-9 max-w-md text-md leading-loose text-cream/70">
              أنشئ متجرك خلال دقائق، وشارك رابطه اليوم. بلا بطاقة بنكية وبلا التزام.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/onboarding"
                className="sheen sheen-brass group inline-flex items-center gap-2.5 rounded-pill bg-cream
                           px-9 py-4 text-md font-bold text-ink transition-transform duration-200
                           hover:-translate-y-0.5"
              >
                ابدأ متجرك مجاناً
                <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="rounded-pill border border-cream/25 px-8 py-4 text-md font-bold text-cream/85
                           transition-colors hover:border-cream hover:text-cream"
              >
                أنشئوا متجري بدلاً عني
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
