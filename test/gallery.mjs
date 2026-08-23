import fs from 'node:fs';
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

const img = (n) => 'data:image/jpeg;base64,' + fs.readFileSync(`public/assets/img/p${n}.jpg`).toString('base64');

async function login(phone) {
  const c = await j('POST', '/api/auth/request-code', { phone });
  const v = await j('POST', '/api/auth/verify', { phone, code: c.data.devCode });
  return v.cookie.split(';')[0];
}

console.log('── باقة بلس: حتى ٤ صور ──');
const PLUS = await login('777000000');
const made = await j('POST', '/api/me/products',
  { name: 'اختبار المعرض', price: 5000, qty: 3, images: [img(1), img(2), img(3), img(4)] }, PLUS);
ok(made.status === 201, 'أُنشئ المنتج');
ok(made.data.product.images.length === 4, `حُفظت ٤ صور (${made.data.product.images.length})`);
ok(made.data.product.image === made.data.product.images[0], 'أول صورة صارت الغلاف');
ok(made.data.product.images.every(u => u.startsWith('/uploads/')), 'كلها ملفات لا data URI');

console.log('\n── تجاوز الحد يُقصّ في الخادم ──');
const over = await j('PATCH', `/api/me/products/${made.data.product.id}`,
  { images: [img(1), img(2), img(3), img(4), img(5), img(6)] }, PLUS);
ok(over.data.product.images.length === 4, `قُصّت ٦ صور إلى ٤ (${over.data.product.images.length})`);

console.log('\n── تغيير الغلاف بإعادة الترتيب ──');
const reordered = [...made.data.product.images].reverse();
const rc = await j('PATCH', `/api/me/products/${made.data.product.id}`, { images: reordered }, PLUS);
ok(rc.data.product.image === reordered[0], 'الغلاف تبع الترتيب الجديد');
ok(rc.data.product.images.length === 4, 'بقي العدد ٤ بلا تكرار');

console.log('\n── تقليص المعرض ──');
const shrunk = await j('PATCH', `/api/me/products/${made.data.product.id}`, { images: [img(9)] }, PLUS);
ok(shrunk.data.product.images.length === 1, 'صورة واحدة بعد الحذف');

console.log('\n── الباقة المجانية: صورة واحدة فقط ──');
const FREE = await login('733445566');

// مجموعات أخرى قد تكون ملأت هذا المتجر حتى حد الباقة،
// فنُفرغ خانة واحدة ليبقى هذا الفحص مستقلاً عن ترتيب التشغيل.
const freeList = await j('GET', '/api/me/products', null, FREE);
if (!freeList.data.capacity.canAdd) {
  await j('DELETE', `/api/me/products/${freeList.data.products.at(-1).id}`, null, FREE);
}

const freeProd = await j('POST', '/api/me/products',
  { name: 'منتج مجاني', price: 1000, qty: 1, images: [img(1), img(2), img(3)] }, FREE);
ok(freeProd.status === 201, 'أُنشئ المنتج');
ok(freeProd.data.product.images.length === 1, `صورة واحدة رغم إرسال ٣ (${freeProd.data.product.images.length})`);

console.log('\n── حد الصور معلن في الـ API ──');
const capPlus = await j('GET', '/api/me/products', null, PLUS);
ok(capPlus.data.capacity.imagesPerProduct === 4, `بلس = ${capPlus.data.capacity.imagesPerProduct}`);
const capFree = await j('GET', '/api/me/products', null, FREE);
ok(capFree.data.capacity.imagesPerProduct === 1, `مجانية = ${capFree.data.capacity.imagesPerProduct}`);

console.log('\n── العزل: معرض متجر لا يُرى من متجر آخر ──');
const cross = await j('GET', `/api/shop/nura-boutique/products/${made.data.product.id}`);
ok(cross.status === 404, 'منتج ذو يزن غير متاح عبر رابط نورا');

console.log('\n── حذف المنتج يحذف معرضه ──');
await j('DELETE', `/api/me/products/${made.data.product.id}`, null, PLUS);
const gone = await j('GET', `/api/shop/yazan/products/${made.data.product.id}`);
ok(gone.status === 404, 'المنتج ومعرضه اختفيا');
await j('DELETE', `/api/me/products/${freeProd.data.product.id}`, null, FREE);

console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
process.exitCode = fail ? 1 : 0;
