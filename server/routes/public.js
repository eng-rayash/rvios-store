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
import { placeOrder, withItems, waLink, waAsk, deliveryFor, PAY_METHODS } from '../orders.js';
import { publicStore } from './merchant.js';
import { notifyNewOrder } from '../notify.js';
import { galleryOf, saveImage } from '../uploads.js';
import { planOf } from '../plans.js';
import { variantsOf, publicVariant, axesOf } from '../variants.js';
import { toE164, symbolOf } from '../countries.js';
import { summaryFor, summaryOf, histogramOf, listPublic, addReview } from '../reviews.js';

/** يجلب متجراً نشطاً بالرابط، أو يرمي ٤٠٤ */
export async function storeBySlug(slug) {
  const s = await db.prepare('SELECT * FROM stores WHERE slug = ?').get(slug);
  if (!s) notFound('لا يوجد متجر بهذا الرابط');
  if (s.status === 'suspended') {
    const e = new Error('هذا المتجر موقوف مؤقتاً'); e.status = 410; throw e;
  }
  return s;
}

async function shape(store, p, { gallery = false, rating = null } = {}) {
  // الخيارات تُجلب مع صفحة المنتج فقط: شبكة المنتجات لا تعرض
  // مقاسات، وجلبها لكل بطاقة يعني استعلاماً لكل صفّ.
  const variants = gallery && p.has_variants
    ? (await variantsOf(scope(store.id), p.id)).filter((v) => v.live)
    : [];

  return {
    id: p.id, name: p.name, summary: p.summary, description: p.description,
    variant: p.variant, price: p.price, oldPrice: p.old_price,
    qty: p.qty, image: p.image, categoryId: p.category_id,
    hasVariants: !!p.has_variants,
    ...(gallery && p.has_variants ? {
      variants: variants.map((v) => publicVariant(p, v)),
      axes: axesOf(p, variants),
    } : {}),
    // المعرض يُجلب عند الحاجة فقط — الشبكة تكتفي بالغلاف
    ...(gallery ? { images: await galleryOf(scope(store.id), p) } : {}),
    // §٣.٤ رفضت «نجوم تقييم غير حقيقية»، والمؤشر الصادق يبقى.
    // النجوم هنا لا تنقض ذلك: يكتبها بشر، ورقمها صفر حتى
    // يكتب أولُهم — لا يُصطنع متوسطٌ لمنتج لم يقيّمه أحد.
    rating: rating ?? { count: 0, average: 0 },
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
  name: 'LOWER(name) ASC, id DESC',
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

  const total = (await s.raw(`SELECT COUNT(*) n FROM products WHERE ${clause}`, params))[0].n;
  const rows = await s.raw(
    `SELECT * FROM products WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, per, (page - 1) * per],
  );

  // ملخّص التقييمات لكل الصفحة باستعلام واحد — لا استعلام
  // لكل بطاقة: شبكة من ٤٨ منتجاً كانت ستكلّف ٤٨ رحلة للقاعدة
  const ratings = await summaryFor(store.id, rows.map((p) => p.id));

  return {
    products: await Promise.all(rows.map((p) => shape(store, p, { rating: ratings.get(p.id) }))),
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
    const store = await storeBySlug(req.params.slug);
    const s = scope(store.id);

    const cats = await s.all('categories', {}, { order: 'sort, id' });
    const counts = Object.fromEntries(await Promise.all(
      cats.map(async (c) => [c.id, await s.count('products', { category_id: c.id, live: 1 })]),
    ));

    const zones = await s.all('delivery_zones', {}, { order: 'sort, id' });

    json(res, {
      store: publicStore(store),
      delivery: {
        // الرسم العام يبقى: متجر لم يُعرّف مناطق يعمل كما كان
        fee: store.delivery_fee ?? 0,
        freeOver: store.delivery_free_over ?? 0,
        note: store.delivery_note ?? '',
        zones: zones.map((z) => ({
          id: z.id, name: z.name, fee: z.fee, freeOver: z.free_over,
        })),
      },
      payment: {
        methods: String(store.pay_methods || 'cod').split(',')
          .map((m) => m.trim()).filter((m) => PAY_METHODS[m])
          .map((m) => ({ ...PAY_METHODS[m] })),
        note: store.pay_note ?? '',
      },
      categories: cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id, count: counts[c.id] ?? 0 })),
      ...await queryProducts(store, req.query),
    });
  });

  // ── صفحة منتجات إضافية / بحث ──────────────────────────
  r.get('/api/shop/:slug/products', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    json(res, await queryProducts(store, req.query));
  });

  // ── منتج واحد — رابط قابل للمشاركة ────────────────────
  r.get('/api/shop/:slug/products/:id', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    const p = await scope(store.id).get('products', { id: toInt(req.params.id), live: 1 });
    if (!p) notFound('المنتج غير موجود');
    const rating = await summaryOf(store.id, p.id);
    json(res, {
      store: publicStore(store),
      product: await shape(store, p, { gallery: true, rating }),
      reviews: await listPublic(store.id, p.id, { limit: 20 }),
      histogram: await histogramOf(store.id, p.id),
    });
  });

  // ── تقييمات منتج: قراءة ───────────────────────────────
  r.get('/api/shop/:slug/products/:id/reviews', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    const id = toInt(req.params.id);
    const p = await scope(store.id).get('products', { id, live: 1 });
    if (!p) notFound('المنتج غير موجود');

    const per = Math.min(50, Math.max(1, toInt(req.query.get('per'), 20)));
    const page = Math.max(1, toInt(req.query.get('page'), 1));
    json(res, {
      summary: await summaryOf(store.id, id),
      histogram: await histogramOf(store.id, id),
      reviews: await listPublic(store.id, id, {
        sort: req.query.get('sort') ?? 'helpful',
        limit: per,
        offset: (page - 1) * per,
      }),
      page,
      per,
    });
  });

  // ── تقييمات منتج: كتابة ───────────────────────────────
  //  مفتوح لأي زائر بقرار صريح. الحماية بالبصمة وحدّ المعدّل
  //  لا بالتسجيل — واشتراط الحساب يقتل التقييمات من أساسها.
  r.post('/api/shop/:slug/products/:id/reviews', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    // خمسة تقييمات في الساعة من عنوان واحد: يكفي زائراً صادقاً
    // يقيّم ما اشتراه، ويقطع سيلاً آلياً قبل أن يبدأ
    await rateLimit(`review:${clientIp(req)}`, { max: 5, windowMs: 3600_000 });

    const body = await readBody(req);
    const review = await addReview(store, toInt(req.params.id), {
      rating: body.rating,
      name: body.name,
      body: body.body,
      phone: body.phone,
    }, req);

    json(res, {
      ok: true,
      review: { id: review.id, rating: review.rating, verified: !!review.verified },
      summary: await summaryOf(store.id, review.product_id),
    }, 201);
  });

  // ── تسجيل زيارة (§١٠ — قياس) ──────────────────────────
  //  زوّار فريدون يومياً: بصمة مجزّأة تمنع تضخيم الرقم بكل
  //  تحديث للصفحة، بلا تخزين أي بيانات تعريفية.
  r.post('/api/shop/:slug/visit', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    const day = today();

    const mark = crypto.createHash('sha256')
      .update(`${store.id}|${day}|${clientIp(req)}|${req.headers['user-agent'] ?? ''}|${VISIT_SALT}`)
      .digest('hex').slice(0, 32);

    const seen = await db.prepare('SELECT 1 FROM visit_marks WHERE mark = ?').get(mark);
    if (!seen) {
      await db.prepare('INSERT INTO visit_marks (mark, day) VALUES (?,?)').run(mark, day);
      await db.prepare(`INSERT INTO visits (store_id, day, count) VALUES (?,?,1)
                  ON CONFLICT(store_id, day) DO UPDATE SET count = visits.count + 1`)
        .run(store.id, day);
    }
    json(res, { ok: true, counted: !seen });
  });

  // ── إنشاء طلب (§٤.١) ──────────────────────────────────
  //  الطلب يُسجَّل هنا **قبل** أن يفتح العميل واتساب.
  r.post('/api/shop/:slug/orders', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    await rateLimit(`order:${clientIp(req)}:${store.id}`, { max: 10, windowMs: 10 * 60_000 });

    const body = await readBody(req);
    const order = await placeOrder(store.id, store, {
      lines:     body.lines,
      name:      clean(body.name, 60),
      phone:     clean(body.phone, 20),
      address:   clean(body.address, 200),
      note:      clean(body.note, 300),
      zoneId:    toInt(body.zoneId),
      payMethod: clean(body.payMethod, 12),
    });

    const full = await withItems(store.id, await scope(store.id).get('orders', { id: order.id }));

    // §٣.٣ — سرعة رد التاجر هي عنق الزجاجة، فلا نتركه ينتظر فتح اللوحة.
    // لا ننتظر النتيجة: الطلب مسجّل، والإشعار تحسين لا شرط.
    notifyNewOrder(store, full).catch(() => {});

    json(res, {
      ok: true,
      ref: order.ref,
      subtotal: order.subtotal,
      delivery: order.delivery,
      total: order.total,
      zone: order.zone,
      payMethod: order.payMethod,
      payStatus: order.payStatus,
      // تعليمات التحويل تُرسل مع الرد لا في صفحة منفصلة: العميل
      // في لحظة الدفع الآن، ونقلُه إلى مكان آخر يفقد نصفهم
      payNote: order.payMethod === 'cod' ? '' : (store.pay_note ?? ''),
      wa: waLink(store, full),
      message: `سُجّل طلبك برقم ${order.ref}`,
    }, 201);
  });

  // ── رفع إيصال التحويل ─────────────────────────────────
  //  العميل يرفع صورة التحويل بعد الطلب، فتنتقل الحالة إلى
  //  «بانتظار مراجعتك» وتظهر للتاجر. المنصة **لا تتحقق** من
  //  الإيصال ولا تضمنه — التأكيد قرار التاجر وحده.
  r.post('/api/shop/:slug/orders/:ref/proof', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    await rateLimit(`proof:${clientIp(req)}:${store.id}`, { max: 10, windowMs: 30 * 60_000 });

    const s = scope(store.id);
    const order = await s.get('orders', { ref: clean(req.params.ref, 20) });
    if (!order) notFound('الطلب غير موجود');

    if (order.pay_method === 'cod') bad('هذا الطلب دفعه عند الاستلام');
    if (order.pay_status === 'paid') bad('الطلب مؤكد الدفع مسبقاً');

    const body = await readBody(req);
    const url = await saveImage(store.id, 'proofs', body.image);
    if (!url) bad('أرفق صورة الإيصال');

    await s.update('orders', order.id, { pay_proof: url, pay_status: 'pending' });
    json(res, { ok: true, message: 'وصل إيصالك — بانتظار تأكيد المتجر' });
  });

  // ── متابعة طلب برقمه المرجعي ──────────────────────────
  r.get('/api/shop/:slug/orders/:ref', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    const o = await scope(store.id).get('orders', { ref: req.params.ref.toUpperCase() });
    if (!o) notFound('لا يوجد طلب بهذا الرقم');
    const full = await withItems(store.id, o);
    json(res, {
      ref: o.ref, status: o.status,
      subtotal: o.subtotal, deliveryFee: o.delivery_fee, total: o.total,
      items: full.items, createdAt: o.created_at,
    });
  });

  // ── الإبلاغ عن متجر (§٦.٢ — صمام أمان من اليوم الأول) ──
  r.post('/api/shop/:slug/report', async (req, res) => {
    const store = await storeBySlug(req.params.slug);
    await rateLimit(`report:${clientIp(req)}`, { max: 5, windowMs: 60 * 60_000 });

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
    await rateLimit(`contact:${clientIp(req)}`, { max: 5, windowMs: 60 * 60_000 });
    const body = await readBody(req);
    const kind = clean(body.kind, 20);
    if (!['build', 'domain', 'store', 'other'].includes(kind)) bad('نوع الطلب غير معروف');
    const typed = clean(body.contact, 60);
    if (!typed) bad('اترك رقم تواصل');

    // يُخزَّن دولياً موحّداً: لوحة الإدارة تفتحه بـ`wa.me` مباشرةً،
    // ورقم محلي بلا رمز دولة يعطي رابطاً لا يفتح شيئاً — فيضيع
    // طلب خدمة كامل بصمت. وما تعذّر توحيده يُحفظ كما كُتب حتى
    // لا نرفض طلباً لأن صاحبه من دولة لم ندعمها بعد.
    const contact = toE164(typed, body.country) || typed;

    await db.prepare('INSERT INTO service_requests (store_id, kind, contact, detail, status, created_at) VALUES (NULL,?,?,?,?,?)')
      .run(kind, contact, clean(body.detail, 800), 'open', now());
    json(res, { ok: true, message: 'وصلنا طلبك — سنتواصل معك قريباً' }, 201);
  });

  // ── متاجر حقيقية للعرض في الصفحة الرئيسية (§٣.١) ──────
  r.get('/api/showcase', async (_req, res) => {
    const rows = await db.prepare(`
      SELECT s.slug, s.name, s.sector, s.logo, s.banner, s.color, s.verified, s.city, s.country,
             (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.live = 1) products
      FROM stores s
      WHERE s.status = 'active'
      ORDER BY products DESC, s.id DESC
      LIMIT 6`).all();
    // العملة تُرسل محسوبة: المشهد على الصفحة الرئيسية يعرض
    // أسعار متاجر حقيقية، وعرضها بعملة غير عملتها كذبٌ صغير
    json(res, rows.map((s) => ({
      ...s, verified: !!s.verified, currency: symbolOf(s.country), url: `/${s.slug}`,
    })));
  });
}
