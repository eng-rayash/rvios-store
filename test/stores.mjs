// اختبار المتاجر المتعددة (باقة برو)
import fs from 'node:fs';
import { finish } from './finish.mjs';
const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

async function j(method, path, body, cookie, store) {
  const r = await fetch(B + path, {
    method,
    headers: {
      connection: 'close',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(store ? { 'x-store': store } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = JSON.parse(t); } catch {}
  return { status: r.status, data: d, cookie: r.headers.getSetCookie?.().join('; ') ?? '' };
}

async function login(phone) {
  const c = await j('POST', '/api/auth/request-code', { phone });
  const v = await j('POST', '/api/auth/verify', { phone, code: c.data.devCode });
  return v.cookie.split(';')[0];
}

const receipt = 'data:image/jpeg;base64,' + fs.readFileSync('public/assets/img/p3.jpg').toString('base64');
const ADMIN = (await j('POST', '/api/admin/login', { pass: 'rvios-admin' })).cookie.split(';')[0];
const SID = await login('777000000');            // ذو يزن

console.log('── خانة واحدة افتراضياً ──');
const me0 = await j('GET', '/api/auth/me', null, SID);
ok(me0.data.stores.length === 1, `يملك متجراً واحداً (${me0.data.stores.length})`);
ok(me0.data.slots.slots === 1, 'خانة واحدة افتراضياً');
ok(me0.data.slots.free === 0, 'لا خانات شاغرة');

const denied = await j('POST', '/api/stores', { name: 'متجر ثانٍ', slug: 'second-shop' }, SID);
ok(denied.data?.code === 'NO_STORE_SLOT', 'رُفض المتجر الثاني بلا خانة');

console.log('\n── الخانة حكر على برو ──');
await j('PATCH', '/api/admin/settings', { 'price.extra_store': 900, 'price.pro': 8000,
  'pay.kuraimi': 'حوّل إلى الكريمي ١٢٣٤ واكتب المرجع.' }, ADMIN);
const tooEarly = await j('POST', '/api/me/billing/invoices', { kind: 'extra_store' }, SID);
ok(tooEarly.data?.code === 'PRO_REQUIRED', 'رُفض شراء خانة على غير برو');

console.log('\n── ترقية لبرو ثم شراء خانة ──');
const pro = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'pro', months: 1 }, SID);
await j('POST', `/api/me/billing/invoices/${pro.data.invoice.id}/proof`, { method: 'kuraimi', proof: receipt }, SID);
ok((await j('GET', '/api/me/billing', null, SID)).data.subscription.plan === 'pro', 'فُعّلت برو');

const slot = await j('POST', '/api/me/billing/invoices', { kind: 'extra_store' }, SID);
ok(slot.status === 201, `أُنشئت فاتورة الخانة (${slot.data.invoice?.ref})`);
ok(slot.data.invoice.amount === 900, `السعر من الإعدادات (${slot.data.invoice.amount})`);

const beforeSlot = (await j('GET', '/api/auth/me', null, SID)).data.slots.slots;
await j('POST', `/api/me/billing/invoices/${slot.data.invoice.id}/proof`, { method: 'kuraimi', proof: receipt }, SID);
const afterSlot = (await j('GET', '/api/auth/me', null, SID)).data.slots;
ok(afterSlot.slots === beforeSlot + 1, `مُنحت الخانة فوراً (${beforeSlot} ← ${afterSlot.slots})`);
ok(afterSlot.free === 1, 'خانة شاغرة واحدة');

console.log('\n── إنشاء المتجر الثاني ──');
const second = await j('POST', '/api/stores', { name: 'بوتيك ريّان', slug: 'rayan-boutique' }, SID);
ok(second.status === 201, `أُنشئ المتجر الثاني (/${second.data?.slug})`);

const me1 = await j('GET', '/api/auth/me', null, SID);
ok(me1.data.stores.length === 2, 'صار للتاجر متجران');
const inherited = me1.data.stores.find((s) => s.slug === 'rayan-boutique');
ok(inherited.plan === 'pro', `المتجر الإضافي ورث برو لا المجانية (${inherited.plan})`);

const third = await j('POST', '/api/stores', { name: 'ثالث', slug: 'third-shop' }, SID);
ok(third.data?.code === 'NO_STORE_SLOT', 'المتجر الثالث يحتاج خانة أخرى');

console.log('\n── تبديل السياق بترويسة X-Store ──');
const yazanProducts = await j('GET', '/api/me/products', null, SID, 'yazan');
const rayanProducts = await j('GET', '/api/me/products', null, SID, 'rayan-boutique');
ok(yazanProducts.data.products.length === 9, `ذو يزن: ${yazanProducts.data.products.length} منتجاً`);
ok(rayanProducts.data.products.length === 0, `بوتيك ريّان: ${rayanProducts.data.products.length} — فارغ`);

await j('POST', '/api/me/products', { name: 'منتج ريّان', price: 5000, qty: 2 }, SID, 'rayan-boutique');
const afterAdd = await j('GET', '/api/me/products', null, SID, 'rayan-boutique');
ok(afterAdd.data.products.length === 1, 'أُضيف المنتج للمتجر الصحيح');
const yazanAgain = await j('GET', '/api/me/products', null, SID, 'yazan');
ok(yazanAgain.data.products.length === 9, 'متجر ذو يزن لم يتأثر — العزل قائم');

console.log('\n── متجر لا يملكه التاجر ──');
const foreign = await j('GET', '/api/me/products', null, SID, 'nura-boutique');
ok(foreign.status === 200, 'لا يفشل الطلب');
ok(foreign.data.products.length === 9, 'سقط للافتراضي (ذو يزن) — لا تسريب لمتجر نورا');

console.log('\n── تثبيت المتجر النشط في الجلسة ──');
const set = await j('POST', '/api/me/active-store', { store: 'rayan-boutique' }, SID);
ok(set.status === 200 && set.data.store.slug === 'rayan-boutique', 'ثُبّت المتجر النشط');
const noHeader = await j('GET', '/api/me/products', null, SID);
ok(noHeader.data.products.length === 1, 'الطلب بلا ترويسة يتبع الجلسة (بوتيك ريّان)');
const headerWins = await j('GET', '/api/me/products', null, SID, 'yazan');
ok(headerWins.data.products.length === 9, 'الترويسة تتجاوز الجلسة — تبويبان مستقلان');

const badSwitch = await j('POST', '/api/me/active-store', { store: 'nura-boutique' }, SID);
ok(badSwitch.status === 404, 'لا يمكن التبديل إلى متجر لا يملكه');

console.log('\n── قائمة المتاجر ──');
const list = await j('GET', '/api/me/stores', null, SID);
ok(list.data.stores.length === 2, 'المسار يعيد المتجرين');
ok(list.data.slots.owned === 2 && list.data.slots.slots === 2, 'حالة الخانات صحيحة');

console.log('\n── رفض الإيصال يسحب الخانة ولا يحذف متجراً ──');
const slot2 = await j('POST', '/api/me/billing/invoices', { kind: 'extra_store' }, SID);
await j('POST', `/api/me/billing/invoices/${slot2.data.invoice.id}/proof`, { method: 'jaib', proof: receipt }, SID);
ok((await j('GET', '/api/auth/me', null, SID)).data.slots.slots === 3, 'صارت ٣ خانات');
await j('PATCH', `/api/admin/invoices/${slot2.data.invoice.id}`, { action: 'void', reason: 'إيصال مكرر' }, ADMIN);
const afterVoid = (await j('GET', '/api/auth/me', null, SID)).data;
ok(afterVoid.slots.slots === 2, 'سُحبت الخانة غير المستخدمة');
ok(afterVoid.stores.length === 2, '★ المتجران القائمان لم يُمسّا');

console.log('\n── الإدارة تقيس بالتجار لا بالمتاجر ──');
const stats = await j('GET', '/api/admin/stats', null, ADMIN);
ok(stats.data.multiStore === 1, `تاجر واحد متعدد المتاجر (${stats.data.multiStore})`);
// الثابت المهم: التاجر متعدد المتاجر يُعدّ مرة واحدة، فالتجار المدفوعون
// أقل من المتاجر المدفوعة — وهو بالضبط ما كان يضخّم النسبة قبل الإصلاح.
ok(stats.data.paidMerchants < stats.data.paid,
   `${stats.data.paidMerchants} تاجر مدفوع مقابل ${stats.data.paid} متجر مدفوع — التاجر يُعدّ مرة`);
ok(stats.data.upgradeRate <= 100, `معدل الترقية ${stats.data.upgradeRate}٪ — لا يتجاوز ١٠٠٪`);

const adminStores = await j('GET', '/api/admin/stores', null, ADMIN);
const yazanRow = adminStores.data.find((s) => s.slug === 'yazan');
ok(yazanRow.owner_stores === 2, `جدول المتاجر يبيّن أن المالك يملك ${yazanRow.owner_stores}`);

console.log('\n── حذف متجر واحد منفصل عن حذف الحساب ──');
const wrongConfirm = await j('DELETE', `/api/me/stores/${inherited.id}`, { confirm: 'yazan' }, SID);
ok(wrongConfirm.data?.code === 'CONFIRM_MISMATCH', 'تأكيد برابط متجر آخر مرفوض');

const del = await j('DELETE', `/api/me/stores/${inherited.id}`, { confirm: 'rayan-boutique' }, SID);
ok(del.status === 200, 'حُذف المتجر الإضافي');
const left = await j('GET', '/api/auth/me', null, SID);
ok(left.data.stores.length === 1 && left.data.stores[0].slug === 'yazan', 'بقي متجر ذو يزن وحده');

const lastOne = await j('DELETE', `/api/me/stores/${left.data.stores[0].id}`, { confirm: 'yazan' }, SID);
ok(lastOne.data?.code === 'LAST_STORE', 'لا يمكن حذف المتجر الوحيد بهذا المسار');

console.log('\n── تأكيد حذف الحساب صار عبارة صريحة ──');
const oldWay = await j('DELETE', '/api/me/account', { confirm: 'yazan' }, SID);
ok(oldWay.data?.code === 'CONFIRM_MISMATCH', '★ رابط المتجر لم يعد يكفي لمحو الحساب');
ok(/حذف حسابي/.test(oldWay.data.error), 'الرسالة تطلب العبارة الصريحة وتعدّ المتاجر');

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
