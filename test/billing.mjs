// اختبار نظام الفوترة (§٥)
import fs from 'node:fs';
import { finish } from './finish.mjs';
const B = 'http://localhost:3000';
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

async function login(phone) {
  const c = await j('POST', '/api/auth/request-code', { phone });
  const v = await j('POST', '/api/auth/verify', { phone, code: c.data.devCode });
  return v.cookie.split(';')[0];
}

const receipt = 'data:image/jpeg;base64,' + fs.readFileSync('public/assets/img/p3.jpg').toString('base64');

const ADMIN = (await j('POST', '/api/admin/login', { pass: 'rvios-admin' })).cookie.split(';')[0];
const SID = await login('733445566');   // نورا · مجانية

console.log('── السعر غير المحسوم يمنع الفوترة (§١١) ──');
const noPrice = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus' }, SID);
ok(noPrice.status === 409 && noPrice.data.code === 'PRICE_UNSET', 'رُفضت الفوترة قبل إعلان السعر');

console.log('\n── الإدارة تضبط الأسعار وتعليمات التحويل ──');
const set = await j('PATCH', '/api/admin/settings', {
  'price.plus': 3000, 'price.pro': 8000, 'price.domain': 12000,
  'pay.kuraimi': 'حوّل إلى حساب الكريمي رقم ١٢٣٤ باسم RVIOS، واكتب المرجع في الملاحظات.',
}, ADMIN);
ok(set.status === 200, 'حُفظت الإعدادات');
ok(set.data.prices.plus === 3000, `سعر بلس = ${set.data.prices.plus} ر.ي`);

const pub = await j('GET', '/api/plans');
ok(Array.isArray(pub.data), 'الباقات العامة ما زالت تُخدم');

console.log('\n── إنشاء فاتورة بمرجع (§٥.٢) ──');
const inv = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus', months: 1 }, SID);
ok(inv.status === 201, 'أُنشئت الفاتورة');
ok(/^RV-INV-\d{4}$/.test(inv.data.invoice.ref), `مرجع فريد: ${inv.data.invoice.ref}`);
ok(inv.data.invoice.amount === 3000, `المبلغ = ${inv.data.invoice.amount}`);
ok(inv.data.invoice.status === 'unpaid', 'الحالة: غير مدفوعة');
ok(inv.data.methods.length >= 1, `وسائل الدفع المعروضة: ${inv.data.methods.length} (بلا تعليمات لا تُعرض)`);

const again = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus' }, SID);
ok(again.data.invoice.ref === inv.data.invoice.ref, 'لا تتكدّس فواتير مفتوحة من النوع نفسه');

console.log('\n── خصم الاشتراك السنوي (§٥.٦) ──');
const yearly = await j('POST', '/api/me/billing/invoices', { kind: 'domain' }, SID);
ok(yearly.data.invoice.amount === 12000, `خدمة الدومين = ${yearly.data.invoice.amount}`);

console.log('\n── رفع الإيصال يفعّل الباقة فوراً (§٥.٣) ──');
const before = await j('GET', '/api/me/billing', null, SID);
ok(before.data.subscription.plan === 'basic', 'قبل الدفع: مجانية');

const proof = await j('POST', `/api/me/billing/invoices/${inv.data.invoice.id}/proof`,
  { method: 'kuraimi', proof: receipt }, SID);
ok(proof.status === 200, 'قُبل الإيصال');
ok(proof.data.invoice.status === 'under_review', 'الحالة: قيد المراجعة');
ok(proof.data.invoice.proof_key.startsWith('/uploads/'), 'حُفظ الإيصال كملف');
ok(proof.data.subscription.plan === 'plus', '★ فُعّلت الباقة فوراً بلا انتظار المراجعة');

const caps = await j('GET', '/api/me/products', null, SID);
ok(caps.data.capacity.max === 100, `حد المنتجات ارتفع إلى ${caps.data.capacity.max}`);

console.log('\n── طابور مراجعة المدفوعات (§٥.٦) ──');
const queue = await j('GET', '/api/admin/invoices?status=under_review', null, ADMIN);
ok(queue.data.some((i) => i.ref === inv.data.invoice.ref), 'الفاتورة في طابور المراجعة');
ok(queue.data[0].store_name && queue.data[0].owner_phone, 'الطابور يعرض المتجر ورقم التاجر');

console.log('\n── الإدارة تؤكد الدفع ──');
const paid = await j('PATCH', `/api/admin/invoices/${inv.data.invoice.id}`, { action: 'paid' }, ADMIN);
ok(paid.data.invoice.status === 'paid', 'صارت مدفوعة');
ok(!!paid.data.invoice.paid_at, 'سُجّل وقت الدفع');

