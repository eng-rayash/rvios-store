import type { Metadata } from 'next';
import { connection } from 'next/server';
import { FlowShell } from '@/components/auth/flow-shell';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'ادخل إلى لوحة متجرك على RVIOS Store برقم جوالك.',
  robots: { index: false, follow: false },
};

/**
 * صفحة الدخول.
 *
 * ★ العمود الجانبي هنا لا يعاين متجراً بعينه — التاجر لم يُعرَّف
 * بعد حين يفتح الصفحة. فيحمل اللوحَ بوصفه **وعداً**: لوحتك ما
 * زالت معلّقة حيث تركتها. وهي الاستعارة نفسها التي تبيعها
 * المنصة، مستعملةً في اللحظة التي تعني فيها شيئاً.
 */
export default async function LoginPage() {
  /* ★ تصييرٌ عند الطلب شرطٌ لـCSP في `src/proxy.ts`: الـnonce يُلصق
     بالسكربتات أثناء التصيير، وصفحةٌ مولَّدة ساكنةً وقت البناء لا
     nonce لها — فتُحجب سكربتاتها ويصير النموذج HTML لا يستجيب. */
  await connection();

  return (
    <FlowShell
      aside={{
        label: 'أهلاً بعودتك',
        plaque: (
          <>
            <p className="font-display text-[27px] leading-snug font-bold">
              لوحتك ما زالت معلّقة
            </p>
            <p className="mt-1 text-xs text-soft">
              متجرك وطلباتك وعملاؤك — كما تركتهم تماماً.
            </p>
            <hr className="my-3.5 border-0 border-t border-line" />
            <p className="flex items-center gap-2 text-xs text-soft">
              <span className="ping" aria-hidden />
              المتجر يستقبل الطلبات أثناء غيابك
            </p>
          </>
        ),
        note: (
          <>
            ندخلك برقم جوالك ورمزٍ نرسله إليه — بلا كلمة مرور تُنسى
            أو تُسرق. والرمز صالح دقائق معدودة ثم يبطل.
          </>
        ),
      }}
    >
      <LoginForm />
    </FlowShell>
  );
}
