import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'لا توجد لوحة على هذا الرابط',
  robots: { index: false, follow: false },
};

/**
 * صفحة ٤٠٤.
 *
 * ★ لم تكن موجودة في تطبيق Next إطلاقاً — لا `not-found` ولا
 * `error` ولا `loading` في `src/app` كلّه. وواجهة المتجر تستدعي
 * `notFound()` حين لا يوجد المتجر، فكان الزائر يقع على صفحة
 * الإطار العامّة: إنجليزية، بيضاء، بلا مخرج.
 *
 * والخسارة ليست جمالية. النسخة القديمة كانت **تحوّل الخطأ إلى
 * تسجيل**: من كتب رابطاً غير مسجّل يُعرض عليه أن يحجزه لنفسه.
 * وهو أرخص مسار تحويل في الموقع كلّه — يصل إليه الزائر بنفسه.
 *
 * ★ واللافتة المعلّقة مرسومة هنا لا مستوردة: هذا هو الموضع
 * الوحيد الذي يكون فيه اللوح **فارغاً** — قضيبٌ وسلكان ولوحٌ بلا
 * اسم. وهو المعنى نفسه: مكانٌ بلا لوحة، ينتظر من يعلّق لوحته.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="grid min-h-[70vh] place-items-center px-6 py-20">
        <div className="max-w-[520px] text-center">
          {/* اللافتة: قضيب نحاسي، سلكان، ولوحٌ فارغ */}
          <div aria-hidden className="relative mx-auto mb-8 h-24 w-[132px]">
            <span className="absolute inset-x-3.5 top-0 h-[3px] rounded-sm bg-brass" />
            <span className="absolute top-[3px] start-6 h-3 w-px bg-brass-deep" />
            <span className="absolute top-[3px] end-6 h-3 w-px bg-brass-deep" />
            <span className="absolute inset-x-0 top-3.5 bottom-0 grid place-items-center rounded-sm border border-line bg-paper shadow-soft">
              <span className="font-display text-price leading-none text-line">؟</span>
            </span>
          </div>

          <h1 className="font-display text-h2 leading-tight font-bold">لا توجد لوحة على هذا الرابط</h1>
          <p className="mt-3 text-md leading-loose text-soft text-pretty">
            هذا الرابط غير مسجّل على المنصة. تأكّد من كتابته — أو احجزه لمتجرك أنت، فما زال متاحاً.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/onboarding" className={cn(buttonVariants({ tone: 'fill' }))}>
              احجز هذا الرابط مجاناً
            </Link>
            <Link href="/" className={cn(buttonVariants({ tone: 'line' }))}>
              الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
