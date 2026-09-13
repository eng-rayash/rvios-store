import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Reveal, SectionHead } from '@/components/ui/reveal';

export const metadata: Metadata = {
  title: 'عن المنصة',
  description:
    'RVIOS Store منصة متاجر إلكترونية بدأت من اليمن، لتاجر يبيع اليوم عبر واتساب وإنستغرام ويحتاج واجهة تمثّله.',
};

/**
 * صفحة «عن المنصة».
 *
 * عمود قراءة ضيّق ونصّ طويل عمداً: هذه الصفحة ليست لبيع ميزة
 * بل لشرح موقف، ومن يفتحها يريد أن يقرأ. تقصيرها إلى نقاط
 * قصيرة كان سيُفقدها سبب وجودها.
 */
const DECISIONS = [
  {
    title: 'لا عمولة على المبيعات',
    body: 'العمولة كانت ستولّد إيراداً أكبر نظرياً، لكنها مستحيلة عملياً في تدفّق دفع يدوي خارج المنصة، وتخلق حاجزاً نفسياً لدى التاجر الصغير. الاشتراك الثابت أوضح وأسهل قبولاً.',
  },
  {
    title: 'لا نجوم تقييم',
    body: 'لا نملك نظام مراجعات موثوقاً بعد، وعرض تقييمات غير حقيقية يدمّر الثقة لحظة اكتشافه. البديل الذي اخترناه: مؤشر توفّر صادق («بقي ٣ فقط») — يحقق الإقناع بلا كذب.',
  },
  {
    title: 'التوثيق اختياري — الآن',
    body: 'جعله إلزامياً كان سيقتل معدل التسجيل في مرحلة تحتاج فيها المنصة كل تاجر ممكن. جعلناه تحفيزياً: شارة مرئية لعملائك تزيد ثقتهم. وسيصبح إلزامياً حين نفعّل الدفع الإلكتروني، لأن مسؤولية المنصة تتغيّر جذرياً حين تلمس الأموال.',
  },
  {
    title: 'الدفع يبقى بينك وبين عميلك',
    body: 'المنصة لا تلمس أموال المبيعات إطلاقاً في هذه المرحلة. يُسجَّل طلبك عندنا برقم مرجعي لتحصل على سجل وإحصائيات حقيقية، ثم تتفق مع عميلك على التوصيل والدفع كما اعتدت.',
  },
];

