// ═══════════════════════════════════════════════════════════
//  لوحة إدارة المنصة (§٣.٥)
//  الجمهور: فريق RVIOS داخلياً.
//
//  الإدارة هي الطرف الوحيد المسموح له بالعمل عبر المتاجر،
//  ولذلك لا تمر عبر scope() — بل عبر requireAdmin() صراحةً.
// ═══════════════════════════════════════════════════════════
import { db, now } from '../db.js';
import { json, readBody, bad, notFound, clean, toInt } from '../http.js';
import { requireAdmin } from '../auth.js';
import { PLANS } from '../plans.js';
import { dropStoreImages } from '../uploads.js';
import {
  markPaid, voidInvoice, planPrices, addonPrices, paymentMethods, PAYMENT_METHODS,
  getSetting, setSetting, YEARLY_MONTHS_FREE, audit,
} from '../billing.js';

export default function register(r) {

  // ── الحالة ────────────────────────────────────────────
  r.get('/api/admin/session', (req, res) => {
    try { requireAdmin(req); json(res, { admin: true }); }
    catch { json(res, { admin: false }); }
  });

  // ── إحصائيات عامة (§٣.٥) ──────────────────────────────
  r.get('/api/admin/stats', (req, res) => {
    requireAdmin(req);
    const one = (sql, ...p) => db.prepare(sql).get(...p);

    const stores    = one('SELECT COUNT(*) n FROM stores').n;
    const active    = one(`SELECT COUNT(*) n FROM stores WHERE status='active'`).n;
    const merchants = one('SELECT COUNT(*) n FROM merchants').n;
    // معدل الترقية يُقاس بالتجار لا بالمتاجر: تاجر برو بثلاثة متاجر
    // ليس ثلاث ترقيات. القسمة على المتاجر تضخّم النسبة مع التعدد.
    const paidMerchants = one(`
      SELECT COUNT(DISTINCT merchant_id) n FROM stores WHERE plan != 'basic'`).n;
    const paid = one(`SELECT COUNT(*) n FROM stores WHERE plan != 'basic'`).n;
    const multiStore = one(`
      SELECT COUNT(*) n FROM (SELECT merchant_id FROM stores
                              GROUP BY merchant_id HAVING COUNT(*) > 1)`).n;

    // §١٠ — المؤشر الأهم: نسبة التفعيل (رابط + أول منتج)
    const activated = one(`
      SELECT COUNT(*) n FROM stores s
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id)`).n;

    // متاجر حيّة: أضافت منتجاً خلال ٣٠ يوماً
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const lively = one(`
      SELECT COUNT(DISTINCT store_id) n FROM products WHERE created_at >= ?`, cutoff).n;

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
      verified:  one('SELECT COUNT(*) n FROM stores WHERE verified = 1').n,
      orders:    one('SELECT COUNT(*) n FROM orders').n,
      confirmed: one(`SELECT COUNT(*) n FROM orders WHERE status IN ('ok','done')`).n,
      products:  one('SELECT COUNT(*) n FROM products').n,
      pendingInvoices: one(`SELECT COUNT(*) n FROM invoices WHERE status='under_review'`).n,
      unpaidInvoices:  one(`SELECT COUNT(*) n FROM invoices WHERE status='unpaid'`).n,
      revenue: one(`SELECT COALESCE(SUM(amount),0) n FROM invoices WHERE status='paid'`).n,
      openReports:  one(`SELECT COUNT(*) n FROM reports WHERE status='open'`).n,
      openRequests: one(`SELECT COUNT(*) n FROM service_requests WHERE status='open'`).n,
    });
  });

  // ── إدارة التجار والمتاجر ─────────────────────────────
  r.get('/api/admin/stores', (req, res) => {
    requireAdmin(req);
    const q = (req.query.get('q') ?? '').trim();
    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT s.*, m.phone owner_phone, m.name owner_name, m.store_slots owner_slots,
             (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) products,
             (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) orders,
             (SELECT COUNT(*) FROM reports r WHERE r.store_id = s.id AND r.status='open') reports,
             (SELECT COUNT(*) FROM stores x WHERE x.merchant_id = s.merchant_id) owner_stores
      FROM stores s JOIN merchants m ON m.id = s.merchant_id
      ${q ? 'WHERE s.name LIKE ? OR s.slug LIKE ? OR m.phone LIKE ?' : ''}
      ORDER BY s.id DESC LIMIT 200`)
      .all(...(q ? [like, like, like] : []));
    json(res, rows.map((s) => ({ ...s, verified: !!s.verified })));
  });

  r.patch('/api/admin/stores/:id', async (req, res) => {
    requireAdmin(req);
    const id = toInt(req.params.id);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
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

    db.prepare(`UPDATE stores SET ${Object.keys(patch).map((k) => `${k}=?`).join(',')} WHERE id = ?`)
      .run(...Object.values(patch), id);
    json(res, { ok: true, store: db.prepare('SELECT * FROM stores WHERE id = ?').get(id) });
  });

  r.delete('/api/admin/stores/:id', (req, res) => {
    requireAdmin(req);
    const id = toInt(req.params.id);
    const n = db.prepare('DELETE FROM stores WHERE id = ?').run(id).changes;
    if (!n) notFound('المتجر غير موجود');
    dropStoreImages(id);   // لا نترك صوراً يتيمة على القرص
    json(res, { ok: true });
  });

  // ── البلاغات (§٦.٢) ───────────────────────────────────
  r.get('/api/admin/reports', (req, res) => {
    requireAdmin(req);
    const status = req.query.get('status') ?? 'open';
    json(res, db.prepare(`
      SELECT r.*, s.name store_name, s.slug store_slug
      FROM reports r JOIN stores s ON s.id = r.store_id
      WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`).all(status));
  });

  r.patch('/api/admin/reports/:id', async (req, res) => {
    requireAdmin(req);
    const { status } = await readBody(req);
    if (!['open', 'closed'].includes(status)) bad('حالة غير معروفة');
    const n = db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, toInt(req.params.id)).changes;
    if (!n) notFound('البلاغ غير موجود');
    json(res, { ok: true });
  });

  // ── طلبات الخدمات والتوثيق (§٣.٥) ─────────────────────
  r.get('/api/admin/requests', (req, res) => {
    requireAdmin(req);
    const status = req.query.get('status') ?? 'open';
    json(res, db.prepare(`
      SELECT sr.*, s.name store_name, s.slug store_slug
      FROM service_requests sr LEFT JOIN stores s ON s.id = sr.store_id
      WHERE sr.status = ? ORDER BY sr.created_at DESC LIMIT 200`).all(status));
  });

  r.patch('/api/admin/requests/:id', async (req, res) => {
    requireAdmin(req);
    const body = await readBody(req);
    const id = toInt(req.params.id);
    const reqRow = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id);
    if (!reqRow) notFound('الطلب غير موجود');

    if (!['open', 'done', 'rejected'].includes(body.status)) bad('حالة غير معروفة');

    // قبول طلب توثيق يمنح الشارة فعلياً (§٦.١)
    if (body.status === 'done' && reqRow.kind === 'verify' && reqRow.store_id) {
      db.prepare('UPDATE stores SET verified = 1 WHERE id = ?').run(reqRow.store_id);
    }
    db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').run(body.status, id);
    json(res, { ok: true });
  });

  // ═══ مراجعة المدفوعات (§٥.٦) ══════════════════════════
  //  «ستكون أكثر أقسام لوحة الإدارة استخداماً»
  r.get('/api/admin/invoices', (req, res) => {
    requireAdmin(req);
    const status = req.query.get('status') ?? 'under_review';
    const rows = db.prepare(`
      SELECT i.*, s.name store_name, s.slug store_slug, m.phone owner_phone
      FROM invoices i
      JOIN stores s ON s.id = i.store_id
      JOIN merchants m ON m.id = s.merchant_id
      WHERE i.status = ? ORDER BY i.created_at DESC LIMIT 200`).all(status);
    json(res, rows);
  });

  r.patch('/api/admin/invoices/:id', async (req, res) => {
    requireAdmin(req);
    const body = await readBody(req);
    const id = toInt(req.params.id);
    const actor = 'admin';

    if (body.action === 'paid') {
      return json(res, { ok: true, invoice: markPaid(id, actor) });
    }
    if (body.action === 'void') {
      return json(res, { ok: true, invoice: voidInvoice(id, actor, clean(body.reason, 200)) });
    }
    bad('إجراء غير معروف');
  });

  // ── إعدادات المنصة: الأسعار وتعليمات التحويل (§١١) ─────
  r.get('/api/admin/settings', (req, res) => {
    requireAdmin(req);
    json(res, {
      prices: planPrices(),
      addons: addonPrices(),
      yearlyMonthsFree: YEARLY_MONTHS_FREE(),
      methods: PAYMENT_METHODS.map((m) => ({ ...m, instructions: getSetting(m.instructionsKey, '') })),
    });
  });

  r.patch('/api/admin/settings', async (req, res) => {
    requireAdmin(req);
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
      setSetting(key, v);
      applied.push(key);
    }
    if (!applied.length) bad('لا يوجد إعداد صالح للتحديث');
    audit('admin', 'settings.update', applied.join(','), '');
    json(res, { ok: true, applied, prices: planPrices(), addons: addonPrices() });
  });

  // ── سجل التدقيق ───────────────────────────────────────
  r.get('/api/admin/audit', (req, res) => {
    requireAdmin(req);
    json(res, db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200').all());
  });

  // ── الباقات (§٣.٥ إدارة الباقات والأسعار) ─────────────
  r.get('/api/admin/plans', (req, res) => {
    requireAdmin(req);
    const usage = db.prepare('SELECT plan, COUNT(*) n FROM stores GROUP BY plan').all();
    const byPlan = Object.fromEntries(usage.map((u) => [u.plan, u.n]));
    const prices = planPrices();
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
