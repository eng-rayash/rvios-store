// ═══════════════════════════════════════════════════════════
//  لوحة إدارة المنصة (§٣.٥)
//  الجمهور: فريق RVIOS داخلياً.
//
//  الإدارة هي الطرف الوحيد المسموح له بالعمل عبر المتاجر،
//  ولذلك لا تمر عبر scope() — بل عبر await requireAdmin() صراحةً.
// ═══════════════════════════════════════════════════════════
import { db, now } from '../db.js';
import { publicProfile, decideKyc } from '../profile.js';
import { storeSummary, summaryByStore } from '../reviews.js';
import { json, readBody, bad, notFound, clean, toInt } from '../http.js';
import { requireAdmin } from '../auth.js';
import { PLANS } from '../plans.js';
import { dropStoreImages } from '../uploads.js';
import {
  markPaid, voidInvoice, planPrices, addonPrices, paymentMethods, PAYMENT_METHODS,
  getSetting, setSetting, YEARLY_MONTHS_FREE, audit,
} from '../billing.js';

export default async function register(r) {

  // ── الحالة ────────────────────────────────────────────
  r.get('/api/admin/session', async (req, res) => {
    try { await requireAdmin(req); json(res, { admin: true }); }
    catch { json(res, { admin: false }); }
  });

  // ── إحصائيات عامة (§٣.٥) ──────────────────────────────
  r.get('/api/admin/stats', async (req, res) => {
    await requireAdmin(req);
    // عدّاد مختصر — async لأن كل استعلام صار غير متزامن
    const one = async (sql, ...p) => (await db.prepare(sql).get(...p));

    const stores    = (await one('SELECT COUNT(*) n FROM stores')).n;
    const active    = (await one(`SELECT COUNT(*) n FROM stores WHERE status='active'`)).n;
    const merchants = (await one('SELECT COUNT(*) n FROM merchants')).n;
    // معدل الترقية يُقاس بالتجار لا بالمتاجر: تاجر برو بثلاثة متاجر
    // ليس ثلاث ترقيات. القسمة على المتاجر تضخّم النسبة مع التعدد.
    const paidMerchants = (await one(`
      SELECT COUNT(DISTINCT merchant_id) n FROM stores WHERE plan != 'basic'`)).n;
    const paid = (await one(`SELECT COUNT(*) n FROM stores WHERE plan != 'basic'`)).n;
    const multiStore = (await one(`
      SELECT COUNT(*) n FROM (SELECT merchant_id FROM stores
                              GROUP BY merchant_id HAVING COUNT(*) > 1)`)).n;

    // §١٠ — المؤشر الأهم: نسبة التفعيل (رابط + أول منتج)
    const activated = (await one(`
      SELECT COUNT(*) n FROM stores s
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id)`)).n;

    // متاجر حيّة: أضافت منتجاً خلال ٣٠ يوماً
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const lively = (await one(`
      SELECT COUNT(DISTINCT store_id) n FROM products WHERE created_at >= ?`, cutoff)).n;

    json(res, {
      stores, active, merchants,
      suspended: stores - active,
      activated,
      activationRate: stores ? Math.round((activated / stores) * 100) : 0,
      lively,
      retentionRate: stores ? Math.round((lively / stores) * 100) : 0,
      paid,
      paidMerchants,
      multiStore,
      upgradeRate: merchants ? Math.round((paidMerchants / merchants) * 100) : 0,
      verified:  (await one('SELECT COUNT(*) n FROM stores WHERE verified = 1')).n,
      orders:    (await one('SELECT COUNT(*) n FROM orders')).n,
      confirmed: (await one(`SELECT COUNT(*) n FROM orders WHERE status IN ('ok','done')`)).n,
      products:  (await one('SELECT COUNT(*) n FROM products')).n,
      pendingInvoices: (await one(`SELECT COUNT(*) n FROM invoices WHERE status='under_review'`)).n,
      unpaidInvoices:  (await one(`SELECT COUNT(*) n FROM invoices WHERE status='unpaid'`)).n,
      revenue: (await one(`SELECT COALESCE(SUM(amount),0) n FROM invoices WHERE status='paid'`)).n,
      openReports:  (await one(`SELECT COUNT(*) n FROM reports WHERE status='open'`)).n,
      openRequests: (await one(`SELECT COUNT(*) n FROM service_requests WHERE status='open'`)).n,
    });
  });

  // ── إدارة التجار والمتاجر ─────────────────────────────
  r.get('/api/admin/stores', async (req, res) => {
    await requireAdmin(req);
    const q = (req.query.get('q') ?? '').trim();
    const like = `%${q}%`;
    const rows = await db.prepare(`
      SELECT s.*, m.phone owner_phone, m.name owner_name, m.store_slots owner_slots,
             m.email owner_email, m.kyc_status owner_kyc, m.full_name owner_full_name,
             (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) products,
             (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) orders,
             (SELECT COUNT(*) FROM reports r WHERE r.store_id = s.id AND r.status='open') reports,
             (SELECT COUNT(*) FROM stores x WHERE x.merchant_id = s.merchant_id) owner_stores,
             sub.status sub_status, sub.current_period_end sub_ends
      FROM stores s
      JOIN merchants m ON m.id = s.merchant_id
      LEFT JOIN subscriptions sub ON sub.store_id = s.id
      ${q ? 'WHERE s.name ILIKE ? OR s.slug ILIKE ? OR m.phone ILIKE ?' : ''}
      ORDER BY s.id DESC LIMIT 200`)
      .all(...(q ? [like, like, like] : []));

    // متوسطات التقييم دفعةً واحدة — لا استعلام لكل صفّ
    const ratings = await summaryByStore(rows.map((s) => s.id));
    json(res, rows.map((s) => ({
      ...s,
      verified: !!s.verified,
      rating: ratings.get(s.id) ?? { count: 0, average: 0 },
    })));
  });

  r.patch('/api/admin/stores/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);
    const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    if (!store) notFound('المتجر غير موجود');

    const body = await readBody(req);
    const patch = {};
    if (body.status !== undefined) {
      if (!['active', 'suspended'].includes(body.status)) bad('حالة غير معروفة');
      patch.status = body.status;
    }
    if (body.verified !== undefined) patch.verified = body.verified ? 1 : 0;
    if (body.plan !== undefined) {
      if (!PLANS[body.plan]) bad('باقة غير معروفة');
      patch.plan = body.plan;
    }
    if (!Object.keys(patch).length) bad('لا يوجد تغيير');

    await db.prepare(`UPDATE stores SET ${Object.keys(patch).map((k) => `${k}=?`).join(',')} WHERE id = ?`)
      .run(...Object.values(patch), id);
    json(res, { ok: true, store: await db.prepare('SELECT * FROM stores WHERE id = ?').get(id) });
  });

  r.delete('/api/admin/stores/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);
    const n = (await db.prepare('DELETE FROM stores WHERE id = ?').run(id)).changes;
    if (!n) notFound('المتجر غير موجود');
    await dropStoreImages(id);   // لا نترك صوراً يتيمة على القرص
    json(res, { ok: true });
  });

  // ═══ ملفّ متجر واحد — كل ما يخصّه في نداء واحد ═════════
  //  الإدارة تفتح متجراً لتحكم عليه، وحُكمها يحتاج التاجر
  //  واشتراكه وفواتيره وبلاغاته معاً. تفريقها على خمسة نداءات
  //  يعني خمس شاشات وقراراً مبنيّاً على ربعِ صورة.
  r.get('/api/admin/stores/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);

    const store = await db.prepare(`
      SELECT s.*, m.phone owner_phone, m.name owner_name
        FROM stores s JOIN merchants m ON m.id = s.merchant_id
       WHERE s.id = ?`).get(id);
    if (!store) notFound('المتجر غير موجود');

    const merchant = await db.prepare('SELECT * FROM merchants WHERE id = ?').get(store.merchant_id);
    const one = async (sql, ...p) => (await db.prepare(sql).get(...p));

    const [sub, reviews] = await Promise.all([
      db.prepare('SELECT * FROM subscriptions WHERE store_id = ?').get(id),
      storeSummary(id),
    ]);

    json(res, {
      store: { ...store, verified: !!store.verified },
      merchant: publicProfile(merchant),
      // متاجر التاجر الأخرى: قرارٌ في متجر قد يخصّ إخوته
      siblings: await db.prepare(`
        SELECT id, slug, name, plan, status, verified FROM stores
         WHERE merchant_id = ? ORDER BY id`).all(store.merchant_id),
      subscription: sub ?? null,
      counts: {
        products: (await one('SELECT COUNT(*) n FROM products WHERE store_id = ?', id)).n,
        orders:   (await one('SELECT COUNT(*) n FROM orders WHERE store_id = ?', id)).n,
        customers:(await one('SELECT COUNT(*) n FROM customers WHERE store_id = ?', id)).n,
        revenue:  (await one(`SELECT COALESCE(SUM(total),0) n FROM orders
                               WHERE store_id = ? AND status IN ('ok','done')`, id)).n,
      },
      reviews,
      invoices: await db.prepare(`
        SELECT * FROM invoices WHERE store_id = ? ORDER BY created_at DESC LIMIT 50`).all(id),
      reports: await db.prepare(`
        SELECT * FROM reports WHERE store_id = ? ORDER BY created_at DESC LIMIT 50`).all(id),
      recentOrders: await db.prepare(`
        SELECT id, ref, cust_name, total, status, created_at FROM orders
         WHERE store_id = ? ORDER BY created_at DESC LIMIT 10`).all(id),
      audit: await db.prepare(`
        SELECT * FROM audit_log WHERE target = ? ORDER BY created_at DESC LIMIT 30`).all(store.slug),
    });
  });

  // ═══ التجار ═══════════════════════════════════════════
  //  جدول المتاجر يعرض صفاً لكل متجر، فتاجر بثلاثة متاجر
  //  يظهر ثلاث مرات. هذه الشاشة تنظر من زاوية التاجر: شخص
  //  واحد، بياناته، وما يملكه.
  r.get('/api/admin/merchants', async (req, res) => {
    await requireAdmin(req);
    const q = (req.query.get('q') ?? '').trim();
    const kyc = req.query.get('kyc') ?? '';
    const like = `%${q}%`;

    const where = [];
    const params = [];
    if (q) {
      where.push('(m.phone ILIKE ? OR m.name ILIKE ? OR m.email ILIKE ? OR m.full_name ILIKE ?)');
      params.push(like, like, like, like);
    }
    if (kyc) { where.push('m.kyc_status = ?'); params.push(kyc); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await db.prepare(`
      SELECT m.*,
             (SELECT COUNT(*) FROM stores s WHERE s.merchant_id = m.id) stores,
             (SELECT COUNT(*) FROM stores s WHERE s.merchant_id = m.id AND s.plan <> 'basic') paid_stores,
             (SELECT MIN(s.created_at) FROM stores s WHERE s.merchant_id = m.id) first_store_at
        FROM merchants m ${clause}
       ORDER BY m.id DESC LIMIT 300`).all(...params);

    json(res, {
      merchants: rows.map((m) => ({
        ...publicProfile(m),
        stores: m.stores,
        paidStores: m.paid_stores,
        slots: m.store_slots ?? 1,
        firstStoreAt: m.first_store_at,
        createdAt: m.created_at,
      })),
      // عدّادات الطابور — الشارة على زر التبويب تُبنى منها
      counts: Object.fromEntries((await db.prepare(
        'SELECT kyc_status, COUNT(*)::int n FROM merchants GROUP BY kyc_status').all())
        .map((r) => [r.kyc_status, r.n])),
    });
  });

  r.get('/api/admin/merchants/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);
    const m = await db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
    if (!m) notFound('التاجر غير موجود');

    json(res, {
      merchant: { ...publicProfile(m), slots: m.store_slots ?? 1, createdAt: m.created_at },
      stores: await db.prepare(`
        SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) products,
               (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) orders
          FROM stores s WHERE s.merchant_id = ? ORDER BY s.id`).all(id),
      invoices: await db.prepare(`
        SELECT i.*, s.slug store_slug FROM invoices i
          JOIN stores s ON s.id = i.store_id
         WHERE s.merchant_id = ? ORDER BY i.created_at DESC LIMIT 50`).all(id),
    });
  });

  /** قرار الإدارة في بيانات تاجر — الاعتماد يمنح الشارة */
  r.patch('/api/admin/merchants/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);
    const m = await db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
    if (!m) notFound('التاجر غير موجود');

    const body = await readBody(req);
    if (body.kyc) {
      const out = await decideKyc(id, body.kyc, body.note);
      await audit('admin', `merchant.kyc.${body.kyc}`, m.phone, clean(body.note, 200));
      return json(res, { ok: true, merchant: publicProfile(out) });
    }
    if (body.slots !== undefined) {
      const n = Math.max(1, Math.min(20, toInt(body.slots, 1)));
      // لا ننزل تحت ما يملكه فعلاً: خفضُ الخانات لا يحذف متجراً
      const owned = (await db.prepare('SELECT COUNT(*) n FROM stores WHERE merchant_id = ?').get(id)).n;
      if (n < owned) bad(`لا يمكن النزول تحت عدد متاجره القائمة (${owned})`);
      await db.prepare('UPDATE merchants SET store_slots = ? WHERE id = ?').run(n, id);
      await audit('admin', 'merchant.slots', m.phone, String(n));
      return json(res, { ok: true });
    }
    bad('لا يوجد تغيير');
  });

  // ═══ الاشتراكات ═══════════════════════════════════════
  //  شاشة واحدة تجيب: مَن ينتهي اشتراكه هذا الأسبوع؟ ومَن
  //  في المهلة؟ ومَن انتهى ولم يجدّد؟
  r.get('/api/admin/subscriptions', async (req, res) => {
    await requireAdmin(req);
    const filter = req.query.get('filter') ?? '';

    const where = [];
    const params = [];
    if (['active', 'grace', 'expired'].includes(filter)) {
      where.push('sub.status = ?'); params.push(filter);
    } else if (filter === 'soon') {
      // ينتهي خلال أسبوع — هذا مَن يُتّصل به اليوم
      where.push(`sub.current_period_end IS NOT NULL
                  AND sub.current_period_end <= ? AND sub.status = 'active'`);
      params.push(new Date(Date.now() + 7 * 86400000).toISOString());
    } else if (filter === 'paid') {
      where.push("sub.plan <> 'basic'");
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await db.prepare(`
      SELECT sub.*, s.slug, s.name store_name, s.status store_status, s.plan store_plan,
             m.id merchant_id, m.phone owner_phone, m.name owner_name, m.email owner_email,
             (SELECT COUNT(*) FROM invoices i
               WHERE i.store_id = s.id AND i.status = 'under_review') pending_invoices,
             (SELECT COALESCE(SUM(i.amount),0) FROM invoices i
               WHERE i.store_id = s.id AND i.status = 'paid') paid_total
        FROM subscriptions sub
        JOIN stores s    ON s.id = sub.store_id
        JOIN merchants m ON m.id = s.merchant_id
        ${clause}
       ORDER BY sub.current_period_end NULLS LAST, sub.id DESC
       LIMIT 300`).all(...params);

    const one = async (sql, ...p) => (await db.prepare(sql).get(...p)).n;
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString();

    json(res, {
      subscriptions: rows,
      counts: {
        all:     await one('SELECT COUNT(*) n FROM subscriptions'),
        active:  await one(`SELECT COUNT(*) n FROM subscriptions WHERE status='active'`),
        grace:   await one(`SELECT COUNT(*) n FROM subscriptions WHERE status='grace'`),
        expired: await one(`SELECT COUNT(*) n FROM subscriptions WHERE status='expired'`),
        paid:    await one(`SELECT COUNT(*) n FROM subscriptions WHERE plan <> 'basic'`),
        soon:    await one(`SELECT COUNT(*) n FROM subscriptions
                             WHERE status='active' AND current_period_end IS NOT NULL
                               AND current_period_end <= ?`, weekAhead),
      },
    });
  });

  /**
   * تعديل اشتراك يدوياً.
   *
   * يلزم حين يدفع تاجر خارج المسار — تحويلٌ وصل والفاتورة
   * ضاعت، أو تعويضٌ عن عطل. وكل تعديل يُسجَّل في التدقيق
   * لأن مدَّ اشتراكٍ بلا أثر هو بالضبط ما يصعب تفسيره لاحقاً.
   */
  r.patch('/api/admin/subscriptions/:id', async (req, res) => {
    await requireAdmin(req);
    const id = toInt(req.params.id);
    const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
    if (!sub) notFound('الاشتراك غير موجود');

    const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(sub.store_id);
    const body = await readBody(req);
    const patch = {};

    if (body.status !== undefined) {
      if (!['active', 'grace', 'expired'].includes(body.status)) bad('حالة غير معروفة');
      patch.status = body.status;
    }
    if (body.plan !== undefined) {
      if (!PLANS[body.plan]) bad('باقة غير معروفة');
      patch.plan = body.plan;
    }
    if (body.extendDays !== undefined) {
      const days = toInt(body.extendDays);
      if (!days) bad('عدد الأيام مطلوب');
      // من اليوم لا من تاريخ انتهاءٍ مضى: تمديد اشتراكٍ منتهٍ
      // منذ شهر بثلاثين يوماً كان سيُبقيه منتهياً
      const from = sub.current_period_end && sub.current_period_end > now()
        ? new Date(sub.current_period_end) : new Date();
      patch.current_period_end = new Date(from.getTime() + days * 86400000).toISOString();
    }
    if (!Object.keys(patch).length) bad('لا يوجد تغيير');

    await db.prepare(`UPDATE subscriptions SET ${Object.keys(patch).map((k) => `${k}=?`).join(',')} WHERE id = ?`)
      .run(...Object.values(patch), id);

    // الباقة على المتجر هي ما تفرضه الحدود، فتتبع الاشتراك
    if (patch.plan) await db.prepare('UPDATE stores SET plan = ? WHERE id = ?').run(patch.plan, sub.store_id);

    await audit('admin', 'subscription.update', store?.slug ?? String(sub.store_id),
      Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(' · '));

    json(res, { ok: true, subscription: await db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) });
  });

  // ═══ التقييمات عبر المنصة ═════════════════════════════
  //  الإدارة لا تدير تقييمات التجار، لكنها تحتاج رؤية
  //  المنخفض منها: متجر متوسطه نجمتان مشكلةٌ قادمة.
  r.get('/api/admin/reviews', async (req, res) => {
    await requireAdmin(req);
    const rows = await db.prepare(`
      SELECT r.*, p.name product_name, s.slug store_slug, s.name store_name
        FROM product_reviews r
        JOIN products p ON p.id = r.product_id
        JOIN stores   s ON s.id = r.store_id
       ${req.query.get('filter') === 'low' ? 'WHERE r.rating <= 2 AND r.hidden = 0' : ''}
       ORDER BY r.created_at DESC LIMIT 200`).all();
    json(res, rows.map((r) => ({ ...r, verified: !!r.verified, hidden: !!r.hidden })));
  });

  // ── البلاغات (§٦.٢) ───────────────────────────────────
  r.get('/api/admin/reports', async (req, res) => {
    await requireAdmin(req);
    const status = req.query.get('status') ?? 'open';
    json(res, await db.prepare(`
      SELECT r.*, s.name store_name, s.slug store_slug
      FROM reports r JOIN stores s ON s.id = r.store_id
      WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`).all(status));
  });

  r.patch('/api/admin/reports/:id', async (req, res) => {
    await requireAdmin(req);
    const { status } = await readBody(req);
    if (!['open', 'closed'].includes(status)) bad('حالة غير معروفة');
    const n = (await db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, toInt(req.params.id))).changes;
    if (!n) notFound('البلاغ غير موجود');
    json(res, { ok: true });
  });

  // ── طلبات الخدمات والتوثيق (§٣.٥) ─────────────────────
  r.get('/api/admin/requests', async (req, res) => {
    await requireAdmin(req);
    const status = req.query.get('status') ?? 'open';
    json(res, await db.prepare(`
      SELECT sr.*, s.name store_name, s.slug store_slug
      FROM service_requests sr LEFT JOIN stores s ON s.id = sr.store_id
      WHERE sr.status = ? ORDER BY sr.created_at DESC LIMIT 200`).all(status));
  });

  r.patch('/api/admin/requests/:id', async (req, res) => {
    await requireAdmin(req);
    const body = await readBody(req);
    const id = toInt(req.params.id);
    const reqRow = await db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id);
    if (!reqRow) notFound('الطلب غير موجود');

    if (!['open', 'done', 'rejected'].includes(body.status)) bad('حالة غير معروفة');

    // قبول طلب توثيق يمنح الشارة فعلياً (§٦.١)
    if (body.status === 'done' && reqRow.kind === 'verify' && reqRow.store_id) {
      await db.prepare('UPDATE stores SET verified = 1 WHERE id = ?').run(reqRow.store_id);
    }
    await db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').run(body.status, id);
    json(res, { ok: true });
  });

  // ═══ مراجعة المدفوعات (§٥.٦) ══════════════════════════
  //  «ستكون أكثر أقسام لوحة الإدارة استخداماً»
  r.get('/api/admin/invoices', async (req, res) => {
    await requireAdmin(req);
    const status = req.query.get('status') ?? 'under_review';
    const rows = await db.prepare(`
      SELECT i.*, s.name store_name, s.slug store_slug, m.phone owner_phone
      FROM invoices i
      JOIN stores s ON s.id = i.store_id
      JOIN merchants m ON m.id = s.merchant_id
      WHERE i.status = ? ORDER BY i.created_at DESC LIMIT 200`).all(status);
    json(res, rows);
  });

  r.patch('/api/admin/invoices/:id', async (req, res) => {
    await requireAdmin(req);
    const body = await readBody(req);
    const id = toInt(req.params.id);
    const actor = 'admin';

    if (body.action === 'paid') {
      return json(res, { ok: true, invoice: await markPaid(id, actor) });
    }
    if (body.action === 'void') {
      return json(res, { ok: true, invoice: await voidInvoice(id, actor, clean(body.reason, 200)) });
    }
    bad('إجراء غير معروف');
  });

  // ── إعدادات المنصة: الأسعار وتعليمات التحويل (§١١) ─────
  r.get('/api/admin/settings', async (req, res) => {
    await requireAdmin(req);
    json(res, {
      prices: await planPrices(),
      addons: await addonPrices(),
      yearlyMonthsFree: await YEARLY_MONTHS_FREE(),
      methods: await Promise.all(
        PAYMENT_METHODS.map(async (m) => ({ ...m, instructions: await getSetting(m.instructionsKey, '') })),
      ),
    });
  });

  r.patch('/api/admin/settings', async (req, res) => {
    await requireAdmin(req);
    const body = await readBody(req);
    const allowed = new Set([
      'price.plus', 'price.pro', 'price.store_build', 'price.domain', 'price.extra_store',
      'billing.yearlyMonthsFree', 'pay.kuraimi', 'pay.jaib', 'pay.paypal',
    ]);
    const applied = [];
    for (const [key, value] of Object.entries(body ?? {})) {
      if (!allowed.has(key)) continue;
      const v = key.startsWith('pay.') ? clean(value, 600)
              : (value === null || value === '' ? null : Math.max(0, toInt(value)));
      await setSetting(key, v);
      applied.push(key);
    }
    if (!applied.length) bad('لا يوجد إعداد صالح للتحديث');
    await audit('admin', 'settings.update', applied.join(','), '');
    json(res, { ok: true, applied, prices: await planPrices(), addons: await addonPrices() });
  });

  // ── سجل التدقيق ───────────────────────────────────────
  r.get('/api/admin/audit', async (req, res) => {
    await requireAdmin(req);
    json(res, await db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200').all());
  });

  // ── الباقات (§٣.٥ إدارة الباقات والأسعار) ─────────────
  r.get('/api/admin/plans', async (req, res) => {
    await requireAdmin(req);
    const usage = await db.prepare('SELECT plan, COUNT(*) n FROM stores GROUP BY plan').all();
    const byPlan = Object.fromEntries(usage.map((u) => [u.plan, u.n]));
    const prices = await planPrices();
    json(res, Object.values(PLANS).map((p) => ({
      ...p,
      products: p.products === Infinity ? null : p.products,
      // السعر الفعلي بالريال من الإعدادات — `priceUsd` في plans.js
      // سعر استراتيجي مرجعي، وليس ما يُفوتَر به
      price: prices[p.id] ?? null,
      stores: byPlan[p.id] ?? 0,
    })));
  });
}
