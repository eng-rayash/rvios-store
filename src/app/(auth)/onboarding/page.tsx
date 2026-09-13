import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { Loader2 } from 'lucide-react';
import { OnboardingFlow } from '@/components/auth/onboarding-flow';

export const metadata: Metadata = {
  title: 'أنشئ متجرك',
  description: 'أنشئ متجرك الإلكتروني على RVIOS Store في خطوات معدودة — بلا خبرة تقنية وبلا بطاقة بنكية.',
  robots: { index: false, follow: false },
};

/**
 * صفحة إنشاء المتجر.
 *
 * ★ `connection()` تُجبر التصيير عند الطلب — شرطُ CSP في
 * `src/proxy.ts`: الـnonce يُلصق بالسكربتات أثناء التصيير،
 * وصفحةٌ مولَّدة ساكنةً لا nonce لها فتُحجب سكربتاتها.
 *
 * ★ و`Suspense` لأن التدفّق يقرأ `useSearchParams` (وضع «متجر
 * إضافي» واللون القادم من استوديو الباقات).
 */
export default async function OnboardingPage() {
  await connection();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="جارٍ التحميل">
          <Loader2 className="size-6 animate-spin text-soft" aria-hidden />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
