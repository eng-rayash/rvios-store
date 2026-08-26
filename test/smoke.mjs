import { finish } from './finish.mjs';
const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

async function j(method, path, body, cookie) {
  const r = await fetch(B + path, {
    method,
    headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const t = await r.text();
  let d = null; try { d = JSON.parse(t); } catch {}
  return { status: r.status, data: d, cookie: r.headers.getSetCookie?.().join('; ') ?? '' };
}

console.log('\n── واجهة المتجر العامة ──');
const shop = await j('GET', '/api/shop/' + 'yazan');
ok(shop.status === 200, 'جلب متجر سارة');
ok(shop.data?.products?.length === 9, `عدد المنتجات = ${shop.data?.products?.length}`);
ok(shop.data?.categories?.length === 4, `عدد التصنيفات = ${shop.data?.categories?.length}`);
ok(shop.data?.store?.verified === true, 'شارة التوثيق');
const lowStock = shop.data.products.find(p => p.stock === 'low');
ok(!!lowStock && /بقي/.test(lowStock.stockLabel), `مؤشر التوفّر الصادق: "${lowStock?.stockLabel}"`);
const gone = shop.data.products.find(p => p.stock === 'none');
ok(!!gone, 'منتج نافد يظهر بحالة none');

console.log('\n── منتج بعنوان مباشر ──');
const one = await j('GET', `/api/shop/yazan/products/${shop.data.products[0].id}`);
ok(one.status === 200, 'رابط منتج مفرد يعمل');

console.log('\n── تسجيل الطلب قبل واتساب (§٤.١) ──');
const order = await j('POST', `/api/shop/yazan/orders`, {
  lines: [{ id: shop.data.products[0].id, qty: 2 }, { id: shop.data.products[3].id, qty: 1 }],
  name: 'عميل اختبار', note: 'حدة',
});
ok(order.status === 201, 'أُنشئ الطلب');
ok(/^RS-[0-9A-Z]{5}$/.test(order.data?.ref ?? ''), `رقم مرجعي: ${order.data?.ref}`);
ok(order.data?.wa?.startsWith('https://wa.me/967777000000'), 'رابط واتساب مبني للتاجر');
ok(decodeURIComponent(order.data.wa).includes(order.data.ref), 'الرسالة تحمل الرقم المرجعي');
const expected = shop.data.products[0].price * 2 + shop.data.products[3].price;
ok(order.data?.total === expected, `الإجمالي محسوب في الخادم = ${order.data?.total}`);

console.log('\n── الأسعار تُقرأ من الخادم لا من العميل ──');
const cheat = await j('POST', `/api/shop/yazan/orders`, {
  lines: [{ id: shop.data.products[0].id, qty: 1, price: 1 }],
});
ok(cheat.data?.total === shop.data.products[0].price, 'تجاهل السعر القادم من المتصفح');

console.log('\n── متابعة الطلب برقمه ──');
const track = await j('GET', `/api/shop/yazan/orders/${order.data.ref}`);
ok(track.status === 200 && track.data.status === 'wait', 'الطلب مسجّل بحالة «قيد التأكيد»');

console.log('\n── العزل بين المتاجر (§٥.١) ──');
const nora = await j('GET', '/api/shop/' + 'nura-boutique');
ok(nora.data?.products?.length === 3, 'متجر نورا يعرض منتجاته وحدها');
const saraIds = new Set(shop.data.products.map(p => p.id));
ok(!nora.data.products.some(p => saraIds.has(p.id)), 'لا تداخل في المنتجات بين المتجرين');
const cross = await j('GET', `/api/shop/nura-boutique/products/${shop.data.products[0].id}`);
ok(cross.status === 404, 'منتج سارة غير قابل للجلب عبر رابط نورا (٤٠٤)');
const crossOrder = await j('POST', `/api/shop/nura-boutique/orders`, {
  lines: [{ id: shop.data.products[0].id, qty: 1 }],
});
ok(crossOrder.status === 400, 'رُفض طلب يحوي منتج متجر آخر');

console.log('\n── المتجر الموقوف ──');
const susp = await j('GET', '/api/shop/' + 'under-review');
ok(susp.status === 410, 'المتجر الموقوف لا يُخدم للعملاء');

console.log('\n── الإبلاغ (§٦.٢) ──');
const rep = await j('POST', `/api/shop/yazan/report`, { reason: 'اختبار' });
ok(rep.status === 201, 'قُبل البلاغ');

console.log('\n── الرابط: فحص التوفر (§٣.٢) ──');
const taken = await j('GET', '/api/slug/check?q=' + 'yazan');
ok(taken.data?.ok === false && taken.data?.taken === true, 'الرابط المحجوز يُرفض');
ok(!!taken.data?.suggestion, `يقترح بديلاً: ${taken.data?.suggestion}`);
const reserved = await j('GET', '/api/slug/check?q=admin');
ok(reserved.data?.ok === false, 'الرابط المحجوز للمنصة مرفوض');
const free = await j('GET', '/api/slug/check?q=' + encodeURIComponent('متجر الأمل'));
ok(free.data?.ok === true, `رابط متاح → ${free.data?.slug}`);

console.log('\n── المصادقة (§٦.١ OTP إلزامي) ──');
const noauth = await j('GET', '/api/me/overview');
ok(noauth.status === 401, 'لوحة التاجر محمية بدون جلسة');
const code = await j('POST', '/api/auth/request-code', { phone: '777000000' });
ok(code.status === 200 && !!code.data.devCode, 'صدر رمز تحقق');
ok(code.data.returning === undefined, 'الرد لا يكشف هل الرقم مسجّل (§٢.٣ منع التعداد)');
const badCode = await j('POST', '/api/auth/verify', { phone: '777000000', code: '000000' });
ok(badCode.status === 400, 'رُفض الرمز الخاطئ');
const good = await j('POST', '/api/auth/verify', { phone: '777000000', code: code.data.devCode });
ok(good.status === 200, 'قُبل الرمز الصحيح');
const SID = good.cookie.split(';')[0];
ok(/rvios_sid=/.test(SID), 'صدرت جلسة');

console.log('\n── لوحة التاجر ──');
const ov = await j('GET', '/api/me/overview', null, SID);
ok(ov.status === 200, 'نظرة عامة');
ok(ov.data.kpis.pending >= 3, `الطلبات المعلّقة أولاً = ${ov.data.kpis.pending}`);
ok(ov.data.chart.length === 7, 'رسم ٧ أيام');
ok(ov.data.capacity.max === 100, 'سعة باقة بلس = ١٠٠');

const prods = await j('GET', '/api/me/products', null, SID);
ok(prods.data.products.length === 9, 'منتجات التاجر');
ok(prods.data.products.every(p => p.store_id === ov.data.store.id), 'كل صف يخص متجر التاجر فقط');

console.log('\n── حد الباقة يُفرض في الخادم (§٢.٢) ──');
const nora2 = await j('POST', '/api/auth/request-code', { phone: '733445566' });
const nora3 = await j('POST', '/api/auth/verify', { phone: '733445566', code: nora2.data.devCode });
const NID = nora3.cookie.split(';')[0];
let added = 0, limitHit = false;
for (let i = 0; i < 25; i++) {
  const r = await j('POST', '/api/me/products', { name: `منتج ${i}`, price: 1000, qty: 1 }, NID);
  if (r.status === 201) added++;
  else if (r.data?.code === 'PLAN_LIMIT') { limitHit = true; break; }
}
ok(limitHit, `توقّف عند حد الباقة المجانية بعد ${added} إضافة (٣ موجودة + ١٢ = ١٥)`);
ok(added === 12, `أُضيف ١٢ بالضبط ليصل المجموع إلى ١٥`);

console.log('\n── التصنيفات الفرعية ميزة مدفوعة ──');
const cats = await j('GET', '/api/me/categories', null, NID);
const sub = await j('POST', '/api/me/categories', { name: 'فرعي', parentId: cats.data[0].id }, NID);
ok(sub.data?.code === 'PLAN_LIMIT', 'رُفض التصنيف الفرعي على الباقة المجانية');

console.log('\n── تعديل متجر آخر مستحيل ──');
const steal = await j('PATCH', `/api/me/products/${shop.data.products[0].id}`, { price: 1 }, NID);
ok(steal.status === 404, 'نورا لا تستطيع تعديل منتج سارة (٤٠٤ لا ٢٠٠)');

console.log('\n── دورة حياة الطلب ──');
const myOrders = await j('GET', '/api/me/orders', null, SID);
const waiting = myOrders.data.orders.find(o => o.status === 'wait');
const conf = await j('PATCH', `/api/me/orders/${waiting.id}`, { status: 'ok' }, SID);
ok(conf.status === 200 && conf.data.order.status === 'ok', 'قيد التأكيد → مؤكد');
const done = await j('PATCH', `/api/me/orders/${waiting.id}`, { status: 'done' }, SID);
ok(done.data.order.status === 'done', 'مؤكد → مكتمل');
const illegal = await j('PATCH', `/api/me/orders/${waiting.id}`, { status: 'wait' }, SID);
ok(illegal.status === 409, 'رُفض انتقال غير مسموح (مكتمل → قيد التأكيد)');

console.log('\n── أمان رمز التحقق (§٢) ──');
{
  const { db } = await import('../src/db.js');
  await j('POST', '/api/auth/request-code', { phone: '770333222' });
  const stored = await db.prepare('SELECT code FROM otps WHERE phone = ?').get('770333222');
  ok(/^[a-f0-9]{64}$/.test(stored.code), 'الرمز مخزَّن كتجزئة HMAC لا خاماً (§٢.١)');

  const a = await j('POST', '/api/auth/verify', { phone: '779999999', code: '123456' });
  const b = await j('POST', '/api/auth/verify', { phone: '770333222', code: '000000' });
  ok(a.data.error === b.data.error, 'رسالة فشل موحّدة لكل الحالات (§٢.٤)');

  const again = await j('POST', '/api/auth/request-code', { phone: '770333222' });
  ok(again.status === 429, 'مهلة إعادة الإرسال مطبَّقة (§٢.٢)');
}

console.log('\n── سجل الروابط القديمة (§٣.٣) ──');
{
  const before = await j('GET', '/api/me/store', null, SID);
  const oldSlug = before.data.store.slug;
  await j('PATCH', '/api/me/store', { slug: 'yazan-store-v2' }, SID);

  const red = await fetch(B + '/' + oldSlug, { redirect: 'manual' });
  ok(red.status === 301, `الرابط القديم يحوّل ٣٠١ (${red.status})`);
  ok(red.headers.get('location') === '/yazan-store-v2', `يشير إلى ${red.headers.get('location')}`);

  const guard = await j('GET', `/api/slug/check?q=${oldSlug}`);
  ok(guard.data.ok === false, 'لا يستطيع تاجر آخر أخذ الرابط المتقاعد');

  await j('PATCH', '/api/me/store', { slug: oldSlug }, SID);   // نعيده لبقية الفحوص
}

console.log('\n── حجز المخزون وقت الطلب (يمنع البيع المزدوج) ──');
const scarce = shop.data.products.find(p => p.qty > 0 && p.qty <= 5);
const before = scarce.qty;
const take = await j('POST', '/api/shop/yazan/orders', { lines: [{ id: scarce.id, qty: before }] });
ok(take.status === 201, `طُلبت كامل كمية «${scarce.name}» (${before})`);
const after = await j('GET', '/api/shop/yazan/products/' + scarce.id);
ok(after.data.product.qty === 0, 'نزل المخزون إلى صفر فور الطلب لا عند التأكيد');
const second = await j('POST', '/api/shop/yazan/orders', { lines: [{ id: scarce.id, qty: 1 }] });
ok(second.status === 409, 'رُفض طلب ثانٍ لنفس القطعة — لا بيع مزدوج');
const over = await j('POST', '/api/shop/yazan/orders', { lines: [{ id: shop.data.products[0].id, qty: 9999 }] });
ok(over.status === 409, 'رُفضت كمية تفوق المخزون');

console.log('\n── الإلغاء يعيد المخزون ──');
const myO = await j('GET', '/api/me/orders', null, SID);
const toCancel = myO.data.orders.find(o => o.ref === take.data.ref);
await j('PATCH', `/api/me/orders/${toCancel.id}`, { status: 'off' }, SID);
const restored = await j('GET', '/api/shop/yazan/products/' + scarce.id);
ok(restored.data.product.qty === before, `عاد المخزون إلى ${before} بعد الإلغاء`);

console.log('\n── رسوم التوصيل ──');
await j('PATCH', '/api/me/store', { deliveryFee: 2000, deliveryFreeOver: 50000 }, SID);
const cheap = await j('POST', '/api/shop/yazan/orders', { lines: [{ id: shop.data.products[3].id, qty: 1 }] });
ok(cheap.data.delivery === 2000, `أُضيفت رسوم التوصيل (${cheap.data.delivery})`);
ok(cheap.data.total === cheap.data.subtotal + 2000, 'الإجمالي = المجموع + التوصيل');
const big = await j('POST', '/api/shop/yazan/orders', { lines: [{ id: shop.data.products[6].id, qty: 1 }] });
ok(big.data.subtotal >= 50000 && big.data.delivery === 0, 'توصيل مجاني فوق الحد');
ok(decodeURIComponent(cheap.data.wa).includes('التوصيل'), 'رسالة واتساب تفصّل التوصيل');
await j('PATCH', '/api/me/store', { deliveryFee: 0, deliveryFreeOver: 0 }, SID);

console.log('\n── بحث وترقيم في الخادم (§٥.٣) ──');
const paged = await j('GET', '/api/shop/yazan/products?per=4&page=1');
ok(paged.data.products.length === 4, 'الصفحة الأولى ٤ منتجات فقط');
ok(paged.data.pages >= 3, `عدد الصفحات = ${paged.data.pages}`);
ok(paged.data.hasMore === true, 'يوجد المزيد');
const searched = await j('GET', '/api/shop/yazan/products?q=' + encodeURIComponent('عود'));
ok(searched.data.products.length >= 1 && searched.data.products.every(p => /عود/.test(p.name + p.summary + p.description)), 'البحث في الخادم يعمل');
const sorted = await j('GET', '/api/shop/yazan/products?sort=low&per=48');
const prices = sorted.data.products.map(p => p.price);
ok(prices.every((v, i) => i === 0 || prices[i - 1] <= v), 'الترتيب تصاعدياً في الخادم');

console.log('\n── الإدارة (§٣.٥) ──');
const noAdmin = await j('GET', '/api/admin/stats');
ok(noAdmin.status === 401, 'الإدارة محمية');
const wrong = await j('POST', '/api/admin/login', { pass: 'خطأ' });
ok(wrong.status === 401, 'كلمة مرور خاطئة مرفوضة');
const adm = await j('POST', '/api/admin/login', { pass: 'rvios-admin' });
const AID = adm.cookie.split(';')[0];
ok(adm.status === 200, 'دخول الإدارة');
const stats = await j('GET', '/api/admin/stats', null, AID);
// بذرة seed.js: يزن (بلس) · نورا (مجانية) · أطلس (برو) · متجر موقوف
ok(stats.data.stores === 4, `عدد المتاجر = ${stats.data.stores}`);
ok(typeof stats.data.activationRate === 'number', `معدل التفعيل = ${stats.data.activationRate}%`);
ok(stats.data.openReports >= 2, `بلاغات مفتوحة = ${stats.data.openReports}`);
const reports = await j('GET', '/api/admin/reports', null, AID);
ok(reports.data.length >= 2, 'قائمة البلاغات');
const reqs = await j('GET', '/api/admin/requests', null, AID);
const verifyReq = reqs.data.find(r => r.kind === 'verify');
ok(!!verifyReq, 'طلب توثيق في الطابور');
await j('PATCH', `/api/admin/requests/${verifyReq.id}`, { status: 'done' }, AID);
const noraShop = await j('GET', '/api/shop/' + 'nura-boutique');
ok(noraShop.data.store.verified === true, 'قبول طلب التوثيق منح الشارة فعلياً');

console.log('\n── التوجيه بالمسار (§٥.٢) ──');
const page = await fetch(B + '/' + 'yazan');
ok(page.status === 200 && (await page.text()).includes('store-page.js'), 'رابط المتجر يخدم صفحة المتجر');
const nf = await fetch(B + '/' + 'no-such-store');
ok(nf.status === 404, 'رابط غير موجود يعطي ٤٠٤');

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
