import { existsSync } from 'node:fs';
import { finish } from './finish.mjs';
import { BASE as B } from './base.mjs';
import { SECTORS, PICKABLE, labelOf, isSector, DEFAULT_SECTOR } from '../server/sectors.js';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

const PAGES = [
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
/* ★ كان التوكيد يفحص وجود `store-page.js` — سكربت واجهة المتجر
   القديمة. وقد رُحّلت الواجهة إلى Next فلم يعد ذلك الملف يُحمَّل،
   والتوكيد كان يفحص **تفصيل تنفيذ** لا نتيجةً يراها زائر. وما
   يهمّ فعلاً أن الصفحة تُصيَّر على الخادم بوسومها — وهو ما يقرؤه
   واتساب ومحرّك البحث قبل أن يُنفَّذ أي سكربت. */
for (const slug of ['yazan', 'nura-boutique']) {
  const r = await fetch(B + '/' + slug);
  ok(r.status === 200 && (await r.text()).includes('og:title'), `/${slug}`);
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
const sec = await fetch(B + '/login');
for (const h of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) {
  ok(!!sec.headers.get(h), h);
}

console.log('\n── الأصول ──');
const ASSETS = [
  '/assets/css/tokens.css', '/assets/css/store.css',
  '/assets/css/dash.css', '/assets/css/flow.css',
  '/assets/js/app.js', '/assets/js/store-page.js',
  '/assets/js/dashboard.js', '/assets/js/admin.js', '/assets/js/onboarding.js',
  '/assets/js/sectors.js',
  '/assets/img/p1.jpg',
];
for (const a of ASSETS) {
  const r = await fetch(B + a);
  ok(r.status === 200, `${a} (${r.headers.get('content-type')?.split(';')[0]})`);
}

console.log('\n── الأمان ──');
const trav = await fetch(B + '/assets/../../server/db.js');
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

// القائمة كانت مكتوبة سبع مرّات وتباعدت. ما يستحق الفحص ليس
// عددَ القطاعات، بل الوعود التي جعلت توحيدها ضرورياً: أن كل
// قطاع تصل صورته، وأن مُعرِّفاً مهجوراً يظل مقروءاً، وأن قيمة
// غريبة لا تُحفظ.
console.log('');
console.log('── قائمة القطاعات ──');
ok(PICKABLE.length === SECTORS.length + 1, SECTORS.length + ' قطاعاً + «أخرى» في المُنتقي');
ok(new Set(PICKABLE.map((s) => s.id)).size === PICKABLE.length, 'لا مُعرِّف مكرّر');
ok(PICKABLE.every((s) => s.name && s.icon), 'لكل قطاع اسم وأيقونة');
ok(SECTORS.every((s) => s.blurb && s.tags.length), 'لكل قطاع معروض وصف وأمثلة تصنيفات');

const noFile = PICKABLE.filter((s) => s.img && !existsSync('public/assets/img/sectors/' + s.img));
ok(noFile.length === 0, 'كل صورة مُعلنة موجودة' + (noFile.length ? ' — ينقص ' + noFile.map((s) => s.img).join('، ') : ''));

ok(labelOf('accessories') === 'مجوهرات وساعات', 'مُعرِّف مهجور يُقرأ باسم خلفه');
ok(labelOf('sweets') === 'أطعمة وحلويات', 'مُعرِّف مهجور آخر يُقرأ');
ok(labelOf('لا-يوجد') === '', 'مُعرِّف مجهول يُعيد فراغاً لا نصّاً خاماً');
ok(isSector('perfumes') && !isSector('accessories'), 'المهجور مقروء لا مقبول');
ok(isSector(DEFAULT_SECTOR), 'القيمة الافتراضية قطاع صالح');

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