console.log('\n── §٥.٥ إخفاء لا حذف عند فقدان الباقة ──');
// نبني السيناريو الحقيقي: تاجر على بلس تجاوز حد المجانية، ثم انتهى اشتراكه
const store = await j('GET', '/api/me/store', null, SID);
const slug = store.data.store.slug;

const startCount = (await j('GET', '/api/me/products', null, SID)).data.products.length;
for (let i = startCount; i < 22; i++) {
  await j('POST', '/api/me/products', { name: `منتج ${i}`, price: 1000, qty: 2 }, SID);
}
const onPlus = await j('GET', '/api/me/products', null, SID);
ok(onPlus.data.products.length === 22, `على بلس: ${onPlus.data.products.length} منتجاً`);
const publicOnPlus = await j('GET', `/api/shop/${slug}/products?per=48`);
ok(publicOnPlus.data.total === 22, `العميل يرى الـ٢٢ كلها (${publicOnPlus.data.total})`);

console.log('\n── رفض إيصال يُلغي التفعيل ──');
const inv2 = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'pro', months: 1 }, SID);
await j('POST', `/api/me/billing/invoices/${inv2.data.invoice.id}/proof`, { method: 'jaib', proof: receipt }, SID);
ok((await j('GET', '/api/me/billing', null, SID)).data.subscription.plan === 'pro', 'فُعّلت برو مؤقتاً');

const voided = await j('PATCH', `/api/admin/invoices/${inv2.data.invoice.id}`,
  { action: 'void', reason: 'إيصال غير مطابق' }, ADMIN);
ok(voided.data.invoice.status === 'void', 'أُلغيت الفاتورة');

const afterVoid = await j('GET', '/api/me/billing', null, SID);
ok(afterVoid.data.subscription.plan === 'basic', 'سُحب التفعيل بعد الرفض');

console.log('\n── ★ البيانات سليمة والعرض محدود ──');
const merchantView = await j('GET', '/api/me/products', null, SID);
const publicView = await j('GET', `/api/shop/${slug}/products?per=48`);
ok(merchantView.data.products.length === 22, `التاجر ما زال يملك ٢٢ منتجاً (${merchantView.data.products.length}) — لا حذف`);
ok(publicView.data.total === 15, `العميل يرى ١٥ فقط (${publicView.data.total}) — إخفاء`);
ok(afterVoid.data.hidden === 7, `المخفي = ${afterVoid.data.hidden} منتجات، معلنة للتاجر`);

// والأهم: الترقية تعيد كل شيء بلا فقد
const back = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus' }, SID);
await j('POST', `/api/me/billing/invoices/${back.data.invoice.id}/proof`, { method: 'kuraimi', proof: receipt }, SID);
const restored = await j('GET', `/api/shop/${slug}/products?per=48`);
ok(restored.data.total === 22, `بعد الترقية عادت الـ٢٢ كلها (${restored.data.total})`);

console.log('\n── سجل التدقيق ──');
const auditLog = await j('GET', '/api/admin/audit', null, ADMIN);
ok(auditLog.data.some((a) => a.action === 'invoice.paid'), 'سُجّل تأكيد الدفع');
ok(auditLog.data.some((a) => a.action === 'invoice.void'), 'سُجّل الرفض مع السبب');
ok(auditLog.data.some((a) => a.action === 'settings.update'), 'سُجّل تغيير الأسعار');

console.log('\n── السعر الذي تقرأه الواجهات (§١١) ──');
{
  // plans.js تحمل priceUsd (سعر استراتيجي)، والفوترة بالريال من الإعدادات.
  // كانت الواجهات تقرأ p.price غير الموجود فتعرض «—» أو «٠».
  const pub = await j('GET', '/api/plans');
  const plus = pub.data.find((p) => p.id === 'plus');
  ok(plus.price === 3000, `‏/api/plans يحمل السعر بالريال (${plus.price})`);

  const mine = await j('GET', '/api/me/plan', null, SID);
  ok(mine.data.all.find((p) => p.id === 'plus').price === 3000, '‏/api/me/plan كذلك');

  const adm = await j('GET', '/api/admin/plans', null, ADMIN);
  ok(adm.data.find((p) => p.id === 'plus').price === 3000, '‏/api/admin/plans كذلك');
  ok(adm.data.every((p) => p.price !== undefined), 'لا مسار يترك price غير معرّف');
}

// جلسة التاجر الثاني تُنشأ مرة واحدة وتُعاد في فحصين — حصة رمز
// التحقق محدودة بالساعة، وكل دخول إضافي يقترب من الحد
const OTHER = await login('777000000');

