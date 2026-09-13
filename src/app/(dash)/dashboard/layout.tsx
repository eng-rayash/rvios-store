import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import { DashProvider } from '@/components/dash/dash-context';
import { DashShell } from '@/components/dash/dash-shell';

export const metadata: Metadata = {
  /* القالب لا يتسلسل مع قالب الجذر في Next — الأقرب وحده يُطبَّق،
     فالعلامة تُكتب هنا صراحةً وإلا سقطت من عنوان كل شاشة */
  title: { template: '%s — لوحة التحكم · RVIOS Store', default: 'لوحة التحكم · RVIOS Store' },
  robots: { index: false, follow: false },
};

/**
 * تخطيط اللوحة.
 *
 * ★ `connection()` تُجبر التصيير الديناميكي — وهذا شرطٌ أمني لا
 * خيار أداء. سياسة CSP هنا صارمة بـnonce يولّده `proxy.ts` لكل
 * طلب، وNext يُلصق الـnonce بسكربتاته **أثناء التصيير**. صفحةٌ
 * مولَّدة ساكنةً وقت البناء لا طلب لها ولا nonce، فتُحجب
 * سكربتاتها كلها وتصير اللوحة HTML لا يستجيب. واللوحة شخصية
 * لكل تاجر أصلاً فلا تفقد شيئاً بالتصيير عند الطلب.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <DashProvider>
      <DashShell>{children}</DashShell>

      {/* ★ `<script defer>` لا `next/script`.
          `pwa.js` يُسجّل عامل الخدمة داخل مستمع `load`. و
          `afterInteractive` يحقن السكربت بعد الترطيب — وعلى صفحة
          سريعة يكون `load` قد انطلق قبلها فلا يُسجَّل شيء، بلا
          خطأ. و`defer` يعمل قبل `load` دائماً كما في الصفحة
          القديمة. والملف يُخدَم من الخادم القديم عبر `/assets`،
          وtest/pwa.mjs:84 يشترط وجوده في HTML اللوحة. */}
      <script src="/assets/js/pwa.js" defer nonce={nonce} />
    </DashProvider>
  );
}
