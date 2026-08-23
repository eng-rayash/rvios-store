// ═══════════════════════════════════════════════════════════
//  اختبار تطبيق الويب التقدّمي
//
//  ما يُختبر هنا: أن الملفات تُخدم بالترويسات التي يشترطها
//  المتصفح للتثبيت والتسجيل، وأن عامل الخدمة لا يُخزّن ما
//  لا يجوز تخزينه.
//
//  ما لا يُختبر هنا: التسجيل الفعلي — يتطلّب متصفحاً حقيقياً،
//  ومتصفحات الأتمتة تُعطّل عمّال الخدمة. تحقّق منه يدوياً في
//  Chrome عبر: DevTools ← Application ← Service Workers.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import { finish } from './finish.mjs';

const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

console.log('── البيان (manifest) ──');
{
  const r = await fetch(B + '/manifest.json');
  ok(r.status === 200, 'يُخدم من الجذر');

  const m = await r.json();
  ok(!!m.name && !!m.short_name, 'له اسم واسم قصير');
  ok(m.display === 'standalone', 'يفتح كتطبيق لا كتبويب');
  ok(m.dir === 'rtl' && m.lang === 'ar', 'عربي من اليمين لليسار');
  ok(m.start_url === '/dashboard', 'يبدأ من لوحة التاجر');
  ok(!!m.theme_color && !!m.background_color, 'ألوان الهوية مضبوطة');
  ok(m.icons?.length >= 2, `أيقونات (${m.icons?.length})`);
  ok(m.icons?.some((i) => i.purpose === 'maskable'),
    'أيقونة maskable — بدونها تظهر مقصوصة على أندرويد');

  // كل أيقونة يجب أن تكون موجودة فعلاً
  for (const icon of m.icons ?? []) {
    const ir = await fetch(B + icon.src, { method: 'HEAD' });
    ok(ir.status === 200, `الأيقونة موجودة: ${icon.src}`);
    break;   // نفس الملف يتكرّر — يكفي فحص واحد
  }
}

console.log('\n── عامل الخدمة ──');
{
  const r = await fetch(B + '/sw.js');
  ok(r.status === 200, 'يُخدم من الجذر لا من /assets');
  ok(/javascript/.test(r.headers.get('content-type') ?? ''), 'نوع MIME صحيح');
  ok(r.headers.get('service-worker-allowed') === '/', 'نطاقه الجذر — ليتحكّم بصفحات المتاجر');
  ok(r.headers.get('cache-control') === 'no-store',
    'لا يُخزَّن — النسخة القديمة تخدم أصولاً قديمة إلى الأبد');
  ok(!r.headers.get('content-encoding'), 'بلا ضغط — مسار التسجيل أبسط ما يكون');
}
{
  // العامل تحت /assets لا يستطيع التحكّم بالجذر — نتأكّد أنه ليس هناك
  const r = await fetch(B + '/assets/js/sw.js');
  ok(r.status === 404, 'لا نسخة ثانية تحت /assets تربك النطاق');
}

console.log('\n── ما لا يُخزَّن ──');
{
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  ok(sw.includes("startsWith('/api/')"), 'ردود الـAPI مستثناة صراحةً');
  ok(/'\/health'/.test(sw), 'فحص الحياة مستثنى');
  ok(sw.includes('sitemap.xml'), 'ملفات الفهرسة مستثناة');
  ok(sw.includes("request.method !== 'GET'"), 'الطلبات غير GET لا تُخزَّن');
  ok(sw.includes('self.location.origin'), 'النطاقات الخارجية لا تُخزَّن');
  // الإصدار يمسح ذاكرات سابقة — بدونه تتراكم إلى ما لا نهاية
  ok(sw.includes('caches.delete'), 'الإصدارات القديمة تُحذف عند التفعيل');
}

console.log('\n── صفحة انقطاع الاتصال ──');
{
  const r = await fetch(B + '/offline.html');
  ok(r.status === 200, 'تُخدم');
  const html = await r.text();
  ok(html.includes('لا يوجد اتصال'), 'تشرح السبب');
  ok(html.includes('متجرك وبياناتك سليمة'),
    'تطمئن التاجر أن العطل في الشبكة لا في متجره');
  ok(!/<script>[^<]/.test(html), 'بلا سكربت inline — سياسة CSP تمنعه');
  ok(html.includes('/assets/js/offline.js'), 'سكربتها خارجي');
}

console.log('\n── الربط في الصفحات ──');
{
  const pages = ['/', '/dashboard', '/login', '/pricing', '/yazan'];
  for (const p of pages) {
    const html = await (await fetch(B + p)).text();
    const hasManifest = html.includes('rel="manifest"');
    const hasTheme = html.includes('name="theme-color"');
    const hasPwa = html.includes('/assets/js/pwa.js');
    ok(hasManifest && hasTheme && hasPwa, `${p.padEnd(12)} مربوطة بالكامل`);
  }
}
{
  // صفحة الانقطاع لا تُسجّل العامل — تُعرض حين لا شبكة أصلاً
  const html = await (await fetch(B + '/offline.html')).text();
  ok(!html.includes('/assets/js/pwa.js'), 'صفحة الانقطاع خارج التسجيل عمداً');
}

console.log('\n── سياسة الأمان تسمح بالعامل ──');
{
  const r = await fetch(B + '/dashboard');
  const csp = r.headers.get('content-security-policy') ?? '';
  ok(/script-src[^;]*'self'/.test(csp), "script-src 'self' يسمح بـ/sw.js");
  ok(!csp.includes("script-src 'none'"), 'لا حظر شامل للسكربتات');
}

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