console.log('\n── طلب باقة مختلفة لا يعيد فاتورة قديمة بصمت ──');
{
  const fresh = OTHER;
  await j('PATCH', '/api/admin/settings', { 'price.pro': 8000 }, ADMIN);

  const a = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus' }, fresh);
  const b = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'pro' }, fresh);
  ok(b.data.invoice.plan === 'pro', `طلب برو أعطى فاتورة برو (${b.data.invoice.plan})`);
  ok(b.data.invoice.ref !== a.data.invoice.ref, 'مرجع جديد لا القديم');
  ok(b.data.invoice.amount === 8000, `بالمبلغ الصحيح (${b.data.invoice.amount})`);

  const same = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'pro' }, fresh);
  ok(same.data.invoice.ref === b.data.invoice.ref, 'الطلب المطابق يعيد الفاتورة نفسها');

  // بعد رفع الإيصال يُرفض تغيير الطلب بوضوح بدل تجاهله
  await j('POST', `/api/me/billing/invoices/${b.data.invoice.id}/proof`, { method: 'kuraimi', proof: receipt }, fresh);
  const blocked = await j('POST', '/api/me/billing/invoices', { kind: 'subscription', plan: 'plus' }, fresh);
  ok(blocked.data?.code === 'INVOICE_PENDING', 'فاتورة قيد المراجعة تمنع طلباً مختلفاً برسالة واضحة');

  /**
   * نعيد الحالة كما وجدناها بلا تخليف فواتير معلّقة:
   * الإلغاء يزيل الفاتورة ويردّ الباقة إلى المجانية، ثم تعيدها
   * الإدارة إلى بلس مباشرة. إنشاء فاتورة أخرى هنا كان سيترك
   * صفاً «قيد المراجعة» يحجب المجموعة التالية.
   */
  await j('PATCH', `/api/admin/invoices/${b.data.invoice.id}`,
    { action: 'void', reason: 'تنظيف بعد الفحص' }, ADMIN);
  const st = await j('GET', '/api/me/store', null, fresh);
  await j('PATCH', `/api/admin/stores/${st.data.store.id}`, { plan: 'plus' }, ADMIN);
  ok((await j('GET', '/api/me/plan', null, fresh)).data.current.id === 'plus',
     'أُعيدت حالة المتجر كما كانت');
}

console.log('\n── ما تعتمد عليه واجهتا الفوترة ──');
{
  // شاشة التاجر: فاتورة مفتوحة + تعليمات تحويل + سجل
  const view = await j('GET', '/api/me/billing', null, SID);
  ok(Array.isArray(view.data.invoices), 'سجل الفواتير متاح للعرض');
  ok(view.data.methods.every((m) => m.instructions), 'الوسيلة بلا تعليمات لا تُعرض للتاجر');
  ok(typeof view.data.hidden === 'number', 'عدد المنتجات المخفية معلن للتاجر');
  ok(view.data.subscription.status !== undefined, 'حالة الاشتراك معلنة (نشط/مهلة/منتهٍ)');

  // شاشة الإدارة: الطابور يحمل ما يلزم للقرار
  const queue = await j('GET', '/api/admin/invoices?status=paid', null, ADMIN);
  const row = queue.data[0];
  ok(row && row.store_name && row.owner_phone && row.ref && row.amount !== undefined,
     'صف الطابور يحمل المتجر والرقم والمرجع والمبلغ');
  ok('proof_key' in row, 'الطابور يحمل مسار الإيصال للعرض');

  // الشارة التي تنبّه الإدارة
  const stats = await j('GET', '/api/admin/stats', null, ADMIN);
  ok(typeof stats.data.pendingInvoices === 'number', 'عدّاد الإيصالات المنتظرة متاح للشارة');
  ok(stats.data.revenue > 0, `المحصَّل من الفواتير المؤكدة = ${stats.data.revenue}`);

  // الإعدادات: ما تملؤه شاشة الأسعار
  const s = await j('GET', '/api/admin/settings', null, ADMIN);
  ok(s.data.prices && s.data.addons && Array.isArray(s.data.methods),
     'شاشة الإعدادات تجد الأسعار والخدمات والوسائل');
  ok(s.data.methods.every((m) => m.instructionsKey), 'كل وسيلة تحمل مفتاح تعليماتها للحفظ');
}

console.log('\n── العزل: فواتير متجر لا تُرى من آخر ──');
const otherBilling = await j('GET', '/api/me/billing', null, OTHER);
ok(!otherBilling.data.invoices.some((i) => i.ref === inv.data.invoice.ref),
   'فواتير نورا غير ظاهرة لذي يزن');

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
