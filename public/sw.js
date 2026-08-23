// ═══════════════════════════════════════════════════════════
//  عامل الخدمة — RVIOS Store
//
//  الغرض الأول ليس العمل بلا إنترنت، بل سرعة الزيارة الثانية
//  على شبكة بطيئة: القشرة من الذاكرة فوراً، والبيانات من الشبكة.
//
//  قاعدة حاكمة: **لا نُخزّن أي رد من /api**.
//  تاجر يرى «٣ طلبات منتظرة» وهي في الحقيقة ١١ سيخسر عملاء —
//  وسيلوم المنصة لا الشبكة. البيانات القديمة أسوأ من غيابها.
// ═══════════════════════════════════════════════════════════

// الإصدار يُبدَّل عند كل نشر — بدونه يبقى المتصفح على أصول قديمة
const VERSION = 'rvios-v2';
const SHELL = `${VERSION}-shell`;

// أصول القشرة: ما تحتاجه الصفحة لترسم نفسها
const SHELL_ASSETS = [
  '/assets/css/tokens.css',
  '/assets/css/site.css',
  '/assets/css/dash.css',
  '/assets/css/store.css',
  '/assets/css/store-tiers.css',
  '/assets/js/app.js',
  '/assets/js/theme-core.js',
  '/assets/img/logo.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll يفشل كله لو فشل ملف واحد — نتساهل كي لا يسقط التثبيت
    await Promise.all(SHELL_ASSETS.map((url) =>
      cache.add(url).catch(() => { /* أصل مفقود لا يمنع التثبيت */ })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // حذف ذاكرات الإصدارات السابقة
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('rvios-') && !k.startsWith(VERSION))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** هل يجوز تخزين هذا الطلب أصلاً؟ */
function cacheable(url, request) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  // الـAPI أبداً — البيانات القديمة تُضلّل
  if (url.pathname.startsWith('/api/')) return false;
  // فحص الحياة وملفات الفهرسة يجب أن تكون حيّة دائماً
  if (url.pathname === '/health' || url.pathname === '/healthz') return false;
  if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!cacheable(url, request)) return;   // يمرّ إلى الشبكة كما هو

  /**
   * الصور والأصول ذات البصمة: من الذاكرة أولاً.
   * أسماؤها بصمات محتوى، فالمخزَّن صحيح بالتأكيد.
   */
  const immutable = url.pathname.startsWith('/uploads/')
    || url.pathname.startsWith('/assets/img/');

  if (immutable) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  /**
   * الصفحات وبقية الأصول: الشبكة أولاً، والذاكرة شبكة أمان.
   * صفحة المتجر تتغيّر كلما عدّل التاجر منتجاته؛ تقديم نسخة
   * قديمة لعميل يعني عرض سعر خاطئ أو منتج نفد.
   */
  event.respondWith((async () => {
    try {
      const res = await fetch(request);
      if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
      return res;
    } catch {
      const hit = await caches.match(request);
      if (hit) return hit;
      // صفحة بلا نسخة مخزّنة: نوضّح أن العطل في الشبكة لا في المتجر
      if (request.mode === 'navigate') {
        return (await caches.match('/offline.html'))
          ?? new Response('لا يوجد اتصال', {
            status: 503,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
      }
      return new Response('', { status: 504 });
    }
  })());
});
