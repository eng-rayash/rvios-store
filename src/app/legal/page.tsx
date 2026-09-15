import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Reveal } from '@/components/ui/reveal';
import { ScrollX } from '@/components/ui/scroll-x';

export const metadata: Metadata = {
  title: 'الشروط والخصوصية',
  description: 'الشروط والأحكام وسياسة الخصوصية لمنصة RVIOS Store.',
};

/**
 * الصفحة القانونية.
 *
 * التنبيه أعلاها ليس تحفّظاً شكلياً: الوثيقة صيغة عملية تحكم
 * المرحلة الحالية، وإخفاء ذلك عن التاجر أسوأ من الاعتراف به.
 * ويتغيّر الأمر جذرياً حين تلمس المنصة أموال المبيعات.
 */
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-28 font-display text-h2 leading-snug font-bold">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-2.5 font-display text-xl font-bold">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-loose text-soft text-pretty">{children}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 grid gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-sm leading-loose text-soft">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-shop" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function LegalPage() {
  return (
    <>
      <Header />
      <main className="pt-28">
        <section className="bay bg-cream pt-10">
          <div className="wrap mx-auto max-w-[76ch]">
            {/* ★ كانت الصفحة تبدأ بـ`<h2>` بلا `<h1>` إطلاقاً.
                قارئ الشاشة يتنقّل بالعناوين، وصفحةٌ بلا عنوان أول
                تُقرأ جزءاً مقتطعاً من صفحة أخرى — والوثيقة القانونية
                تحديداً هي ما يُفتح من رابط مباشر لا من تصفّح. */}
            <Reveal>
              <h1 className="mb-8 font-display text-h1 leading-tight font-bold">
                الشروط والخصوصية
              </h1>
            </Reveal>

            <Reveal>
              <div className="mb-10 flex items-start gap-3.5 rounded-xl border border-warn/35 bg-warn/[.07] p-5">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
                <div>
                  <p className="mb-1 text-sm font-extrabold">مسودة أولية</p>
                  <p className="text-sm leading-loose text-soft text-pretty">
                    هذه الوثيقة صيغة عملية تحكم استخدام المنصة في مرحلتها الحالية، وليست
                    استشارة قانونية. تُراجَع مع مختص قبل الإطلاق العام، وخصوصاً عند تفعيل
                    الدفع الإلكتروني.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* ══ الشروط ══ */}
            <Reveal className="grid gap-3">
              <H2 id="terms">الشروط والأحكام</H2>
              <p className="text-xs font-bold text-brass-deep">آخر تحديث: أغسطس ٢٠٢٦</p>

              <H3>١. طبيعة الخدمة</H3>
              <P>
                RVIOS Store منصة تتيح للتاجر إنشاء متجر إلكتروني وعرض منتجاته ومشاركة رابط
                خاص به. المنصة وسيط عرض وتنظيم، وليست طرفاً في عملية البيع.
              </P>

              <H3>٢. الدفع والتسليم</H3>
              <P>
                تتم عمليات الدفع والتسليم مباشرة بين التاجر والعميل خارج المنصة. المنصة لا
                تستلم أموال المبيعات ولا تحتفظ بها ولا تضمنها، ولا تتحمل مسؤولية التأخر في
                التسليم أو اختلاف المنتج عن وصفه أو أي نزاع بين الطرفين. وتسجيل الطلب في
                المنصة يخدم غرض التوثيق والإحصاء فقط، ولا يُنشئ التزاماً على المنصة.
              </P>

              <H3>٣. مسؤولية التاجر</H3>
              <Bullets
                items={[
                  'صحة بيانات المنتجات وأسعارها وتوفّرها',
                  'امتلاك حق استخدام الصور والأسماء التجارية المعروضة',
                  'الالتزام بالقوانين النافذة، وعدم عرض سلع محظورة أو مقلّدة',
                  'الرد على عملائه والوفاء بما التزم به تجاههم',
                ]}
              />

              <H3>٤. الحساب والتحقق</H3>
              <P>
                التسجيل يتطلب رقم جوال يُتحقق منه برمز لمرة واحدة. أنت مسؤول عن أي نشاط يجري
                عبر حسابك. والتوثيق (شارة «متجر موثّق») اختياري ويُمنح بعد مراجعة يدوية.
              </P>

              <H3>٥. الباقات والاشتراك</H3>
              <P>
                الباقة المجانية تتيح حتى ١٥ منتجاً. والباقات المدفوعة تفتح حدوداً أعلى وميزات
                إضافية. لا تأخذ المنصة أي عمولة على المبيعات. والتحصيل في المرحلة الحالية
                يدوي، وأسعار الباقات المدفوعة تُعلن قبل تفعيلها.
              </P>

              <H3>٦. التعليق والإنهاء</H3>
              <P>
                يحق للمنصة تعليق أو إنهاء أي متجر يخالف هذه الشروط، أو يرد بشأنه بلاغات
                موثوقة، أو يُستخدم في نشاط احتيالي — ودون إشعار مسبق في الحالات الجسيمة.
                ويمكنك حذف متجرك متى شئت.
              </P>

              <H3>٧. حدود المسؤولية</H3>
              <P>
                تُقدَّم الخدمة «كما هي». لا نضمن استمرار العمل بلا انقطاع أو خلوّه من الأخطاء.
                ومسؤوليتنا في كل الأحوال لا تتجاوز ما دفعته للمنصة خلال الأشهر الثلاثة السابقة.
              </P>
            </Reveal>

            {/* ══ الخصوصية ══ */}
            <Reveal className="mt-20 grid gap-3">
              <H2 id="privacy">سياسة الخصوصية</H2>
              <p className="text-xs font-bold text-brass-deep">آخر تحديث: أغسطس ٢٠٢٦</p>

              <H3>١. ما الذي نجمعه</H3>
              <ScrollX
                label="جدول البيانات التي نجمعها والغرض منها"
                hint="مرّر الجدول أفقياً لرؤية عمود الغرض"
                className="mt-2 rounded-xl border border-line bg-paper"
              >
                <table className="w-full min-w-[440px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-5 py-3.5 text-start text-xs font-extrabold text-soft">البيانات</th>
                      <th scope="col" className="px-5 py-3.5 text-start text-xs font-extrabold text-soft">الغرض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['رقم جوال التاجر', 'إنشاء الحساب والتحقق وتسجيل الدخول'],
                      ['بيانات المتجر والمنتجات', 'عرضها للعملاء عبر رابط المتجر'],
                      ['اسم العميل ورقمه (اختياري)', 'تمكين التاجر من تأكيد الطلب'],
                      ['عدّاد زيارات يومي مجمّع', 'إحصائيات المتجر — بلا تتبّع أفراد'],
                    ].map(([a, b]) => (
                      <tr key={a}>
                        <td className="border-b border-line px-5 py-3.5 font-bold">{a}</td>
                        <td className="border-b border-line px-5 py-3.5 text-soft">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
              <P>
                لا نستخدم كوكيز إعلانية ولا نضع أدوات تتبّع من طرف ثالث. والكوكي الوحيد الذي
                نضعه هو كوكي الجلسة اللازم لإبقائك مسجّل الدخول.
              </P>

              <H3>٢. عزل بيانات المتاجر</H3>
              <P>
                كل متجر معزول عن غيره على مستوى قاعدة البيانات: لا يستطيع تاجر الوصول إلى
                منتجات أو طلبات أو عملاء تاجر آخر. وهذا مفروض في طبقة البيانات نفسها، لا في
                واجهة العرض فقط.
              </P>

              <H3>٣. ما لا نفعله</H3>
              <Bullets
                items={[
                  'لا نبيع بياناتك ولا بيانات عملائك لأي جهة',
                  'لا نشارك بيانات تاجر مع تاجر آخر',
                  'لا نطّلع على محتوى محادثات واتساب — هي بينك وبين عميلك مباشرة',
                ]}
              />

              <H3>٤. حقوقك</H3>
              <P>
                تستطيع تعديل بيانات متجرك أو حذفه في أي وقت من لوحة التاجر. وحذف الحساب يحذف
                معه بيانات متجرك ومنتجاتك.
              </P>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
