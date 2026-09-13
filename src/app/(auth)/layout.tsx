import type { ReactNode } from 'react';
import { headers } from 'next/headers';

/**
 * تخطيط مساري الدخول والتسجيل.
 *
 * وجوده الوحيد لأجل عامل الخدمة: الصفحتان القديمتان كانتا
 * تحمّلان `pwa.js`، وترحيلهما إلى Next أسقطه بصمت — فلا يُسجَّل
 * عامل الخدمة لتاجرٍ يصل إلى الدخول أولاً، ولا يُعرض عليه تثبيت
 * التطبيق. و`test/pwa.mjs:84` يحرس وجوده في `/login` تحديداً.
 *
 * ★ `<script defer>` لا `next/script`: الملف يُسجّل عامل الخدمة
 * داخل مستمع `load`، و`afterInteractive` قد يحقنه بعد انطلاق
 * `load` على صفحة سريعة — فلا يُسجَّل شيء بلا خطأ. و`defer`
 * يعمل قبله دائماً كما في الصفحة القديمة.
 *
 * والـnonce يُقرأ من ترويسة يضعها `src/proxy.ts`: السياسة هنا
 * صارمة (`strict-dynamic`)، وسكربتٌ خارجي بلا nonce يُحجب.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      {children}
      <script src="/assets/js/pwa.js" defer nonce={nonce} />
    </>
  );
}
