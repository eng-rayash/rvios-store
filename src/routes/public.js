// ═══════════════════════════════════════════════════════════
//  واجهة المتجر العامة (§٣.٤)
//  الجمهور: العميل النهائي القادم من رابط مشارَك.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now, today } from '../db.js';
import { config } from '../config.js';

/** ملح البصمة — عشوائي لكل تشغيل ما لم يُضبط، فلا يمكن ربط الزوّار عبر الزمن */
const VISIT_SALT = config.visitSalt;
import { scope } from '../tenancy.js';
import { json, readBody, bad, notFound, clean, toInt, rateLimit, clientIp } from '../http.js';
import { placeOrder, withItems, waLink, waAsk, deliveryFor } from '../orders.js';
import { publicStore } from './merchant.js';
import { notifyNewOrder } from '../notify.js';
import { galleryOf } from '../uploads.js';
import { planOf } from '../plans.js';

/** يجلب متجراً نشطاً بالرابط، أو يرمي ٤٠٤ */
export async function storeBySlug(slug) {
  const s = await db.prepare('SELECT * FROM stores WHERE slug = ?').get(slug);
  if (!s) notFound('لا يوجد متجر بهذا الرابط');
  if (s.status === 'suspended') {
    const e = new Error('هذا المتجر موقوف مؤقتاً'); e.status = 410; throw e;
  }
  return s;
}

function shape(store, p, { gallery = false } = {}) {
  return {
    id: p.id, name: p.name, summary: p.summary, description: p.description,
    variant: p.variant, price: p.price, oldPrice: p.old_price,
    qty: p.qty, image: p.image, categoryId: p.category_id,
    // المعرض يُجلب عند الحاجة فقط — الشبكة تكتفي بالغلاف
    ...(gallery ? { images: galleryOf(scope(store.id), p) } : {}),
    // §٣.٤ — مؤشر توفّر صادق بدل نجوم تقييم غير حقيقية
    stock: p.qty <= 0 ? 'none' : p.qty <= 5 ? 'low' : 'ok',
    stockLabel: p.qty <= 0 ? 'نفد المخزون'
      : p.qty <= 5 ? `بقي ${p.qty.toLocaleString('ar-EG')} فقط`
      : 'متوفر',
    wa: waAsk(store, p),
    url: `/${store.slug}?p=${p.id}`,
  };
}

const SORTS = {
  new:  'sort, id DESC',
  low:  'price ASC, id DESC',
  high: 'price DESC, id DESC',
  // COLLATE NOCASE لهجة SQLite؛ LOWER() المكافئ المحمول
  name: 'LOWER(name) ASC',
};

/**
 * بحث وفلترة وترقيم في الخادم.
 * كل جملة تمرّ عبر scope.raw الذي يرفض SQL بلا store_id (§٥.١).
 */
