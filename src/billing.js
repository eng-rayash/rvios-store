// ═══════════════════════════════════════════════════════════
//  نظام الفوترة (§٥) — RVIOS Payment System
//
//  النطاق: التاجر → RVIOS فقط (اشتراكات وخدمات).
//  العميل → التاجر يبقى خارجه تماماً، فتظل المنصة **بائع
//  خدمة برمجية** لا مجمّع مدفوعات، ولا تلزمها تراخيص وساطة.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now } from './db.js';
import { scope } from './tenancy.js';
import { PLANS } from './plans.js';
import { HttpError } from './http.js';
import { notifyMerchant } from './notify.js';

// ── إعدادات المنصة ───────────────────────────────────────
export async function getSetting(key, fallback = null) {
  const row = await db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export async function setSetting(key, value) {
  await db.prepare(`INSERT INTO platform_settings (key, value, updated_at) VALUES (?,?,?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(key, JSON.stringify(value), now());
}

/**
 * أسعار الباقات بالريال اليمني (§٥.٦).
 * تُقرأ من قاعدة البيانات لأن §١١ تتركها قراراً معلّقاً —
 * يضبطها الفريق من لوحة الإدارة دون إعادة نشر.
 * null = لم تُحسم، وكل الواجهات تعرض «—».
 */
export async function planPrices() {
  return {
    basic: 0,
    plus: await getSetting('price.plus', null),
    pro:  await getSetting('price.pro', null),
  };
}

/** أسعار الخدمات لمرة واحدة */
export async function addonPrices() {
  return {
    store_build: await getSetting('price.store_build', null),
    domain:      await getSetting('price.domain', null),
    extra_store: await getSetting('price.extra_store', null),
  };
}

/** خصم الاشتراك السنوي — شهران مجاناً افتراضياً (§٥.٦) */
export const YEARLY_MONTHS_FREE = async () => await getSetting('billing.yearlyMonthsFree', 2);

// ── وسائل الدفع ──────────────────────────────────────────
export const PAYMENT_METHODS = [
  { id: 'kuraimi', name: 'بنك الكريمي', scope: 'local', instructionsKey: 'pay.kuraimi' },
  { id: 'jaib',    name: 'محفظة جيب',   scope: 'local', instructionsKey: 'pay.jaib' },
  { id: 'paypal',  name: 'PayPal',       scope: 'intl',  instructionsKey: 'pay.paypal' },
];

export async function paymentMethods() {
  // map غير متزامنة تعيد وعوداً — Promise.all تنتظرها معاً
  const withText = await Promise.all(PAYMENT_METHODS
    .map(async (m) => ({ ...m, instructions: await getSetting(m.instructionsKey, '') })));
  return withText.filter((m) => m.instructions);   // لا نعرض وسيلة بلا تعليمات تحويل
}

// ── الاشتراك ─────────────────────────────────────────────
export async function ensureSubscription(storeId, plan = 'basic') {
  const s = scope(storeId);
  let sub = await s.get('subscriptions', {});
  if (!sub) {
    await s.insert('subscriptions', { plan, status: 'active', created_at: now() });
    sub = await s.get('subscriptions', {});
  }
  return sub;
}

const GRACE_DAYS = 7;

/**
 * حالة الاشتراك المؤثرة على الحدود.
 * الباقة المجانية لا تنتهي أبداً — لا شيء يُحصَّل عليها.
 */
export async function effectivePlan(store) {
  const sub = await scope(store.id).get('subscriptions', {});
  if (!sub || sub.plan === 'basic') return 'basic';
  // منتهٍ ⇒ يعود لحدود المجانية، لكن **بلا حذف أي بيانات** (§٥.٥)
  return sub.status === 'expired' ? 'basic' : sub.plan;
}

export async function subscriptionOf(store) {
  const sub = await scope(store.id).get('subscriptions', {});
  if (!sub) return { plan: 'basic', status: 'active', currentPeriodEnd: null, daysLeft: null };

  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const daysLeft = end ? Math.ceil((end - Date.now()) / 86400000) : null;

  return {
    plan: sub.plan,
    status: sub.status,
    currentPeriodEnd: sub.current_period_end,
    daysLeft,
    effectivePlan: await effectivePlan(store),
    graceDays: GRACE_DAYS,
  };
}

// ── الفواتير ─────────────────────────────────────────────
async function nextRef() {
  for (let i = 0; i < 20; i++) {
    const n = crypto.randomInt(1000, 9999);
    const ref = `RV-INV-${n}`;
    if (!await db.prepare('SELECT 1 FROM invoices WHERE ref = ?').get(ref)) return ref;
  }
  return `RV-INV-${Date.now().toString().slice(-6)}`;
}

const DUE_DAYS = 7;

/**
 * ينشئ فاتورة غير مدفوعة.
 * `ref` هو المفتاح التشغيلي: يكتبه التاجر في ملاحظات التحويل،
 * وبدونه تصبح مطابقة الحوالات بالمبالغ مستحيلة عملياً (§٥.٢).
 */
export async function createInvoice(storeId, { kind, plan = null, months = 1 }) {
  const s = scope(storeId);

  const KINDS = ['subscription', 'store_build', 'domain', 'extra_store'];
  if (!KINDS.includes(kind)) throw new HttpError(400, 'نوع الفاتورة غير معروف');

  let amount;
  if (kind === 'subscription') {
    if (!PLANS[plan] || plan === 'basic') throw new HttpError(400, 'باقة غير صالحة للفوترة');
    const monthly = (await planPrices())[plan];
    if (!monthly) {
      throw new HttpError(409, 'سعر هذه الباقة لم يُعلن بعد — تواصل معنا لإتمام الترقية', 'PRICE_UNSET');
    }
    const billed = months >= 12 ? months - (await YEARLY_MONTHS_FREE()) : months;
    amount = monthly * billed;
  } else {
    // المتجر الإضافي حكر على برو — الباقة تفتح الإمكانية ولا تهدي متجراً
    if (kind === 'extra_store') {
      const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
      if (!PLANS[store?.plan]?.canBuyExtraStores) {
        throw new HttpError(409, 'المتاجر الإضافية متاحة في باقة برو — رقِّ باقتك أولاً', 'PRO_REQUIRED');
      }
      const m = await merchantOfStore(storeId);
      if ((m?.store_slots ?? 1) >= MAX_STORE_SLOTS) {
        throw new HttpError(409, `الحد الأقصى ${MAX_STORE_SLOTS.toLocaleString('ar-EG')} متاجر لكل حساب`, 'SLOT_MAX');
      }
    }
    amount = (await addonPrices())[kind];
    if (!amount) {
      throw new HttpError(409, 'سعر هذه الخدمة لم يُعلن بعد — تواصل معنا', 'PRICE_UNSET');
    }
  }

  /**
   * فاتورة مفتوحة من النوع نفسه؟ ثلاث حالات مختلفة:
   *
   *  ١) مطابقة تماماً        → أعدها (التاجر ضغط الزر مرتين)
   *  ٢) غير مدفوعة ومختلفة   → ألغِ القديمة وأصدر الجديدة
   *  ٣) رُفع إيصالها         → ارفض بوضوح
   *
   * الحالة ٢ كانت تعيد الفاتورة القديمة بصمت: يطلب التاجر برو
   * فيرى فاتورة بلس بمبلغ آخر ورسالة «أُنشئت فاتورتك».
   */
  const open = (await s.raw(
    `SELECT * FROM invoices WHERE store_id = ? AND kind = ? AND status IN ('unpaid','under_review')
     ORDER BY created_at DESC, id DESC LIMIT 1`, [storeId, kind]))[0];

  if (open) {
    const same = (open.plan ?? null) === (plan ?? null) && open.months === months;
    if (same) return open;

    if (open.status === 'under_review') {
      throw new HttpError(409,
        `لديك فاتورة ${open.ref} قيد المراجعة. انتظر تأكيدها قبل طلب تغيير آخر.`,
        'INVOICE_PENDING');
    }
    // غير مدفوعة ومختلفة — نستبدلها فلا تبقى فاتورة معلّقة لا يريدها
    await s.update('invoices', open.id, { status: 'void', void_reason: 'استُبدلت بطلب أحدث' });
  }

  const id = await s.insert('invoices', {
    ref: await nextRef(),
    kind, plan, months,
    amount,
    currency: 'YER',
    status: 'unpaid',
    due_at: new Date(Date.now() + DUE_DAYS * 86400000).toISOString(),
    created_at: now(),
  });
  return await s.get('invoices', { id });
}

/**
 * رفع إيصال التحويل → مراجعة + **تفعيل فوري** (§٥.٣).
 *
 * قرار تجربة مستخدم مقصود: التاجر دفع فعلاً، وإبقاؤه منتظراً
 * يوماً كاملاً تجربة سيئة. مخاطرة إيصال مزوّر واحد أرخص بكثير
 * من إحباط عشرة تجار دافعين — والمراجعة اللاحقة تُلغي التفعيل.
 */
export async function submitProof(storeId, invoiceId, { method, proofKey }) {
  const s = scope(storeId);
  const inv = await s.get('invoices', { id: invoiceId });
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');
  if (inv.status === 'paid') throw new HttpError(409, 'هذه الفاتورة مدفوعة بالفعل');
  if (inv.status === 'void') throw new HttpError(409, 'هذه الفاتورة ملغاة');
  if (!proofKey) throw new HttpError(400, 'أرفق صورة الإيصال');

  await s.update('invoices', invoiceId, { status: 'under_review', method: method ?? '', proof_key: proofKey });

  // التفعيل فوري قبل المراجعة (§٥.٣) — للاشتراك وللخانة معاً
  if (inv.kind === 'subscription') await activatePlan(storeId, inv.plan, inv.months);
  if (inv.kind === 'extra_store')  await grantStoreSlot(storeId);

  return await s.get('invoices', { id: invoiceId });
}

/** يفعّل الباقة ويمدّ الفترة */
export async function activatePlan(storeId, plan, months = 1) {
  const s = scope(storeId);
  await ensureSubscription(storeId);
  const sub = await s.get('subscriptions', {});

  // التمديد من نهاية الفترة الحالية إن كانت سارية، وإلا من اليوم
  const base = sub.current_period_end && new Date(sub.current_period_end) > new Date()
    ? new Date(sub.current_period_end) : new Date();
  base.setMonth(base.getMonth() + Number(months || 1));

  await s.update('subscriptions', sub.id, {
    plan, status: 'active', current_period_end: base.toISOString(), notified_at: null,
  });
  await db.prepare('UPDATE stores SET plan = ? WHERE id = ?').run(plan, storeId);
  return await s.get('subscriptions', {});
}

/** الإدارة تؤكد الدفع */
export async function markPaid(invoiceId, actor) {
  const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');

  await db.prepare('UPDATE invoices SET status = ?, paid_at = ?, reviewed_by = ? WHERE id = ?')
    .run('paid', now(), actor, invoiceId);

  // التفعيل قد يكون تم عند رفع الإيصال؛ نضمنه هنا للفواتير المؤكدة يدوياً
  if (inv.status !== 'under_review') {
    if (inv.kind === 'subscription') await activatePlan(inv.store_id, inv.plan, inv.months);
    if (inv.kind === 'extra_store')  await grantStoreSlot(inv.store_id);
  }
  await audit(actor, 'invoice.paid', inv.ref, `${inv.amount} ${inv.currency}`);
  return await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

/** الإدارة ترفض الإيصال → إلغاء التفعيل الذي مُنح مسبقاً */
export async function voidInvoice(invoiceId, actor, reason) {
  const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!inv) throw new HttpError(404, 'الفاتورة غير موجودة');

  await db.prepare('UPDATE invoices SET status = ?, reviewed_by = ?, void_reason = ? WHERE id = ?')
    .run('void', actor, reason ?? '', invoiceId);

  if (inv.status === 'under_review') {
    if (inv.kind === 'subscription') {
      const s = scope(inv.store_id);
      const sub = await s.get('subscriptions', {});
      if (sub) {
        await s.update('subscriptions', sub.id, { plan: 'basic', status: 'expired' });
        await db.prepare('UPDATE stores SET plan = ? WHERE id = ?').run('basic', inv.store_id);
      }
    }
    if (inv.kind === 'extra_store') await revokeStoreSlot(inv.store_id);
  }
  await audit(actor, 'invoice.void', inv.ref, reason ?? '');
  return await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

// ── انتهاء الاشتراك — التدرّج الناعم (§٥.٥) ───────────────
/**
 * لا حذف ولا إغلاق. المتجر يبقى حياً والبيانات سليمة، ويُخفى
 * فقط ما يتجاوز حد الباقة المجانية.
 *
 * المنطق التجاري: تاجر بقيت بياناته يعود ويدفع بعد شهرين؛
 * تاجر فقد بياناته لا يعود أبداً — ويحذّر غيره.
 */
/**
 * تذكيرات التجديد (§٥.٥).
 *
 * اشتراك ينتهي بلا إنذار خسارتان: إيراد التجديد، والتاجر نفسه —
 * لأنه يكتشف الانتهاء حين يرى منتجاته اختفت، فيقرأها عطلاً لا
 * فاتورة. التذكير المسبق يحوّل المفاجأة إلى قرار.
 *
 * المراحل: قبل ٧ أيام · قبل يوم · لحظة دخول المهلة · عند الانتهاء.
 * كل مرحلة تُرسل مرة واحدة، يحرسها notified_stage.
 */
const STAGES = [
  { key: 'd7',    days: 7 },
  { key: 'd1',    days: 1 },
];

function reminderText(store, stage, daysLeft) {
  const name = store.name;
  if (stage === 'd7') {
    return `تذكير: اشتراك «${name}» ينتهي بعد ${daysLeft} أيام.\n\n`
         + 'جدّد من قسم الاشتراك في لوحتك لتبقى متاجرك ومنتجاتك كما هي.';
  }
  if (stage === 'd1') {
    return `اشتراك «${name}» ينتهي غداً.\n\n`
         + 'جدّد اليوم لتفادي إخفاء منتجاتك الزائدة عن حد الباقة المجانية.';
  }
  if (stage === 'grace') {
    return `انتهى اشتراك «${name}» — ولديك ${GRACE_DAYS} أيام مهلة.\n\n`
         + 'متجرك وبياناتك كما هي ولم يُحذف شيء. جدّد خلال المهلة ويعود كل شيء فوراً.';
  }
  return `انتهت مهلة اشتراك «${name}».\n\n`
       + 'لم نحذف شيئاً — منتجاتك وطلباتك محفوظة بالكامل، وأُخفي ما يتجاوز حد الباقة المجانية فقط. '
       + 'جدّد في أي وقت ويعود كل شيء كما كان.';
}

/**
 * يرسل تذكيراً ويسجّل المرحلة.
 * فشل الإرسال لا يُسجَّل كمُرسَل: لو سجّلناه لضاع التذكير نهائياً
 * عند أول عطل شبكة عابر.
 */
async function sendReminder(sub, store, stage, daysLeft) {
  const text = reminderText(store, stage, daysLeft);
  try {
    await notifyMerchant(store, text);
    await db.prepare('UPDATE subscriptions SET notified_stage = ?, notified_at = ? WHERE id = ?')
      .run(stage, now(), sub.id);
    await audit('system', 'subscription.reminder', store.slug, stage);
    return true;
  } catch (err) {
    console.error(`✖ تعذّر تذكير ${store.slug} (${stage}):`, err.message);
    return false;
  }
}

/** يفحص الاشتراكات المقتربة من الانتهاء ويذكّر أصحابها */
export async function runReminderSweep() {
  const sent = { d7: 0, d1: 0 };

  for (const { key, days } of STAGES) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const rows = await db.prepare(`
      SELECT s.*, st.name, st.slug, st.whatsapp
      FROM subscriptions s JOIN stores st ON st.id = s.store_id
      WHERE s.plan != 'basic' AND s.status = 'active'
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end <= ? AND s.current_period_end > ?
        AND (s.notified_stage IS NULL OR s.notified_stage NOT IN (${
          // المراحل الأحدث أو المساوية تمنع إعادة الإرسال
          STAGES.slice(STAGES.findIndex((x) => x.key === key)).map((x) => `'${x.key}'`).join(',')
        }))`).all(until, now());

    for (const row of rows) {
      const left = Math.max(1, Math.ceil((new Date(row.current_period_end) - Date.now()) / 86400000));
      if (await sendReminder(row, row, key, left)) sent[key]++;
    }
  }

  return sent;
}

export async function runSubscriptionSweep() {
  const nowIso = now();
  const graceCutoff = new Date(Date.now() - GRACE_DAYS * 86400000).toISOString();
  const changed = { toGrace: 0, toExpired: 0 };

  const due = await db.prepare(`
    SELECT * FROM subscriptions
    WHERE plan != 'basic' AND status = 'active'
      AND current_period_end IS NOT NULL AND current_period_end < ?`).all(nowIso);
  for (const sub of due) {
    await db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?').run('grace', sub.id);
    changed.toGrace++;
    await notifyStage(sub.store_id, 'grace', sub.id);
  }

  const expired = await db.prepare(`
    SELECT * FROM subscriptions
    WHERE status = 'grace' AND current_period_end < ?`).all(graceCutoff);
  for (const sub of expired) {
    await db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?').run('expired', sub.id);
    await db.prepare('UPDATE stores SET plan = ? WHERE id = ?').run('basic', sub.store_id);
    changed.toExpired++;
    await notifyStage(sub.store_id, 'expired', sub.id);
  }

  return changed;
}

/**
 * إشعار انتقال الحالة — لا ينتظره الكنس.
 * تغيير الحالة في القاعدة هو الحقيقة؛ الإشعار تحسين. لو ربطنا
 * أحدهما بالآخر لتوقّف كنس بقية الاشتراكات عند أول عطل شبكة.
 */
async function notifyStage(storeId, stage, subId) {
  const store = await db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId);
  if (!store) return;

  await notifyMerchant(store, reminderText(store, stage, 0))
    .then(async () => {
      await db.prepare('UPDATE subscriptions SET notified_stage = ?, notified_at = ? WHERE id = ?')
        .run(stage, now(), subId);
      await audit('system', 'subscription.reminder', store.slug, stage);
    })
    .catch((err) => console.error(`✖ تعذّر إشعار ${store.slug} (${stage}):`, err.message));
}

/**
 * المنتجات المخفية بسبب انتهاء الاشتراك.
 * تُحسب ولا تُحذف: أقدم المنتجات تبقى ظاهرة، والزائد يُخفى.
 */
export async function hiddenByPlanCount(store, limit) {
  if (limit === Infinity) return 0;
  const total = await scope(store.id).count('products', {});
  return Math.max(0, total - limit);
}

// ── خانات المتاجر الإضافية (برو) ──────────────────────────
export const MAX_STORE_SLOTS = 5;

/** التاجر المالك لمتجر */
async function merchantOfStore(storeId) {
  return await db.prepare(`SELECT m.* FROM merchants m JOIN stores s ON s.merchant_id = m.id
                     WHERE s.id = ?`).get(storeId);
}

/**
 * يمنح خانة متجر إضافي بعد دفع فاتورة `extra_store`.
 * الخانة مملوكة للحساب لا للمتجر الذي صدرت منه الفاتورة.
 */
export async function grantStoreSlot(storeId) {
  const m = await merchantOfStore(storeId);
  if (!m) return null;
  const next = Math.min(MAX_STORE_SLOTS, (m.store_slots ?? 1) + 1);
  await db.prepare('UPDATE merchants SET store_slots = ? WHERE id = ?').run(next, m.id);
  return next;
}

/**
 * يسحب خانة عند رفض الإيصال.
 * **لا ينزل تحت عدد المتاجر القائمة**: الرفض يمنع متجراً جديداً
 * ولا يحذف قائماً — بيانات التاجر لا تُمس بقرار فوترة.
 */
export async function revokeStoreSlot(storeId) {
  const m = await merchantOfStore(storeId);
  if (!m) return null;
  const owned = (await db.prepare('SELECT COUNT(*) n FROM stores WHERE merchant_id = ?').get(m.id)).n;
  const next = Math.max(1, owned, (m.store_slots ?? 1) - 1);
  await db.prepare('UPDATE merchants SET store_slots = ? WHERE id = ?').run(next, m.id);
  return next;
}

/** حالة الخانات لعرضها للتاجر */
export async function slotsOf(merchant) {
  const owned = (await db.prepare('SELECT COUNT(*) n FROM stores WHERE merchant_id = ?').get(merchant.id)).n;
  const slots = merchant.store_slots ?? 1;
  return { owned, slots, free: Math.max(0, slots - owned), max: MAX_STORE_SLOTS };
}

// ── سجل التدقيق ──────────────────────────────────────────
export async function audit(actor, action, target = '', detail = '') {
  await db.prepare('INSERT INTO audit_log (actor, action, target, detail, created_at) VALUES (?,?,?,?,?)')
    .run(actor, action, String(target ?? ''), String(detail ?? ''), now());
}
