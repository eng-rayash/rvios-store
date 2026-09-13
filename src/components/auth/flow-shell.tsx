import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Plaque } from '@/components/ui/plaque';

/**
 * قشرة مسارات الخطوات: الدخول والتسجيل.
 *
 * عمودان — نموذجٌ على أرضية فاتحة، ولوحةٌ داكنة تحمل «اللوح
 * المعلّق». وهذا ليس تزييناً للعمود الفارغ: اللوح هو العنصر
 * التوقيعي للعلامة (§٧٫٣)، والصفحة التي يدخل منها التاجر أوّل
 * مرّة هي أحقّ المواضع به.
 *
 * ★ ما كان يحدث قبل هذا:
 * `login.html` كان يحمل `flow.css` ثم **يُلغي عموده الجانبي**
 * بثلاثة أسطر (`grid-template-columns:1fr`) — فيفقد اللوح
 * ويبقى نموذجاً عارياً في وسط صفحة بيضاء. أي أن أقوى ما تملكه
 * العلامة بصرياً كان مكتوباً في الملفّ ومُطفأً في الصفحة.
 *
 * ★ ترتيب المصدر مقصود: النموذج أوّلاً في DOM.
 * على الجوال ينقلب العمودان إلى صفّين، واللوحة الداكنة تُعرض
 * فوق النموذج بصرياً (`order`) — لكن التنقّل بلوحة المفاتيح
 * وقارئ الشاشة يصل إلى النموذج أوّلاً لأنه أوّلاً في المصدر.
 * من جاء ليدخل يريد الحقل لا الزينة.
 */
export function FlowShell({
  children,
  aside,
}: {
  children: ReactNode;
  /** ما يُعرض داخل اللوح المعلّق — يختلف بين الدخول والتسجيل */
  aside: {
    label: string;
    plaque: ReactNode;
    note: ReactNode;
    /**
     * أنماط تُحقن على اللوح نفسه — لا على محتواه.
     * تدفّق الإعداد يعرض المتجر وهو يُبنى، ولونه يتغيّر تحت يد
     * التاجر. والتاج (`crest`) يقرأ `--shop` من **اللوح**، فحقنُه
     * على المحتوى وحده يترك الحدّ العلوي بلون المنصة بينما يتغيّر
     * ما تحته — وهو أظهر ما في اللوح.
     */
    style?: React.CSSProperties;
  };
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_420px]">
      {/* ── العمود الرئيسي: العلامة ثم النموذج ── */}
      <div className="flex flex-col px-6 pt-8 pb-14 sm:px-10 lg:pt-9">
        <Link href="/" className="mb-8 flex items-center gap-2.5 self-start lg:mb-9">
          <Image src="/assets/img/logo.png" alt="" width={38} height={25} className="w-[38px]" />
          <span>
            <b className="block font-en text-[23px] leading-none">RVIOS</b>
            <i className="mt-0.5 block text-2xs not-italic tracking-[3px] text-soft">S T O R E</i>
          </span>
        </Link>

        {/* ★ `mx-auto` لا محاذاةً للحافّة: العمود الرئيسي أعرض من
            النموذج بمئات البكسلات، ونموذجٌ مُلصَق بحافّته يترك
            فراغاً على الجهة الأخرى يُقرأ خللاً لا تنفّساً. */}
        <div className="my-auto mx-auto w-full max-w-[520px]">{children}</div>
      </div>

      {/* ── العمود الجانبي: اللوح المعلّق ──
          `.grain` عليه لأنه السطح الداكن الوحيد في الصفحة،
          و«نفس الحبيبات على كل سطح داكن» هو نصّ قاعدة الخامة. */}
      {/* ★ على الجوال يأتي **بعد** النموذج لا قبله — وهذا قرار
          تخطيط مختلف للهاتف لا نسخةٌ مضغوطة من المكتب.
          النسخة القديمة كانت تضعه أوّلاً (`order:-1`)، فيرى من
          جاء ليدخل نصف شاشة من الزينة قبل أن يصل إلى حقل واحد.
          على المكتب يجلس العمودان جنباً إلى جنب فلا تنازع: كلٌّ
          يُرى في لحظته. */}
      <aside className="grain relative flex flex-col justify-center overflow-hidden bg-ink px-8 py-10 lg:sticky lg:top-0 lg:h-dvh lg:px-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_70%_20%,rgba(200,164,93,.14),transparent_55%)]"
        />

        <div className="relative z-1">
          <p className="mb-5 text-2xs font-bold tracking-[2px] text-cream/45">{aside.label}</p>

          {/* ★ `pt` على الحاوية لا على اللوح: القضيب النحاسي يطفو
              خارج حدوده، فبلا متّسع فوقه يُقصّ عند حافّة العمود. */}
          <div className="pt-4">
            <Plaque crest rail className="px-6 py-6" style={aside.style}>
              {aside.plaque}
            </Plaque>
          </div>

          <p className="mt-6 text-xs leading-loose text-cream/60">{aside.note}</p>
        </div>
      </aside>
    </div>
  );
}