const NEXT = [
  'تفعيل المحافظ الإلكترونية المحلية للدفع داخل المنصة',
  'نظام ثيمات متعددة — البنية جاهزة له من اليوم الأول',
  'تصنيفات فرعية وإحصائيات أعمق',
  'تطبيق موبايل مخصص للتاجر',
];

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[68ch] gap-5 text-md leading-loose text-soft text-pretty
                    [&_strong]:font-bold [&_strong]:text-ink">
      {children}
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="pt-28">
        <section className="bay bg-cream pt-10">
          <div className="wrap">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="mb-3.5 text-xs font-extrabold tracking-[.2em] text-brass-deep">عن المنصة</p>
              <h1 className="mb-5 font-display text-h1 leading-snug font-bold text-balance">
                متجر إلكتروني حقّ لكل تاجر، لا امتياز لمن يقدر على دفع تكلفته
              </h1>
              <p className="text-lg leading-loose text-soft text-pretty">
                RVIOS Store منصة متاجر إلكترونية بدأت من اليمن، لتاجر يبيع اليوم عبر واتساب
                وإنستغرام ويحتاج واجهة تمثّله — لا أدوات لم تُصمَّم للبيع أصلاً.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bay bg-paper">
          <div className="wrap">
            <SectionHead kick="البداية" title="المشكلة التي بدأنا منها" />
            <Reveal>
              <Prose>
                <p>
                  في اليمن — وفي أسواق كثيرة تشبهه — هناك آلاف التجار وأصحاب الأعمال الناشئة
                  الذين يملكون منتجاً جيداً وزبائن حقيقيين، لكنهم لا يملكون متجراً. يبيعون من
                  حساب على إنستغرام، أو من محادثة واتساب، أو من صور تُرسَل واحدة تلو الأخرى
                  لكل من يسأل عن السعر.
                </p>
                <p>
                  هذا يعمل، لكنه <strong>يُبقي التاجر في مكانه</strong>. لا واجهة منظّمة تعرض ما
                  لديه، ولا رابط واحد يمثّله حين يريد أن يقول «تفضّل، هذا متجري»، ولا أرشيف يحفظ
                  منتجاته من الضياع تحت منشور اليوم. كل عملية بيع تبدأ من الصفر، وكل عميل جديد
                  يحتاج الشرح نفسه من البداية.
                </p>
              </Prose>
            </Reveal>

            <div className="mt-16">
              <SectionHead kick="الحاجز" title="ولماذا لم يبنِ هؤلاء متاجرهم؟" />
              <Reveal>
                <Prose>
                  <p>
                    لأن الباب كان مغلقاً بحاجز التكلفة. إنشاء متجر إلكتروني مستقل يتطلب دفع ثمن
                    التصميم والبرمجة، ثم اسم نطاق، ثم استضافة سنوية، ثم صيانة وتحديثات مستمرة —
                    وهي مبالغ تتجاوز ما يستطيع تاجر صغير أو مشروع في بدايته أن يخاطر به قبل أن
                    يتأكد أصلاً أن الفكرة ستنجح.
                  </p>
                  <p>
                    والبدائل الجاهزة لم تكن أرحم: المنصات الإقليمية مصمَّمة لسوق آخر بعملته
                    وبوابات دفعه وافتراضاته اللوجستية، والمنصات العالمية تفرض اشتراكاً شهرياً
                    بالدولار وواجهة إنجليزية ومتطلبات دفع دولية يصعب على معظم التجار هنا تجاوزها.
                  </p>
                  <p>
                    والنتيجة أن الحاجز لم يكن في الرغبة ولا في جودة المنتج، بل في{' '}
                    <strong>القدرة على الدفع قبل تحقيق أي عائد</strong>. فبقيت طاقة تجارية كبيرة
                    معطّلة، وبقي جانب البيع والشراء يعمل بأدوات لم تُصمَّم له.
                  </p>
                </Prose>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bay bg-cream">
          <div className="wrap">
            <SectionHead kick="القرار" title="ما الذي قرّرنا فعله" />
            <Reveal>
              <Prose>
                <p>
                  بنينا RVIOS Store لنكسر هذا الحاجز تحديداً. جعلنا{' '}
                  <strong>البداية مجانية بالكامل</strong> — تنشئ متجرك وتعرض منتجاتك وتستقبل
                  طلباتك دون أن تدفع ريالاً واحداً، ودون أن تحتاج خبرة تقنية أو بطاقة بنكية.
                  هذا ليس عرضاً ترويجياً مؤقتاً، بل موقف: التاجر يجب أن يثبت لنفسه أن متجره
                  مجدٍ قبل أن يُطلب منه الدفع.
                </p>
                <p>
                  ووفّرنا لكل متجر <strong>رابطاً خاصاً به وحده</strong> يشاركه في أي مكان — في
                  حالته على واتساب، في وصف حسابه على إنستغرام، على بطاقته، أو في إعلان. ومن يفتح
                  الرابط يرى متجر ذلك التاجر فقط: منتجاته، هويته، ألوانه.
                </p>
                <p>
                  وأبقينا <strong>الطلبات تصل عبر واتساب</strong>، لأننا لا نريد أن نعلّم أحداً
                  قناة جديدة. بنينا فوق ما يفعله التاجر اليوم بالفعل، لا بديلاً عنه. والدفع يبقى
                  بينه وبين عميله مباشرة، فلا تعقيد مالي ولا وسيط يأخذ نصيبه من كل عملية.
                </p>
              </Prose>
            </Reveal>
          </div>
        </section>

        <section className="bay bg-paper">
          <div className="wrap">
            <SectionHead
              kick="ما يميّزنا"
              title="متاجر مستقلة، لا سوق مزدحم"
              lede="أغلب المنصات المشابهة تبني سوقاً يتنافس فيه البائعون على انتباه الزائر نفسه."
            />
            <Reveal>
              <Prose>
                <p>
                  نحن نبني <strong>متاجر مستقلة تستخدم بنية تحتية مشتركة</strong>. من يفتح رابطك
                  يرى متجرك وحده — لا سوقاً مزدحماً ولا منتجات منافسين ولا تشتيتاً. التاجر يشعر
                  أنه يملك متجره، لا أنه مستأجر رفّاً في محل شخص آخر. وهذا ليس تفصيلاً تسويقياً؛
                  إنه القرار المعماري الذي بُنيت عليه المنصة من أول سطر.
                </p>
              </Prose>
            </Reveal>
          </div>
        </section>

        <section className="bay bg-cream">
          <div className="wrap">
            <SectionHead
              kick="بوضوح"
              title="قرارات اتخذناها بوعي"
              lede="وشرحُ سببها أصدق من عرضها كأنها بديهية."
            />
            <div className="grid gap-5 md:grid-cols-2">
              {DECISIONS.map((d, i) => (
                <Reveal key={d.title} delay={(i % 2) * 0.08}>
                  <article className="h-full rounded-xl border border-line bg-paper p-6 transition-shadow hover:shadow-soft">
                    <h3 className="mb-3 font-display text-h3 font-bold">{d.title}</h3>
                    <p className="text-sm leading-loose text-soft text-pretty">{d.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bay bg-paper">
          <div className="wrap">
            <SectionHead kick="الطريق" title="إلى أين نتجه" />
            <Reveal>
              <ul className="mx-auto grid max-w-2xl gap-3">
                {NEXT.map((n) => (
                  <li key={n} className="flex items-start gap-3 rounded-lg border border-line bg-cream px-5 py-4">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-shop" />
                    <span className="text-sm leading-relaxed">{n}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-12 flex flex-wrap justify-center gap-4">
                <Link
                  href="/onboarding"
                  className="group inline-flex items-center gap-2.5 rounded-pill bg-ink px-8 py-4
                             text-md font-bold text-cream transition-transform hover:-translate-y-0.5"
                >
                  ابدأ متجرك مجاناً
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                </Link>
                <Link
                  href="/contact"
                  className="rounded-pill border border-line px-8 py-4 text-md font-bold transition-colors hover:border-shop hover:text-shop-text"
                >
                  تواصل معنا
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