async function queryProducts(store, query) {
  const s = scope(store.id);
  const page = Math.max(1, toInt(query.get('page'), 1));
  const per = Math.min(48, Math.max(4, toInt(query.get('per'), 12)));

  const where = ['store_id = ?', 'live = 1'];
  const params = [store.id];

  // §٥.٥ — عند انتهاء الاشتراك يُخفى ما يتجاوز حد الباقة، ولا يُحذف.
  // الأقدم يبقى ظاهراً، فلا يفاجأ العميل باختفاء المتجر كله.
  const limit = planOf(store).products;
  if (limit !== Infinity) {
    where.push(`id IN (SELECT id FROM products WHERE store_id = ? AND live = 1
                       ORDER BY created_at, id LIMIT ${Number(limit)})`);
    params.push(store.id);
  }

  const cat = toInt(query.get('cat'), 0);
  if (cat) { where.push('category_id = ?'); params.push(cat); }

  const q = clean(query.get('q'), 60);
  if (q) {
    // ILIKE لا LIKE: الأخيرة حسّاسة لحالة الأحرف في Postgres
    where.push('(name ILIKE ? OR summary ILIKE ? OR description ILIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  if (query.get('stock') === '1') where.push('qty > 0');
  if (query.get('sale') === '1')  where.push('old_price IS NOT NULL AND old_price > price');

  const min = toInt(query.get('min'), 0);
  const max = toInt(query.get('max'), 0);
  if (min) { where.push('price >= ?'); params.push(min); }
  if (max) { where.push('price <= ?'); params.push(max); }

  const clause = where.join(' AND ');
  const order = SORTS[query.get('sort')] ?? SORTS.new;

  const total = await s.raw(`SELECT COUNT(*) n FROM products WHERE ${clause}`, params)[0].n;
  const rows = await s.raw(
    `SELECT * FROM products WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, per, (page - 1) * per],
  );

  return {
    products: rows.map((p) => shape(store, p)),
    total,
    page,
    per,
    pages: Math.max(1, Math.ceil(total / per)),
    hasMore: page * per < total,
  };
}

export default async function register(r) {

  // ── بيانات المتجر ─────────────────────────────────────
  //  §٥.٣ — لا نُرسل كتالوجاً كاملاً على إنترنت بطيء:
  //  صفحة واحدة فقط، والبحث والفلترة يجريان في الخادم.
  r.get('/api/shop/:slug', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    const s = scope(store.id);

    const cats = await s.all('categories', {}, { order: 'sort, id' });
    const counts = Object.fromEntries(await Promise.all(
      cats.map(async (c) => [c.id, await s.count('products', { category_id: c.id, live: 1 })]),
    ));

    json(res, {
      store: publicStore(store),
      delivery: {
        fee: store.delivery_fee ?? 0,
        freeOver: store.delivery_free_over ?? 0,
        note: store.delivery_note ?? '',
      },
      categories: cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id, count: counts[c.id] ?? 0 })),
      ...queryProducts(store, req.query),
    });
  });

  // ── صفحة منتجات إضافية / بحث ──────────────────────────
  r.get('/api/shop/:slug/products', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    json(res, queryProducts(store, req.query));
  });

  // ── منتج واحد — رابط قابل للمشاركة ────────────────────
  r.get('/api/shop/:slug/products/:id', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    const p = await scope(store.id).get('products', { id: toInt(req.params.id), live: 1 });
    if (!p) notFound('المنتج غير موجود');
    json(res, { store: publicStore(store), product: shape(store, p, { gallery: true }) });
  });

  // ── تسجيل زيارة (§١٠ — قياس) ──────────────────────────
  //  زوّار فريدون يومياً: بصمة مجزّأة تمنع تضخيم الرقم بكل
  //  تحديث للصفحة، بلا تخزين أي بيانات تعريفية.
  r.post('/api/shop/:slug/visit', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    const day = today();

    const mark = crypto.createHash('sha256')
      .update(`${store.id}|${day}|${clientIp(req)}|${req.headers['user-agent'] ?? ''}|${VISIT_SALT}`)
      .digest('hex').slice(0, 32);

    const seen = await db.prepare('SELECT 1 FROM visit_marks WHERE mark = ?').get(mark);
    if (!seen) {
      await db.prepare('INSERT INTO visit_marks (mark, day) VALUES (?,?)').run(mark, day);
      db.prepare(`INSERT INTO visits (store_id, day, count) VALUES (?,?,1)
                  ON CONFLICT(store_id, day) DO UPDATE SET count = count + 1`)
        .run(store.id, day);
    }
    json(res, { ok: true, counted: !seen });
  });

  // ── إنشاء طلب (§٤.١) ──────────────────────────────────
  //  الطلب يُسجَّل هنا **قبل** أن يفتح العميل واتساب.
  r.post('/api/shop/:slug/orders', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    rateLimit(`order:${clientIp(req)}:${store.id}`, { max: 10, windowMs: 10 * 60_000 });

    const body = await readBody(req);
    const order = placeOrder(store.id, store, {
      lines:   body.lines,
      name:    clean(body.name, 60),
      phone:   clean(body.phone, 20),
      address: clean(body.address, 200),
      note:    clean(body.note, 300),
    });

    const full = withItems(store.id, await scope(store.id).get('orders', { id: order.id }));

    // §٣.٣ — سرعة رد التاجر هي عنق الزجاجة، فلا نتركه ينتظر فتح اللوحة.
    // لا ننتظر النتيجة: الطلب مسجّل، والإشعار تحسين لا شرط.
    notifyNewOrder(store, full).catch(() => {});

    json(res, {
      ok: true,
      ref: order.ref,
      subtotal: order.subtotal,
      delivery: order.delivery,
      total: order.total,
      wa: waLink(store, full),
      message: `سُجّل طلبك برقم ${order.ref}`,
    }, 201);
  });

  // ── متابعة طلب برقمه المرجعي ──────────────────────────
  r.get('/api/shop/:slug/orders/:ref', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    const o = await scope(store.id).get('orders', { ref: req.params.ref.toUpperCase() });
    if (!o) notFound('لا يوجد طلب بهذا الرقم');
    const full = withItems(store.id, o);
    json(res, {
      ref: o.ref, status: o.status,
      subtotal: o.subtotal, deliveryFee: o.delivery_fee, total: o.total,
      items: full.items, createdAt: o.created_at,
    });
  });

  // ── الإبلاغ عن متجر (§٦.٢ — صمام أمان من اليوم الأول) ──
  r.post('/api/shop/:slug/report', async (req, res) => {
    const store = storeBySlug(req.params.slug);
    rateLimit(`report:${clientIp(req)}`, { max: 5, windowMs: 60 * 60_000 });

    const body = await readBody(req);
    const reason = clean(body.reason, 60);
    if (!reason) bad('اختر سبب البلاغ');

    await scope(store.id).insert('reports', {
      reason,
      detail: clean(body.detail, 800),
      status: 'open',
      created_at: now(),
    });
    json(res, { ok: true, message: 'وصلنا بلاغك وسنراجعه. شكراً لك.' }, 201);
  });

  // ── طلب خدمة من الموقع التسويقي (§٣.١ تواصل معنا) ─────
  r.post('/api/contact', async (req, res) => {
    rateLimit(`contact:${clientIp(req)}`, { max: 5, windowMs: 60 * 60_000 });
    const body = await readBody(req);
    const kind = clean(body.kind, 20);
    if (!['build', 'domain', 'store', 'other'].includes(kind)) bad('نوع الطلب غير معروف');
    const contact = clean(body.contact, 60);
    if (!contact) bad('اترك رقم تواصل');

    db.prepare('INSERT INTO service_requests (store_id, kind, contact, detail, status, created_at) VALUES (NULL,?,?,?,?,?)')
      .run(kind, contact, clean(body.detail, 800), 'open', now());
    json(res, { ok: true, message: 'وصلنا طلبك — سنتواصل معك قريباً' }, 201);
  });

  // ── متاجر حقيقية للعرض في الصفحة الرئيسية (§٣.١) ──────
  r.get('/api/showcase', (_req, res) => {
    const rows = db.prepare(`
      SELECT s.slug, s.name, s.sector, s.logo, s.banner, s.color, s.verified, s.city,
             (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.live = 1) products
      FROM stores s
      WHERE s.status = 'active'
      ORDER BY products DESC, s.id DESC
      LIMIT 6`).all();
    json(res, rows.map((s) => ({ ...s, verified: !!s.verified, url: `/${s.slug}` })));
  });
}
