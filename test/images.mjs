import { finish } from './finish.mjs';
// اختبار رفع الصور: data URI → ملف على القرص
import fs from 'node:fs';
import { BASE as B } from './base.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

async function j(method, path, body, cookie) {
  const r = await fetch(B + path, {
    method,
    headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = JSON.parse(t); } catch {}
  return { status: r.status, data: d, cookie: r.headers.getSetCookie?.().join('; ') ?? '' };
}

// صورة حقيقية من الأصول المستخرجة
const jpg = fs.readFileSync('public/assets/img/p1.jpg');
const dataUrl = 'data:image/jpeg;base64,' + jpg.toString('base64');
console.log(`  data URI بطول ${dataUrl.length} محرف (أكبر بكثير من حد 300 السابق)\n`);

const c1 = await j('POST', '/api/auth/request-code', { phone: '777000000' });
const v1 = await j('POST', '/api/auth/verify', { phone: '777000000', code: c1.data.devCode });
const SID = v1.cookie.split(';')[0];

console.log('── شعار المتجر ──');
const up = await j('PATCH', '/api/me/store', { logo: dataUrl }, SID);
ok(up.status === 200, 'قُبل رفع الشعار');
const logo = up.data?.store?.logo ?? '';
ok(/^\/uploads\/stores\/\d+\/logo\/[a-f0-9]{16}\.jpg$/.test(logo), `حُفظ كمسار: ${logo}`);
ok(!logo.startsWith('data:'), 'لم يُخزَّن كـ data URI في قاعدة البيانات');

const served = await fetch(B + logo);
ok(served.status === 200, 'الملف يُخدم عبر HTTP');
ok(served.headers.get('content-type') === 'image/jpeg', 'نوع المحتوى صحيح');
ok(Number(served.headers.get('content-length')) === jpg.length, `الحجم مطابق للأصل (${jpg.length} بايت)`);
ok(/immutable/.test(served.headers.get('cache-control') ?? ''), 'ذاكرة تخزين طويلة (§٥.٣)');

console.log('\n── إزالة التكرار بالمحتوى ──');
const up2 = await j('PATCH', '/api/me/store', { logo: dataUrl }, SID);
ok(up2.data.store.logo === logo, 'رفع الصورة نفسها لا ينتج ملفاً ثانياً');

console.log('\n── صورة منتج ──');
const prod = await j('POST', '/api/me/products', { name: 'اختبار الصورة', price: 1000, qty: 1, image: dataUrl }, SID);
ok(prod.status === 201, 'أُضيف منتج بصورة');
ok(/^\/uploads\/stores\/\d+\/products\//.test(prod.data.product.image), `مسار منظّم: ${prod.data.product.image}`);

console.log('\n── الرفض ──');
const bad1 = await j('PATCH', '/api/me/store', { logo: 'data:text/html;base64,PHNjcmlwdD4=' }, SID);
ok(bad1.status === 400, 'رُفض نوع غير صورة');
const bad2 = await j('PATCH', '/api/me/store', { logo: 'javascript:alert(1)' }, SID);
ok(bad2.status === 400, 'رُفضت صيغة غير مدعومة');
const huge = 'data:image/jpeg;base64,' + Buffer.alloc(3 * 1024 * 1024).toString('base64');
const bad3 = await j('PATCH', '/api/me/store', { logo: huge }, SID);
ok(bad3.status === 413 || bad3.status === 400, `رُفضت صورة ضخمة (${bad3.status})`);

console.log('\n── منع الخروج من المجلد ──');
const trav = await fetch(B + '/uploads/../../server/db.js');
ok(trav.status === 404, 'رُفض مسار يحاول الخروج من المجلد');

await j('DELETE', `/api/me/products/${prod.data.product.id}`, null, SID);
console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
await finish(fail);
