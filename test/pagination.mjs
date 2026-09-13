// ═══════════════════════════════════════════════════════════
//  اختبار ترقيم الطلبات
//  الحدّ الثابت السابق (٢٠٠) كان يُخفي السجل الأقدم نهائياً.
//  نُثبت هنا أن كل طلب قابل للوصول مهما كثرت الطلبات.
// ═══════════════════════════════════════════════════════════
import { finish } from './finish.mjs';

import { BASE as B } from './base.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

/**
 * جلسة مباشرة بدل تدفّق رمز التحقق.
 * حدّ المعدل يسمح بخمسة رموز في الساعة لكل رقم (§٢.٢) — وهو
 * حدّ نريد بقاءه. المرور به هنا يجعل هذه المجموعة تفشل لمجرّد
 * أنها تلي مجموعة أخرى استعملت الرقم نفسه.
 */
const { db: _db } = await import('../server/db.js');
const { createSession, SESSION_COOKIE } = await import('../server/auth.js');

const merchant = await _db.prepare(
  "SELECT m.* FROM merchants m JOIN stores s ON s.merchant_id = m.id WHERE s.slug = 'yazan'",
).get();

const token = merchant ? await createSession(merchant.id) : '';
const cookie = token ? `${SESSION_COOKIE}=${encodeURIComponent(token)}` : '';

const req = async (path, init = {}) => fetch(B + path, {
  ...init,
  headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
});

ok(!!cookie, 'جلسة التاجر');

// ── حالة البداية ─────────────────────────────────────────
const first = await (await req('/api/me/orders')).json();
const startTotal = first.total;
ok(typeof first.total === 'number', 'الرد يذكر الإجمالي');
ok(typeof first.pages === 'number', 'الرد يذكر عدد الصفحات');
ok(first.page === 1, 'الصفحة الافتراضية هي الأولى');
ok(first.perPage === 50, 'خمسون طلباً في الصفحة');

// ── إنشاء حجم حقيقي يتجاوز صفحة واحدة ────────────────────
//  ندخل من طبقة النموذج لا عبر HTTP: حدّ المعدل يسمح بعشرة
//  طلبات كل عشر دقائق لكل عنوان — وهو حدّ سليم نريد بقاءه.
console.log('\n── إنشاء ١٣٠ طلباً ──');
const db = _db;
const { placeOrder } = await import('../server/orders.js');
const { scope } = await import('../server/tenancy.js');

const yazan = await db.prepare("SELECT * FROM stores WHERE slug='yazan'").get();
const nura  = await db.prepare("SELECT * FROM stores WHERE slug='nura-boutique'").get();
ok(!!yazan, 'وُجد متجر ذي يزن');

const pick = async (storeId) => (await scope(storeId).all('products', { live: 1 }, { limit: 1 }))[0];
const prod = await pick(yazan.id);
ok(!!prod, 'وُجد منتج للطلب عليه');

// مخزون وافر: نفاد المخزون سيوقف الإنشاء قبل بلوغ العدد
await db.prepare('UPDATE products SET qty = 9999 WHERE id = ?').run(prod.id);

const NEED = 130;
let made = 0;
for (let i = 0; i < NEED; i++) {
  try {
    await placeOrder(yazan.id, yazan, {
      lines: [{ id: prod.id, qty: 1 }],
      name: `عميل اختبار ${i}`,
      phone: '77' + String(7000000 + i).slice(-7),
      address: 'صنعاء', note: '',
    });
    made++;
  } catch (err) {
    if (i === 0) console.log('    أول فشل:', err.message);
  }
}
ok(made > 100, `أُنشئ ${made} طلباً`);

// طلب واحد في متجر نورا — علامة تسرّب نبحث عنها لاحقاً
let nuraRef = null;
if (nura) {
  const np = await pick(nura.id);
  if (np) {
    await db.prepare('UPDATE products SET qty = 99 WHERE id = ?').run(np.id);
    try {
      nuraRef = (await placeOrder(nura.id, nura, {
        lines: [{ id: np.id, qty: 1 }],
        name: 'عميل نورا', phone: '733999888', address: 'تعز', note: '',
      })).ref;
    } catch { /* لا يمنع بقية الاختبار */ }
  }
}

