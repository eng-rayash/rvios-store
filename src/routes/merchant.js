// ═══════════════════════════════════════════════════════════
//  واجهة لوحة التاجر (§٣.٣)
//  كل مسار هنا يمر عبر requireStore → scope(store.id)
//  فلا يوجد استعلام واحد بلا store_id.
// ═══════════════════════════════════════════════════════════
import { db, now, today } from '../db.js';
import { scope } from '../tenancy.js';
import { json, readBody, bad, forbid, notFound, clean, toInt, cookieHeader } from '../http.js';
import {
  requireStore, normalizePhone, validPhone, SESSION_COOKIE,
  storesOf, setActiveStore,
} from '../auth.js';
import { PLANS, planOf, canAddProduct, capacityLabel, ADDONS } from '../plans.js';
import { SKINS } from '../../public/assets/js/theme-core.js';
import { ORDER_STATES, withItems, advance, waLink, waAsk } from '../orders.js';
import { checkSlug } from '../slug.js';
import { saveImage, syncGallery, galleryOf, dropStoreImages } from '../uploads.js';
import {
  subscriptionOf, planPrices, addonPrices, paymentMethods, YEARLY_MONTHS_FREE,
  createInvoice, submitProof, hiddenByPlanCount, slotsOf,
} from '../billing.js';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export default async function register(r) {

  // ── نظرة عامة (§٣.٣ — الطلبات المعلّقة أولاً) ──────────
  r.get('/api/me/overview', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);

    const productCount = await s.count('products', {});
    const plan = planOf(store);

    // زيارات آخر ٧ أيام
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push(d);
    }
    const visitRows = await s.all('visits', {});
    const visitMap = Object.fromEntries(visitRows.map((v) => [v.day, v.count]));

    const ordersByDay = await s.raw(
      `SELECT substr(created_at,1,10) d, COUNT(*) n FROM orders
       WHERE store_id = ? AND substr(created_at,1,10) >= ?
       GROUP BY d`, [store.id, days[0]],
    );
    const orderMap = Object.fromEntries(ordersByDay.map((o) => [o.d, o.n]));

    const monthStart = new Date().toISOString().slice(0, 7);
    const confirmed = await s.raw(
      `SELECT COALESCE(SUM(total),0) sum FROM orders
       WHERE store_id = ? AND status IN ('ok','done') AND substr(created_at,1,7) = ?`,
      [store.id, monthStart],
    )[0].sum;

    json(res, {
      store: publicStore(store),
      kpis: {
        pending:   await s.count('orders', { status: 'wait' }),
        visits:    days.reduce((a, d) => a + (visitMap[d] ?? 0), 0),
        products:  await s.count('products', { live: 1 }),
        confirmed,
      },
      chart: days.map((d) => ({ day: d, visits: visitMap[d] ?? 0, orders: orderMap[d] ?? 0 })),
      capacity: {
        used: productCount,
        max: plan.products === Infinity ? null : plan.products,
        label: capacityLabel(store, productCount),
        pct: plan.products === Infinity ? 0 : Math.min(100, Math.round((productCount / plan.products) * 100)),
      },
      recent: await s.all('orders', {}, { order: 'created_at DESC', limit: 4 })
               .map((o) => withItems(store.id, o)),
    });
  });

  // ── الطلبات ───────────────────────────────────────────
  /**
   * مُرقَّمة على الخادم.
   * الحدّ الثابت السابق (٢٠٠) كان يُخفي الطلبات الأقدم نهائياً:
   * متجر بعشرين طلباً يومياً يبلغه في عشرة أيام، ثم يفقد سجلّه
   * كله — والسجل هو ما يحتاجه التاجر وقت الخلاف مع عميل.
   */
  const ORDERS_PER_PAGE = 50;

  r.get('/api/me/orders', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);

    const status = req.query.get('status');
    const where = status && ORDER_STATES[status] ? { status } : {};

    const total = await s.count('orders', where);
    const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
    // الصفحة تُقصَر على المدى الصالح: طلب صفحة ٩٩٩ يعيد الأخيرة
    const page = Math.min(Math.max(1, toInt(req.query.get('page')) || 1), pages);

    const rows = await s.all('orders', where, {
      order: 'created_at DESC',
      limit: ORDERS_PER_PAGE,
      offset: (page - 1) * ORDERS_PER_PAGE,
    });

    json(res, {
      orders: rows.map((o) => {
        const full = withItems(store.id, o);
        return { ...full, wa: waLink(store, full) };
      }),
      page,
      pages,
      total,
      perPage: ORDERS_PER_PAGE,
      // map غير متزامنة تعيد وعوداً — Promise.all تنتظرها معاً
      counts: Object.fromEntries(await Promise.all(
        Object.keys(ORDER_STATES).map(async (k) => [k, await s.count('orders', { status: k })]),
      )),
    });
  });

  r.patch('/api/me/orders/:id', async (req, res) => {
    const { store } = requireStore(req);
    const { status } = await readBody(req);
    const updated = advance(store.id, toInt(req.params.id), status);
    json(res, { ok: true, order: withItems(store.id, updated) });
  });

  // ── المنتجات ──────────────────────────────────────────
  r.get('/api/me/products', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const products = await s.all('products', {}, { order: 'sort, id DESC' });
    const cats = await s.all('categories', {}, { order: 'sort, id' });
    const catName = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    const plan = planOf(store);
    json(res, {
      products: products.map((p) => ({
        ...p,
        categoryName: catName[p.category_id] ?? '',
        images: galleryOf(s, p),
      })),
      capacity: {
        used: products.length,
        max: plan.products === Infinity ? null : plan.products,
        label: capacityLabel(store, products.length),
        canAdd: canAddProduct(store, products.length),
        imagesPerProduct: plan.imagesPerProduct,
      },
    });
  });

  r.post('/api/me/products', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);

    // §٢.٢ — حدّ الباقة يُفرض في الخادم لا في الواجهة
    const count = await s.count('products', {});
    if (!canAddProduct(store, count)) {
      const plan = planOf(store);
      bad(`بلغتَ حد باقة ${plan.name} (${plan.products} منتجات). رقّ باقتك لإضافة المزيد.`, 'PLAN_LIMIT');
    }

    const body = await readBody(req);
    const id = await s.insert('products', productFields(body, s, true));
    applyGallery(s, store, id, body);
    json(res, { ok: true, product: withGallery(s, await s.get('products', { id })) }, 201);
  });

  r.patch('/api/me/products/:id', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const id = toInt(req.params.id);
    if (!await s.get('products', { id })) notFound('المنتج غير موجود');
    const body = await readBody(req);
    await s.update('products', id, productFields(body, s, false));
    applyGallery(s, store, id, body);
    json(res, { ok: true, product: withGallery(s, await s.get('products', { id })) });
  });

  r.delete('/api/me/products/:id', async (req, res) => {
    const { store } = requireStore(req);
    const n = await scope(store.id).remove('products', toInt(req.params.id));
    if (!n) notFound('المنتج غير موجود');
    json(res, { ok: true });
  });

  // ── التصنيفات ─────────────────────────────────────────
  r.get('/api/me/categories', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const cats = await s.all('categories', {}, { order: 'sort, id' });
    json(res, await Promise.all(
      cats.map(async (c) => ({ ...c, count: await s.count('products', { category_id: c.id }) })),
    ));
  });

  r.post('/api/me/categories', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const body = await readBody(req);
    const name = clean(body.name, 40);
    if (!name) bad('اسم التصنيف مطلوب');

    let parent = null;
    if (body.parentId) {
      // §٢.١ — التصنيفات الفرعية ميزة مدفوعة
      if (!planOf(store).subcategories) {
        bad(`التصنيفات الفرعية متاحة في باقتي ${PLANS.plus.name} و${PLANS.pro.name}`, 'PLAN_LIMIT');
      }
      const p = await s.get('categories', { id: toInt(body.parentId) });
      if (!p) bad('التصنيف الأب غير موجود');
      parent = p.id;
    }

    const sort = toInt(body.sort, await s.count('categories', {}) + 1);
    const id = await s.insert('categories', { name, parent_id: parent, sort });
    json(res, { ok: true, category: await s.get('categories', { id }) }, 201);
  });

  r.patch('/api/me/categories/:id', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const id = toInt(req.params.id);
    if (!await s.get('categories', { id })) notFound('التصنيف غير موجود');
    const body = await readBody(req);
    const patch = {};
    if (body.name !== undefined) patch.name = clean(body.name, 40);
    if (body.sort !== undefined) patch.sort = toInt(body.sort);
    await s.update('categories', id, patch);
    json(res, { ok: true, category: await s.get('categories', { id }) });
  });

  r.delete('/api/me/categories/:id', async (req, res) => {
    const { store } = requireStore(req);
    const n = await scope(store.id).remove('categories', toInt(req.params.id));
    if (!n) notFound('التصنيف غير موجود');
    json(res, { ok: true });
  });

  // ── إعدادات المتجر (§٣.٣) ─────────────────────────────
  r.get('/api/me/store', async (req, res) => {
    const { store } = requireStore(req);
    json(res, {
      store: publicStore(store),
      plan: planOf(store),
      addons: ADDONS,
      skins: Object.values(SKINS),     // الاختيار يُفرض بالباقة في الخادم
    });
  });

  r.patch('/api/me/store', async (req, res) => {
    const { store } = requireStore(req);
    const body = await readBody(req);
    const patch = {};

    if (body.name    !== undefined) patch.name    = clean(body.name, 60) || store.name;
    if (body.tagline !== undefined) patch.tagline = clean(body.tagline, 120);
    if (body.about   !== undefined) patch.about   = clean(body.about, 600);
    if (body.city    !== undefined) patch.city    = clean(body.city, 40);
    if (body.address !== undefined) patch.address = clean(body.address, 120);
    if (body.hours   !== undefined) patch.hours   = clean(body.hours, 120);
    if (body.logo    !== undefined) patch.logo    = saveImage(store.id, 'logo', body.logo);
    if (body.banner  !== undefined) patch.banner  = saveImage(store.id, 'banner', body.banner);
    // §٣.٤ — صورة العرض: ثانية غير الغلاف، تعيش في «قصة المتجر»
    if (body.showcase !== undefined) patch.showcase = saveImage(store.id, 'showcase', body.showcase);
    if (body.sector  !== undefined) patch.sector  = clean(body.sector, 30);

    if (body.color     !== undefined && HEX.test(body.color))     patch.color = body.color;
    if (body.colorDeep !== undefined && HEX.test(body.colorDeep))  patch.color_deep = body.colorDeep;

    // §٢.١ — تعدد السكِنات ميزة برو. نرفض بوضوح بدل الحفظ
    // الصامت، فلا يظن التاجر أن اختياره سرى ثم لا يراه.
    if (body.theme !== undefined) {
      const theme = clean(body.theme, 20);
      if (!SKINS[theme]) bad('سكِن غير معروف');
      if (theme !== 'signature' && !planOf(store).extraThemes) {
        bad(`السكِنات الإضافية متاحة في باقة ${PLANS.pro.name}`, 'PLAN_LIMIT');
      }
      patch.theme = theme;
    }

    // رسوم التوصيل — يحدّدها كل تاجر لمدينته
    if (body.deliveryFee      !== undefined) patch.delivery_fee       = Math.max(0, toInt(body.deliveryFee));
    if (body.deliveryFreeOver !== undefined) patch.delivery_free_over = Math.max(0, toInt(body.deliveryFreeOver));
    if (body.deliveryNote     !== undefined) patch.delivery_note      = clean(body.deliveryNote, 200);

    if (body.whatsapp !== undefined) {
      const w = normalizePhone(body.whatsapp);
      if (!validPhone(w)) bad('رقم واتساب غير صحيح');
      patch.whatsapp = w;
    }

    if (body.slug !== undefined && body.slug !== store.slug) {
      const check = checkSlug(body.slug, store.id);
      if (!check.ok) bad(check.reason);
      patch.slug = check.slug;
    }

    await db.transaction(async (tx) => {
      // §٣.٣ — نحفظ الرابط القديم قبل تغييره ليبقى يعمل بتحويل ٣٠١
      if (patch.slug) {
        await tx.prepare(`INSERT INTO store_slug_history (old_slug, store_id, changed_at)
                    VALUES (?,?,?) ON CONFLICT(old_slug) DO UPDATE
                    SET store_id = excluded.store_id, changed_at = excluded.changed_at`)
          .run(store.slug, store.id, now());
        // لو كان الرابط الجديد مستخدماً سابقاً لهذا المتجر، نحرّره من السجل
        await tx.prepare('DELETE FROM store_slug_history WHERE old_slug = ?').run(patch.slug);
      }
      await tx.prepare(`UPDATE stores SET ${Object.keys(patch).map((k) => `${k} = ?`).join(',')} WHERE id = ?`)
        .run(...Object.values(patch), store.id);
    });

    json(res, { ok: true, store: publicStore(await db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id)) });
  });

  // ── الاشتراك (§٣.٣) ───────────────────────────────────
  r.get('/api/me/plan', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const used = await s.count('products', {});
    json(res, {
      current: planOf(store),
      all: Object.values(PLANS).map((p) => ({
        ...p,
        products: p.products === Infinity ? null : p.products,
        price: planPrices()[p.id] ?? null,     // بالريال، من الإعدادات
      })),
      addons: ADDONS,
      capacity: { used, label: capacityLabel(store, used) },
      verified: !!store.verified,
    });
  });

  /** طلب خدمة إضافية أو توثيق — يذهب لطابور الإدارة (§٣.٥) */
  r.post('/api/me/requests', async (req, res) => {
    const { store } = requireStore(req);
    const body = await readBody(req);
    const kind = clean(body.kind, 20);
    if (!['build', 'domain', 'store', 'verify', 'upgrade'].includes(kind)) bad('نوع الطلب غير معروف');

    const s = scope(store.id);
    if (await s.get('service_requests', { kind, status: 'open' })) {
      bad('لديك طلب مفتوح من هذا النوع — سنتواصل معك قريباً');
    }
    await s.insert('service_requests', {
      kind,
      contact: clean(body.contact, 60) || store.whatsapp,
      detail: clean(body.detail, 500),
      status: 'open',
      created_at: now(),
    });
    json(res, { ok: true, message: 'وصلنا طلبك — سنتواصل معك عبر واتساب' }, 201);
  });

  r.get('/api/me/requests', async (req, res) => {
    const { store } = requireStore(req);
    json(res, await scope(store.id).all('service_requests', {}, { order: 'created_at DESC' }));
  });

  // ═══ الفوترة (§٥) ═════════════════════════════════════
  r.get('/api/me/billing', async (req, res) => {
    const { store } = requireStore(req);
    const s = scope(store.id);
    const plan = planOf(store);
    const used = await s.count('products', {});

    json(res, {
      subscription: subscriptionOf(store),
      prices: planPrices(),
      addons: addonPrices(),
      methods: paymentMethods(),
      yearlyMonthsFree: YEARLY_MONTHS_FREE(),
      invoices: await s.all('invoices', {}, { order: 'created_at DESC', limit: 50 }),
      // §٥.٥ — كم منتجاً مخفي بسبب حد الباقة (مخفي لا محذوف)
      hidden: hiddenByPlanCount(store, plan.products),
      products: { used, limit: plan.products === Infinity ? null : plan.products },
    });
  });

  /** ترقية → فاتورة بمرجع وتعليمات تحويل */
  r.post('/api/me/billing/invoices', async (req, res) => {
    const { store } = requireStore(req);
    const body = await readBody(req);
    const invoice = createInvoice(store.id, {
      kind: clean(body.kind, 20) || 'subscription',
      plan: clean(body.plan, 10) || null,
      months: Math.max(1, Math.min(24, toInt(body.months, 1))),
    });
    json(res, { ok: true, invoice, methods: paymentMethods() }, 201);
  });

  /** رفع الإيصال → مراجعة + تفعيل فوري (§٥.٣) */
  r.post('/api/me/billing/invoices/:id/proof', async (req, res) => {
    const { store } = requireStore(req);
    const body = await readBody(req);
    const proofKey = saveImage(store.id, 'receipts', body.proof);
    const invoice = submitProof(store.id, toInt(req.params.id), {
      method: clean(body.method, 20),
      proofKey,
    });
    json(res, {
      ok: true,
      invoice,
      subscription: subscriptionOf(await db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id)),
      message: 'وصلنا إيصالك وفُعّلت باقتك فوراً. سنراجعه خلال يوم عمل.',
    });
  });

  // ═══ المتاجر المتعددة (برو) ═══════════════════════════
  r.get('/api/me/stores', async (req, res) => {
    const { merchant, store, stores } = requireStore(req);
    json(res, {
      active: store.id,
      slots: slotsOf(merchant),
      stores: stores.map((s) => ({
        id: s.id, slug: s.slug, name: s.name, logo: s.logo,
        color: s.color, plan: s.plan, status: s.status, url: `/${s.slug}`,
      })),
    });
  });

  /** يثبّت المتجر النشط على الجلسة */
  r.post('/api/me/active-store', async (req, res) => {
    const { merchant } = requireStore(req);
    const body = await readBody(req);
    const wanted = clean(body.store, 40);

    const target = storesOf(merchant.id)
      .find((s) => s.slug === wanted || String(s.id) === wanted);
    if (!target) notFound('لا تملك متجراً بهذا الرابط');
    if (target.status === 'suspended') bad('هذا المتجر موقوف — تواصل مع الدعم');

    setActiveStore(req, target.id);
    json(res, { ok: true, store: publicStore(target) });
  });

  /**
   * حذف متجر واحد — منفصل تماماً عن حذف الحساب.
   * التأكيد برابط هذا المتجر بالذات.
   */
  r.delete('/api/me/stores/:id', async (req, res) => {
    const { merchant } = requireStore(req);
    const body = await readBody(req);
    const id = toInt(req.params.id);

    const target = storesOf(merchant.id).find((s) => s.id === id);
    if (!target) notFound('لا تملك متجراً بهذا المعرّف');
    if (clean(body.confirm, 40) !== target.slug) {
      bad(`اكتب «${target.slug}» بالضبط لتأكيد حذف هذا المتجر`, 'CONFIRM_MISMATCH');
    }

    const remaining = storesOf(merchant.id).length - 1;
    if (remaining < 1) {
      bad('لا يمكن حذف متجرك الوحيد — احذف الحساب بدلاً من ذلك', 'LAST_STORE');
    }

    await db.prepare('DELETE FROM stores WHERE id = ? AND merchant_id = ?').run(id, merchant.id);
    dropStoreImages(id);
    json(res, { ok: true, message: `حُذف متجر «${target.name}»` });
  });

  // ── حذف الحساب (سياسة الخصوصية §٤ تعد به) ─────────────
  //  يُطلب كتابة رابط المتجر حرفياً — فعل لا رجعة فيه.
  r.delete('/api/me/account', async (req, res) => {
    const { merchant, stores } = requireStore(req);
    const body = await readBody(req);

    /**
     * التأكيد بعبارة صريحة لا برابط متجر.
     * كان التأكيد يطلب رابط متجر واحد بينما الحذف يمسح كل
     * متاجر التاجر — غير ضار بمتجر واحد، وكارثي بثلاثة.
     */
    const PHRASE = 'حذف حسابي';
    if (clean(body.confirm, 40) !== PHRASE) {
      bad(`اكتب «${PHRASE}» بالضبط لتأكيد حذف الحساب و${stores.length.toLocaleString('ar-EG')} من متاجرك`,
          'CONFIRM_MISMATCH');
    }

    const storeIds = db.prepare('SELECT id FROM stores WHERE merchant_id = ?')
      .all(merchant.id).map((s) => s.id);

    // الحذف بترتيب يحترم المفاتيح الأجنبية؛ ON DELETE CASCADE يتكفّل بالتوابع
    await db.transaction(async (tx) => {
      await tx.prepare('DELETE FROM stores WHERE merchant_id = ?').run(merchant.id);
      await tx.prepare('DELETE FROM sessions WHERE merchant_id = ?').run(merchant.id);
      await tx.prepare('DELETE FROM otps WHERE phone = ?').run(merchant.phone);
      await tx.prepare('DELETE FROM merchants WHERE id = ?').run(merchant.id);
    });

    for (const id of storeIds) dropStoreImages(id);

    json(res, { ok: true, message: 'حُذف حسابك وكل بياناته' }, 200, {
      'set-cookie': cookieHeader(SESSION_COOKIE, '', { clear: true }),
    });
  });
}

