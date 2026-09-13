// خيارات المنتج (المقاسات والألوان)
//
// ما يستحق الفحص هنا ليس أن الصفوف تُحفَظ، بل ثلاثة ثوابت
// يسهل كسرها بصمت:
//   ١) products.qty يساوي دائماً مجموع كميات الخيارات
//   ٢) المخزون يُخصم من الخيار المطلوب وحده لا من أخيه
//   ٣) الإلغاء يعيد الكمية إلى الخيار نفسه
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

// نعمل على «نورا» لا «ذو يزن»، ولا نسجّل الدخول إلا مرة واحدة:
//   · حدّ الطلبات عشرة لكل (عنوان، متجر) خلال عشر دقائق،
//     ومجموعة smoke تستهلك حصّة متجر ذي يزن قبل أن يصل
//     التسلسل إلى هنا.
//   · حدّ رموز التحقق عشرون لكل عنوان في الساعة، مشتركٌ بين
//     كل ملفات الفحص — فكل تسجيل دخول إضافي هنا يسرق حصّة
//     ملفٍ لاحق ويُفشله لسبب لا علاقة له به.
// ونورا على باقة ذات حدّ منتهٍ، فيظهر قصّ الخيارات فعلياً.
const SHOP = 'nura-boutique';
const OWNER = await login('733445566');  // نورا

// مجموعات سابقة قد تكون ملأت هذا المتجر حتى حدّ باقته،
// فنُفرغ خانتين ليبقى هذا الملف مستقلاً عن ترتيب التشغيل.
for (let i = 0; i < 2; i++) {
  const cap = await j('GET', '/api/me/products', null, OWNER);
  if (cap.data.capacity.canAdd) break;
  await j('DELETE', `/api/me/products/${cap.data.products.at(-1).id}`, null, OWNER);
}

console.log('── إنشاء منتج بمحورين ──');
const made = await j('POST', '/api/me/products', {
  name: 'قميص اختبار', price: 8000, qty: 999,
  opt1Name: 'المقاس', opt2Name: 'اللون',
  variants: [
    { v1: 'M', v2: 'أسود', qty: 4 },
    { v1: 'M', v2: 'أبيض', qty: 2, price: 9000 },
    { v1: 'L', v2: 'أسود', qty: 0 },
  ],
}, OWNER);
ok(made.status === 201, 'أُنشئ المنتج');
const P = made.data.product;
ok(P.has_variants === 1, 'has_variants = 1');
ok(P.variants.length === 3, `ثلاثة خيارات (${P.variants.length})`);
ok(P.qty === 6, `qty صار مجموع الخيارات = ${P.qty} (٤+٢+٠)`);
ok(P.opt1_name === 'المقاس' && P.opt2_name === 'اللون', 'اسما المحورين محفوظان');

console.log('\n── qty القادم من الواجهة لا يدوس المجموع ──');
ok(P.qty !== 999, 'تُجوهِل الرقم ٩٩٩ لصالح المجموع المحسوب');

console.log('\n── تركيبة مكرّرة تُسقَط بلا رفض الحفظ كله ──');
const dup = await j('PATCH', `/api/me/products/${P.id}`, {
  variants: [
    { v1: 'M', v2: 'أسود', qty: 4 },
    { v1: 'M', v2: 'أسود', qty: 7 },
    { v1: 'L', v2: 'أسود', qty: 1 },
  ],
}, OWNER);
ok(dup.data.product.variants.length === 2, `بقي خياران لا ثلاثة (${dup.data.product.variants.length})`);
ok(dup.data.product.qty === 5, `المجموع = ${dup.data.product.qty} (٤+١)`);

// نعيد الشكل الأصلي لبقية الفحوص
await j('PATCH', `/api/me/products/${P.id}`, {
  variants: [
    { v1: 'M', v2: 'أسود', qty: 4 },
    { v1: 'M', v2: 'أبيض', qty: 2, price: 9000 },
    { v1: 'L', v2: 'أسود', qty: 0 },
  ],
}, OWNER);

console.log('\n── واجهة المتجر تعرض المحاور والخيارات ──');
const pub = await j('GET', `/api/shop/${SHOP}/products/${P.id}`);
ok(pub.status === 200, 'المنتج متاح للعميل');
ok(pub.data.product.hasVariants === true, 'hasVariants ظاهر للواجهة');
ok(pub.data.product.axes?.length === 2, `محوران (${pub.data.product.axes?.length})`);
ok(pub.data.product.axes?.[0]?.values.join(',') === 'M,L', 'قيم المقاس بلا تكرار: M,L');
const vBlack = pub.data.product.variants.find((v) => v.v1 === 'M' && v.v2 === 'أسود');
const vWhite = pub.data.product.variants.find((v) => v.v1 === 'M' && v.v2 === 'أبيض');
const vOut   = pub.data.product.variants.find((v) => v.v1 === 'L');
ok(vBlack.price === 8000, 'خيار بلا سعر خاص يرث سعر المنتج (٨٠٠٠)');
ok(vWhite.price === 9000, 'خيار بسعر خاص يحتفظ به (٩٠٠٠)');
ok(vOut.inStock === false, 'الخيار النافد معلَّم inStock=false');

console.log('\n── الشبكة لا تحمل الخيارات (استعلام لكل بطاقة) ──');
const list = await j('GET', `/api/shop/${SHOP}/products`);
const inGrid = list.data.products.find((x) => x.id === P.id);
ok(inGrid.hasVariants === true, 'البطاقة تعرف أن للمنتج خيارات');
ok(inGrid.variants === undefined, 'ولا تحمل مصفوفة الخيارات');

