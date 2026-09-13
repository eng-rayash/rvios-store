// فجوات الدخول: العملاء · مناطق التوصيل · الدفع المحلي
//
// ما يستحق الفحص هنا ليس أن الصفوف تُحفَظ، بل الحالات التي
// تنكسر بصمت:
//   ١) متجر بلا مناطق يجب أن يعمل كما كان تماماً
//   ٢) رقم واحد يشتري مرتين = عميل واحد بطلبين لا عميلان
//   ٣) عميل متجر لا يُرى من متجر آخر أبداً
//   ٤) حذف منطقة لا يغيّر ما دفعه عميل في طلب مضى
//   ٥) الرقم نفسه بصيغتين مختلفتين = عميل واحد لا اثنان
import { toE164 } from '../server/countries.js';

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

async function login(phone) {
  const c = await j('POST', '/api/auth/request-code', { phone });
  const v = await j('POST', '/api/auth/verify', { phone, code: c.data.devCode });
  return v.cookie.split(';')[0];
}

// نعمل على «سيركل تك» لا «نورا»، وبتسجيل دخول واحد. حدّان مشتركان
// بين كل ملفات الفحص يجب مراعاتهما معاً:
//   · الطلبات: عشرة لكل (عنوان، متجر) خلال عشر دقائق —
//     وvariants.mjs يستهلك حصّة نورا قبل أن نصل إلى هنا.
//   · رموز التحقق: عشرون لكل عنوان في الساعة.
const SHOP = 'circletech';
const OWNER = await login('712334455');

// العميل يُخزَّن بمفتاح دولي موحّد مهما كتب رقمه محلياً
const CUST = toE164('770900001');

// منتج مضمون التوفّر لهذه الفحوص
for (let i = 0; i < 2; i++) {
  const cap = await j('GET', '/api/me/products', null, OWNER);
  if (cap.data.capacity.canAdd) break;
  await j('DELETE', `/api/me/products/${cap.data.products.at(-1).id}`, null, OWNER);
}
const made = await j('POST', '/api/me/products',
  { name: 'منتج فحص الدخول', price: 5000, qty: 50 }, OWNER);
const P = made.data.product;

console.log('── السقوط الآمن: متجر بلا مناطق يعمل كما كان ──');
const before = await j('GET', `/api/shop/${SHOP}`);
ok(Array.isArray(before.data.delivery.zones), 'المناطق مصفوفة (فارغة الآن)');
const fallbackFee = before.data.delivery.fee;

const plain = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل الفحص', phone: '770900001',
});
ok(plain.status === 201, 'طلب بلا منطقة نجح');
ok(plain.data?.delivery === fallbackFee, `طُبّق الرسم العام (${plain.data.delivery})`);
ok(plain.data?.payMethod === 'cod', 'الدفع الافتراضي عند الاستلام');
ok(plain.data?.payStatus === 'none', 'وحالته none لا await');

console.log('\n── المناطق: الرسم يتبع المنطقة لا المتجر ──');
const zoneA = await j('POST', '/api/me/zones', { name: 'صنعاء', fee: 1500 }, OWNER);
const zoneB = await j('POST', '/api/me/zones', { name: 'عدن', fee: 4000, freeOver: 90000 }, OWNER);
ok(zoneA.status === 201 && zoneB.status === 201, 'أُنشئت منطقتان');

const withZone = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل الفحص', phone: '770900001',
  zoneId: zoneB.data.zone.id,
});
ok(withZone.data.delivery === 4000, `رسم عدن ٤٠٠٠ (${withZone.data.delivery})`);
ok(withZone.data.zone === 'عدن', 'اسم المنطقة في الرد');

console.log('\n── مجاني فوق حدّ المنطقة ──');
const bigOrder = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 20 }], name: 'عميل الفحص', phone: '770900001',
  zoneId: zoneB.data.zone.id,
});
ok(bigOrder.data.subtotal === 100000, `المجموع ${bigOrder.data.subtotal}`);
ok(bigOrder.data.delivery === 0, 'التوصيل مجاني فوق ٩٠٬٠٠٠');

console.log('\n── منطقة متجر آخر مرفوضة ──');
const foreign = await j('POST', '/api/shop/yazan/orders', {
  lines: [{ id: 1, qty: 1 }], name: 'عميل', phone: '770900009',
  zoneId: zoneA.data.zone.id,          // منطقة سيركل تك على متجر يزن
});
ok(foreign.status === 400, `رُفضت منطقة متجر آخر (${foreign.status})`);

console.log('\n── العملاء: رقم واحد = عميل واحد ──');
const list = await j('GET', '/api/me/customers', null, OWNER);
const mine = list.data.customers.filter((c) => c.phone === CUST);
ok(mine.length === 1, `عميل واحد لا ${mine.length}`);
ok(mine[0].orders_count >= 3, `له ${mine[0].orders_count} طلبات`);
ok(mine[0].name === 'عميل الفحص', 'حُفظ اسمه');