// ── مساعدات ────────────────────────────────────────────

/** يحفظ معرض الصور ويحدّث الغلاف، ضمن حد الباقة */
async function applyGallery(s, store, productId, body) {
  if (body.images === undefined) return;
  const max = planOf(store).imagesPerProduct;
  const cover = syncGallery(s, productId, body.images, max);
  await s.update('products', productId, { image: cover });
}

/** يضيف مصفوفة الصور إلى صف المنتج */
function withGallery(s, product) {
  return { ...product, images: galleryOf(s, product) };
}

async function productFields(body, s, isNew) {
  const f = {};
  if (body.name        !== undefined) f.name        = clean(body.name, 100);
  if (body.summary     !== undefined) f.summary     = clean(body.summary, 120);
  if (body.description !== undefined) f.description = clean(body.description, 1200);
  if (body.variant     !== undefined) f.variant     = clean(body.variant, 40);
  if (body.image       !== undefined) f.image       = saveImage(s.storeId, 'products', body.image);
  if (body.price       !== undefined) f.price       = Math.max(0, toInt(body.price));
  if (body.qty         !== undefined) f.qty         = Math.max(0, toInt(body.qty));
  if (body.live        !== undefined) f.live        = body.live ? 1 : 0;
  if (body.sort        !== undefined) f.sort        = toInt(body.sort);

  if (body.oldPrice !== undefined) {
    const v = toInt(body.oldPrice);
    f.old_price = v > 0 ? v : null;
  }
  if (body.categoryId !== undefined) {
    const cid = toInt(body.categoryId);
    // التصنيف يجب أن يكون من نفس المتجر — يفرضه scope تلقائياً
    f.category_id = cid && await s.get('categories', { id: cid }) ? cid : null;
  }

  if (isNew) {
    if (!f.name) bad('اسم المنتج مطلوب');
    f.created_at = now();
    f.live = f.live ?? 1;
  }
  return f;
}

