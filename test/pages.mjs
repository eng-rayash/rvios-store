import { finish } from './finish.mjs';
const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

const PAGES = [
  ['/', 'الرئيسية', 'أنشئ متجرك الإلكتروني مجاناً'],
  ['/pricing', 'الباقات', 'الباقات'],
  ['/sectors', 'القطاعات', 'القطاعات'],
  ['/about', 'عن المنصة', 'عن المنصة'],
  ['/contact', 'تواصل معنا', 'تواصل معنا'],
  ['/legal', 'قانونية', 'الشروط والخصوصية'],
  ['/login', 'الدخول', 'تسجيل الدخول'],
  ['/onboarding', 'الإعداد', 'أنشئ متجرك'],
  ['/dashboard', 'لوحة التاجر', 'لوحة التحكم'],
  ['/admin', 'الإدارة', 'إدارة المنصة'],
];

console.log('── صفحات المنصة ──');
for (const [path, name, expect] of PAGES) {
  const r = await fetch(B + path);
  const html = await r.text();
  ok(r.status === 200 && html.includes(expect), `${name.padEnd(14)} ${path}`);
}

console.log('\n── صفحات المتاجر ──');
for (const slug of ['yazan', 'nura-boutique']) {
  const r = await fetch(B + '/' + slug);
  ok(r.status === 200 && (await r.text()).includes('store-page.js'), `/${slug}`);
}
const gone = await fetch(B + '/no-such-store');
ok(gone.status === 404 && (await gone.text()).includes('احجز هذا الرابط'), 'صفحة ٤٠٤ تقترح حجز الرابط');

const susp = await fetch(B + '/under-review');
ok(susp.status === 200, 'المتجر الموقوف يخدم الصفحة (والـ API يردّ ٤١٠)');

console.log('\n── HTML مولّد من الخادم (واتساب ومحركات البحث) ──');
const ssr = await (await fetch(B + '/yazan')).text();
ok(/<title>متجر ذو يزن للعطور/.test(ssr), 'العنوان في HTML');
ok(/og:title/.test(ssr) && /og:image/.test(ssr), 'وسوم Open Graph');
ok(/application\/ld\+json/.test(ssr), 'بيانات منظّمة Schema.org');
ok((ssr.match(/<article>/g) ?? []).length >= 9, 'المنتجات مقروءة قبل تنفيذ JS');

console.log('\n── الفهرسة ──');
const sm = await fetch(B + '/sitemap.xml');
ok(sm.status === 200 && (await sm.text()).includes('/yazan'), 'sitemap.xml يضم المتاجر');
const rb = await fetch(B + '/robots.txt');
ok(rb.status === 200 && (await rb.text()).includes('Disallow: /admin'), 'robots.txt يمنع لوحات الإدارة');

console.log('\n── ترويسات الأمان ──');
const sec = await fetch(B + '/');
for (const h of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) {
  ok(!!sec.headers.get(h), h);
}

console.log('\n── الأصول ──');
const ASSETS = [
  '/assets/css/tokens.css', '/assets/css/site.css', '/assets/css/store.css',
  '/assets/css/dash.css', '/assets/css/flow.css',
  '/assets/js/app.js', '/assets/js/site.js', '/assets/js/store-page.js',
  '/assets/js/dashboard.js', '/assets/js/admin.js', '/assets/js/onboarding.js',
  '/assets/img/p1.jpg',
];
for (const a of ASSETS) {
  const r = await fetch(B + a);
  ok(r.status === 200, `${a} (${r.headers.get('content-type')?.split(';')[0]})`);
}

console.log('\n── الأمان ──');
const trav = await fetch(B + '/assets/../../src/db.js');
ok(trav.status === 404, 'رُفض الخروج من مجلد الأصول');
const nodir = await fetch(B + '/assets/');
ok(nodir.status === 404, 'لا فهرسة للمجلدات');
const noapi = await fetch(B + '/api/nothing');
ok(noapi.status === 404, 'مسار API غير معروف يردّ ٤٠٤');
const wrongMethod = await fetch(B + '/api/plans', { method: 'DELETE' });
ok(wrongMethod.status === 405, 'طريقة خاطئة تردّ ٤٠٥');

console.log('\n── الروابط المحجوزة لا تُخدم كمتاجر ──');
for (const r of ['admin', 'dashboard', 'api', 'assets']) {
  const res = await fetch(B + '/' + r);
  ok(res.status !== 404 || r === 'api' || r === 'assets', `/${r} محجوز للمنصة`);
}

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