// ── الترقيم ──────────────────────────────────────────────
console.log('\n── الترقيم ──');
const p1 = await (await req('/api/me/orders?page=1')).json();
ok(p1.total >= startTotal + made, `الإجمالي يعكس كل الطلبات (${p1.total})`);
ok(p1.pages >= 3, `أكثر من صفحتين (${p1.pages})`);
ok(p1.orders.length === 50, 'الصفحة الأولى ٥٠ طلباً');

const p2 = await (await req('/api/me/orders?page=2')).json();
ok(p2.orders.length === 50, 'الصفحة الثانية ٥٠ طلباً');
ok(p2.page === 2, 'رقم الصفحة صحيح');

const ids1 = new Set(p1.orders.map((o) => o.id));
const ids2 = new Set(p2.orders.map((o) => o.id));
ok([...ids2].every((id) => !ids1.has(id)), 'لا تكرار بين الصفحتين');

// ── الطلب الأقدم — ما كان يضيع سابقاً ────────────────────
console.log('\n── الوصول إلى الأقدم ──');
const last = await (await req(`/api/me/orders?page=${p1.pages}`)).json();
ok(last.orders.length > 0, 'الصفحة الأخيرة تحوي طلبات');

const seen = new Set();
for (let pg = 1; pg <= p1.pages; pg++) {
  const d = await (await req(`/api/me/orders?page=${pg}`)).json();
  for (const o of d.orders) seen.add(o.id);
}
ok(seen.size === p1.total,
  `كل طلب قابل للوصول عبر الصفحات (${seen.size}/${p1.total}) — لا سجل ضائع`);

// ── حدود الصفحة ──────────────────────────────────────────
console.log('\n── حدود ──');
const huge = await (await req('/api/me/orders?page=9999')).json();
ok(huge.page === huge.pages, 'صفحة خارج المدى تُقصَر على الأخيرة');
ok(huge.orders.length > 0, 'ولا تعيد قائمة فارغة');

const zero = await (await req('/api/me/orders?page=0')).json();
ok(zero.page === 1, 'الصفحة صفر تُقصَر على الأولى');

const neg = await (await req('/api/me/orders?page=-5')).json();
ok(neg.page === 1, 'الصفحة السالبة تُقصَر على الأولى');

const junk = await (await req('/api/me/orders?page=xyz')).json();
ok(junk.page === 1, 'قيمة غير رقمية تُعامل كالأولى');

// ── التصفية مع الترقيم ───────────────────────────────────
console.log('\n── التصفية على الخادم ──');
const waiting = await (await req('/api/me/orders?status=wait')).json();
ok(waiting.orders.every((o) => o.status === 'wait'), 'كل النتائج بالحالة المطلوبة');
ok(waiting.total === waiting.counts.wait,
  'إجمالي المُصفّى يطابق عدّاد التبويب — لا رقم يناقض الآخر');

const bogus = await (await req('/api/me/orders?status=لا-يوجد')).json();
ok(bogus.total === p1.total, 'حالة غير معروفة تُتجاهَل ولا تُفرغ القائمة');

// ── العزل ما يزال قائماً تحت الترقيم ─────────────────────
console.log('\n── العزل ──');
{
  // طلب متجر لا يملكه التاجر يجب ألّا يُعيد بيانات ذلك المتجر أبداً.
  // (السلوك الحالي: الرجوع إلى متجر التاجر نفسه — آمن وليس تسرّباً.)
  const r = await fetch(`${B}/api/me/orders?page=1`, {
    headers: { cookie, 'x-store': 'nura-boutique' },
  });
  const d = r.ok ? await r.json() : { orders: [] };
  ok(!nuraRef || !d.orders.some((o) => o.ref === nuraRef),
    'طلب متجر آخر لا يظهر مهما طُلب المتجر صراحةً');

  // وكل صفحة من صفحات يزن تخصّ يزن وحده
  let leaked = false;
  for (let pg = 1; pg <= Math.min(p1.pages, 4); pg++) {
    const pd = await (await req(`/api/me/orders?page=${pg}`)).json();
    if (nuraRef && pd.orders.some((o) => o.ref === nuraRef)) leaked = true;
  }
  ok(!leaked, 'لا تسرّب عبر أي صفحة');
}

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