/**
 * السكِن **الفعّال** لا المحفوظ.
 * لو هبط متجر من برو إلى بلس تبقى قيمته في القاعدة (§٥.٥
 * إخفاء لا حذف) لكن الواجهة تعود إلى «التوقيع»، فيسترجع
 * سكِنه لحظة الترقية دون أن يعيد ضبطه.
 */
export function effectiveTheme(s) {
  const theme = s.theme || 'signature';
  return planOf(s).extraThemes && SKINS[theme] ? theme : 'signature';
}

export function publicStore(s) {
  return {
    id: s.id, slug: s.slug, name: s.name, sector: s.sector,
    tagline: s.tagline, about: s.about, city: s.city, address: s.address,
    whatsapp: s.whatsapp, hours: s.hours, logo: s.logo, banner: s.banner,
    showcase: s.showcase ?? '',
    color: s.color, colorDeep: s.color_deep,
    theme: effectiveTheme(s), savedTheme: s.theme || 'signature',
    plan: s.plan, verified: !!s.verified, status: s.status,
    createdAt: s.created_at,
    deliveryFee: s.delivery_fee ?? 0,
    deliveryFreeOver: s.delivery_free_over ?? 0,
    deliveryNote: s.delivery_note ?? '',
    url: `/${s.slug}`,
  };
}