console.log('\n── الاسم المحفوظ لا يُمحى بطلب بلا اسم ──');
await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: '', phone: '770900001',
});
const after = await j('GET', '/api/me/customers', null, OWNER);
const same = after.data.customers.find((c) => c.phone === CUST);
ok(same.name === 'عميل الفحص', 'بقي الاسم بعد طلب بلا اسم');

console.log('\n── الرقم نفسه بصيغة أخرى = العميل نفسه ──');
// بلا توحيد المفتاح يصير `0770900001` عميلاً ثانياً بـ«أول طلب»
// جديد، فينهار عدّ العملاء الذي يبني عليه التاجر قراراته
const beforeN = after.data.customers.length;
await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل الفحص', phone: '0770900001',
});
const merged = await j('GET', '/api/me/customers', null, OWNER);
ok(merged.data.customers.length === beforeN, `لم يُضف عميل ثانٍ (${merged.data.customers.length})`);
ok(merged.data.customers.filter((c) => c.phone === CUST).length === 1,
  'صفّ واحد للرقم بصيغتيه');

console.log('\n── العزل: عميل متجر لا يُرى من متجر آخر ──');
const OTHER = await j('GET', '/api/me/customers', null, OWNER);
ok(OTHER.data.customers.every((c) => c.phone !== toE164('777889900')),
  'عملاء متجر ذي يزن غير ظاهرين هنا');

console.log('\n── الدفع: تحويل يبدأ بانتظار الإيصال ──');
await j('PATCH', '/api/me/store', { payMethods: ['cod', 'wallet'], payNote: 'حوّل إلى الكريمي ١٢٣' }, OWNER);
const shop = await j('GET', `/api/shop/${SHOP}`);
ok(shop.data.payment.methods.length === 2, `طريقتان معلنتان (${shop.data.payment.methods.length})`);
ok(shop.data.payment.note.includes('الكريمي'), 'تعليمات التحويل ظاهرة');

const walletOrder = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل الفحص', phone: '770900001',
  payMethod: 'wallet',
});
ok(walletOrder.status === 201,
  `أُنشئ طلب المحفظة (${walletOrder.status}${walletOrder.data?.error ? ': ' + walletOrder.data.error : ''})`);
ok(walletOrder.data?.payMethod === 'wallet', 'طريقة الدفع محفوظة');
ok(walletOrder.data?.payStatus === 'await', 'الحالة await لا none');
ok((walletOrder.data?.payNote ?? '').includes('الكريمي'), 'التعليمات تصل مع الرد');

console.log('\n── طريقة غير معلنة تسقط إلى «عند الاستلام» ──');
const sneaky = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل الفحص', phone: '770900001',
  payMethod: 'bank',                   // لم يُعلنها التاجر
});
ok(sneaky.data?.payMethod === 'cod', 'سقطت إلى cod');

console.log('\n── تأكيد الدفع قرار التاجر ──');
const orders = await j('GET', '/api/me/orders', null, OWNER);
const target = orders.data.orders.find((o) => o.ref === walletOrder.data.ref);
ok(target.pay_status === 'await', 'الطلب بانتظار التحويل');

const confirmed = await j('PATCH', `/api/me/orders/${target.id}/payment`, { paid: true }, OWNER);
ok(confirmed.data.payStatus === 'paid', 'أكّده التاجر');

const rejected = await j('PATCH', `/api/me/orders/${target.id}/payment`, { paid: false }, OWNER);
ok(rejected.data.payStatus === 'await', 'الرفض يعيده إلى await لا إلى الصفر');

const codOrder = orders.data.orders.find((o) => o.ref === plain.data.ref);
const codPay = await j('PATCH', `/api/me/orders/${codOrder.id}/payment`, { paid: true }, OWNER);
ok(codPay.status === 400, 'طلب عند الاستلام لا يُؤكَّد دفعه');

console.log('\n── حذف منطقة لا يغيّر طلباً مضى ──');
await j('DELETE', `/api/me/zones/${zoneB.data.zone.id}`, null, OWNER);
const still = await j('GET', '/api/me/orders', null, OWNER);
const old = still.data.orders.find((o) => o.ref === withZone.data.ref);
ok(old.zone_name === 'عدن', 'اسم المنطقة باقٍ في الطلب القديم');
ok(old.delivery_fee === 4000, 'والرسم الذي دفعه باقٍ');

// تنظيف
await j('DELETE', `/api/me/zones/${zoneA.data.zone.id}`, null, OWNER);
await j('DELETE', `/api/me/products/${P.id}`, null, OWNER);
await j('PATCH', '/api/me/store', { payMethods: ['cod'], payNote: '' }, OWNER);

console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
process.exitCode = fail ? 1 : 0;
