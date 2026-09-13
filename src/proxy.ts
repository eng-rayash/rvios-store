import { NextResponse, type NextRequest } from 'next/server';

/**
 * سياسة أمان المحتوى للصفحات الحسّاسة: الدخول ولوحة التاجر.
 *
 * ★ لماذا هذا الملف موجود — والثغرة التي يُغلقها:
 * الخادم القديم يرسل CSP صارماً مع كل صفحة HTML (`server/http.js`).
 * وتطبيق Next لم يكن يرسل **أي** ترويسة أمان منذ بدأ الترحيل —
 * لا CSP ولا منعَ تأطير. فكل صفحةٍ رُحّلت فقدت حمايتها بصمت:
 * لا شيء يكسر، والصفحة تعمل، والثغرة لا تُرى إلا بفحص الترويسات.
 *
 * ★ لماذا nonce لا `'unsafe-inline'`:
 * Next يحقن سكربتات ترطيب مضمَّنة، وأسهل حلّ هو السماح بكل سكربت
 * مضمَّن. وتعليق `http.js` القديم يرفض هذا صراحةً: «ثمن راحةٍ
 * صغيرة هو فتح الباب لأخطر ما تحمينا منه هذه الترويسة». والـnonce
 * يسمح بسكربتات Next وحدها — بقيمةٍ جديدة لكل طلب لا يخمّنها مهاجم.
 *
 * ★ لماذا هنا وحدها لا على الموقع كلّه:
 * الـnonce يُجبر الصفحة على التصيير عند كل طلب. وصفحة الهبوط
 * (`revalidate=300`) وواجهات المتاجر (`revalidate=60`) تُولَّد ساكنةً
 * لتُحمَّل في أقلّ من ثانيتين على شبكة يمنية. أمّا الدخول واللوحة
 * فشخصيّتان لكل تاجر أصلاً — لا تفقدان شيئاً، وهما أحقّ الصفحات
 * بالحماية: فيهما يُكتب رقم الجوال ورمز التحقّق وتُدار الطلبات.
 * (ترويسات الأمان الأخرى — منع التأطير وغيره — على كل الصفحات
 * في `next.config.ts`، لأنها لا تكلّف شيئاً.)
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const r2 = originOf(process.env.R2_PUBLIC_URL);

  const csp = [
    "default-src 'self'",
    /* `strict-dynamic`: ما يُحمّله سكربتٌ موثوق يُوثَق — فقطع Next
       المحمَّلة ديناميكياً تعمل دون أن تُعدَّد. و`unsafe-eval` في
       التطوير وحده: React يستعمل eval لإعادة بناء مكدّس أخطاء الخادم. */
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    /* ★ `unsafe-inline` **بلا nonce** للأنماط — والترتيب مقصود.
       لون التاجر يُحقن في `style=""` على جذر اللوحة، وعرض شريط
       السعة كذلك. والمتصفّح **يتجاهل `unsafe-inline` حين يجد nonce**
       في التوجيه نفسه — فإضافة nonce هنا تُسقط لون كل متجر. وحقن
       الأنماط أدنى خطراً بكثير من حقن السكربتات. */
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    /* R2 حين يُضبط: الصور تُخدم من نطاق الحاوية العامّ مباشرةً
       (`storage.js`) — وبلا هذا تُحجب شعارات التجّار وصور منتجاتهم
       في اللوحة. وCSP القديم لا يتضمّنه. */
    `img-src 'self' data: blob: https://lh3.googleusercontent.com${r2 ? ` ${r2}` : ''}`,
    /* ★ جوجل في صفحة الإعداد وحدها — ولا حاجة لإضافتها إلى
       `script-src`: مع `strict-dynamic` تُتجاهَل قوائم المضيفين
       هناك أصلاً، وسكربت GSI يُحقنه كودُنا الموقَّع بالـnonce
       فيُوثَق بالوراثة. أمّا الإطار الذي تفتحه للتوقيع واتصالاتها
       فلا يغطّيهما ذلك — وبلا هذين يفشل التوثيق بصمت. */
    `connect-src 'self' https://accounts.google.com${dev ? ' ws: wss:' : ''}`,
    'frame-src https://accounts.google.com',
    "form-action 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  /* الـnonce يُمرَّر في ترويسة الطلب ليقرأه التصيير (`headers()`)،
     وCSP في ترويسة الطلب أيضاً: منها يستخرج Next الـnonce ويلصقه
     بسكربتاته تلقائياً. */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

function originOf(url?: string) {
  try { return url ? new URL(url).origin : ''; } catch { return ''; }
}

/**
 * ★ المطابقة ضيّقة عمداً — وتوسيعها يكسر ما حولها.
 * الـproxy يعمل **قبل** إعادة الكتابة إلى الخادم القديم. فلو طابق
 * `/onboarding` أو `/track` (ما زالا قديمين) لوصلتهما ترويسة
 * `strict-dynamic` هذه، فحُجبت سكربتاتهما الخارجية التي لا تحمل
 * nonce. ولو طابق صفحةً ساكنة (الهبوط، الباقات، المتاجر) لحُجبت
 * سكربتاتها هي — فلا nonce في HTML وُلِّد وقت البناء. كل صفحة
 * تُرحَّل تُضاف هنا **مع** إخراجها من `LEGACY_PAGES` — لا قبله.
 *
 * ★ والقيم **حرفية مكرّرة** لا ثابتاً مشتركاً — وهذا ليس سهواً.
 * Next يحلّل `matcher` تحليلاً ساكناً وقت البناء، وأي إشارةٍ إلى
 * متغيّر — ولو `const` مُعرَّفاً أعلى الملف — تُعدّ قيمةً ديناميكية
 * **فتُتجاهل المطابقة كلّها بصمت**، ويعمل الـproxy على كل طلب.
 * وهذا ما وقع في النسخة الأولى من هذا الملف: `missing: [...PREFETCH]`
 * أوصل CSP بالـnonce إلى صفحة الباقات الساكنة فحُجبت سكربتاتها،
 * بلا خطأ في البناء ولا تحذير في السجلّ.
 *
 * (`missing`: الاستباق المسبق للروابط لا يُصيِّر صفحة — لا يحتاج سياسة.)
 */
export const config = {
  matcher: [
    {
      source: '/login',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source: '/dashboard/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    {
      source: '/onboarding',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