console.log('\n── الطلب: بلا اختيار يُرفض ──');
const noPick = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل', phone: '770000001',
});
ok(noPick.status === 400, `رُفض الطلب بلا خيار (${noPick.status})`);

console.log('\n── الطلب: خيار نافد يُرفض ──');
const outOfStock = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, variantId: vOut.id, qty: 1 }], name: 'عميل', phone: '770000001',
});
ok(outOfStock.status === 409, `رُفض الخيار النافد (${outOfStock.status})`);

console.log('\n── الطلب: يُخصم من الخيار المطلوب وحده ──');
const order = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, variantId: vBlack.id, qty: 3 }], name: 'عميل', phone: '770000001',
});
ok(order.status === 201, 'أُنشئ الطلب');
// subtotal لا total: الإجمالي يحمل رسم التوصيل إن وُجد،
// والمفحوص هنا سعر الخيار لا حساب التوصيل.
ok(order.data.subtotal === 8000 * 3, `السعر من الخيار = ${order.data.subtotal}`);

const after = await j('GET', `/api/shop/${SHOP}/products/${P.id}`);
const aBlack = after.data.product.variants.find((v) => v.id === vBlack.id);
const aWhite = after.data.product.variants.find((v) => v.id === vWhite.id);
ok(aBlack.qty === 1, `الأسود نزل إلى ${aBlack.qty} (٤−٣)`);
ok(aWhite.qty === 2, `الأبيض لم يُمسّ (${aWhite.qty})`);
ok(after.data.product.qty === 3, `مجموع المنتج تتبّع الخصم = ${after.data.product.qty} (١+٢+٠)`);

console.log('\n── سعر الخيار يُقرأ من القاعدة لا من المتصفح ──');
const cheat = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, variantId: vWhite.id, qty: 1, price: 1 }], name: 'عميل', phone: '770000001',
});
ok(cheat.data.subtotal === 9000, `تُجوهِل السعر المرسل: ${cheat.data.subtotal}`);

console.log('\n── الإلغاء يعيد الكمية إلى الخيار نفسه ──');
const mine = await j('GET', '/api/me/orders', null, OWNER);
const target = mine.data.orders.find((o) => o.ref === order.data.ref);
await j('PATCH', `/api/me/orders/${target.id}`, { status: 'off' }, OWNER);
const back = await j('GET', `/api/shop/${SHOP}/products/${P.id}`);
const bBlack = back.data.product.variants.find((v) => v.id === vBlack.id);
ok(bBlack.qty === 4, `عاد الأسود إلى ${bBlack.qty}`);
ok(back.data.product.qty === 5, `والمجموع تتبّعه = ${back.data.product.qty} (٤+١+٠)`);

console.log('\n── حدّ الباقة يُفرض في الخادم ──');
// الباقات تتغيّر بفحوص سابقة في التسلسل، فنقرأ الحدّ المعلن
// ونفحص السلوك نسبةً إليه بدل تثبيت رقم باقة بعينها.
const capacity = await j('GET', '/api/me/products', null, OWNER);
const max = capacity.data.capacity.variantsPerProduct;   // null = بلا حدّ
ok(max === null || max > 0, `الحدّ معلن في الـ API: ${max ?? 'بلا حدّ'}`);

const want = (max ?? 20) + 4;
const cap2 = await j('GET', '/api/me/products', null, OWNER);
if (!cap2.data.capacity.canAdd) {
  await j('DELETE', `/api/me/products/${cap2.data.products.at(-1).id}`, null, OWNER);
}
const capped = await j('POST', '/api/me/products', {
  name: 'فحص حدّ الخيارات', price: 1000, opt1Name: 'المقاس',
  variants: Array.from({ length: want }, (_, i) => ({ v1: `م${i + 1}`, qty: 1 })),
}, OWNER);
const kept = capped.data.product?.variants.length ?? -1;
ok(max === null ? kept === want : kept === max,
  max === null ? `بلا حدّ: حُفظت ${kept} من ${want}` : `قُصّت ${want} خياراً إلى ${max} (${kept})`);
ok(capped.data.product?.qty === kept, `المجموع تبع القصّ = ${capped.data.product?.qty}`);
await j('DELETE', `/api/me/products/${capped.data.product.id}`, null, OWNER);

console.log('\n── إلغاء الخيارات يعيد qty مصدراً للحقيقة ──');
const off = await j('PATCH', `/api/me/products/${P.id}`, { variants: [] }, OWNER);
ok(off.data.product.has_variants === 0, 'has_variants = 0');
ok(off.data.product.variants.length === 0, 'لا خيارات');
const plain = await j('POST', `/api/shop/${SHOP}/orders`, {
  lines: [{ id: P.id, qty: 1 }], name: 'عميل', phone: '770000001',
});
ok(plain.status === 201, 'صار المنتج يُطلب بلا اختيار');

console.log('\n── العزل: خيار متجر لا يُطلب من متجر آخر ──');
const cross = await j('GET', `/api/shop/yazan/products/${P.id}`);
ok(cross.status === 404, 'المنتج غير مرئي عبر رابط متجر آخر');

// تنظيف
await j('DELETE', `/api/me/products/${P.id}`, null, OWNER);


console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
process.exitCode = fail ? 1 : 0;
