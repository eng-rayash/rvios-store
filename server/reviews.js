// ═══════════════════════════════════════════════════════════
//  تقييمات المنتجات
//
//  القرار الحاكم: **أي زائر يقيّم، والتقييم يظهر فوراً.**
//  التاجر يُخفي المسيء ويردّ عليه من لوحته. النشر الفوري
//  يجعل العميل يرى أثر كلامه فيكتب مرة أخرى؛ وطابور مراجعة
//  يحوّل التقييمات إلى شهادات منتقاة لا يصدّقها أحد.
//
//  ولأن الباب مفتوح، الحماية بنيوية لا بشرية:
//    · بصمة كاتب (تجزئة عنوان+متصفّح+ملح) تمنع التكرار على
//      المنتج نفسه، ولا تسمح بتتبّع زائر عبر المتاجر.
//    · حدّ معدّل على العنوان يمنع سيلاً آلياً.
//    · شارة «مشترٍ موثَّق» تُحسب من الطلبات الحقيقية، فتفرز
//      الرأيَ المدعوم بشراء عن رأي عابر بلا أن تمنع الثاني.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now } from './db.js';
import { scope } from './tenancy.js';
import { config } from './config.js';
import { clean, toInt, bad } from './http.js';
import { toE164 } from './countries.js';

/** أقصى طول لنصّ التقييم — أطول من ذلك مقالة لا رأي */
export const MAX_BODY = 600;
export const MAX_REPLY = 600;

/**
 * بصمة كاتب التقييم.
 *
 * تُشتقّ من العنوان والمتصفّح وملحٍ سرّي. الملح يمنع بناء جدول
 * عكسي، ودخول `storeId` فيها يمنع ربط زائر واحد عبر متجرين —
 * وهو ما يجعلها بصمةَ منعِ تكرارٍ لا أداةَ تتبّع.
 */
export function authorKey(storeId, productId, req) {
  const ip = (req?.headers?.['x-forwarded-for'] ?? '').toString().split(',')[0].trim()
          || req?.socket?.remoteAddress || '';
  const ua = (req?.headers?.['user-agent'] ?? '').toString().slice(0, 200);
  return crypto.createHmac('sha256', config.visitSalt)
    .update(`review:${storeId}:${productId}:${ip}:${ua}`)
    .digest('hex').slice(0, 32);
}

/**
 * هل لصاحب هذا الرقم طلبٌ يحوي هذا المنتج فعلاً؟
 *
 * الرقم يُوحَّد أولاً: عميل طلب بـ`770…` ثم قيّم بـ`+967770…`
 * هو الشخص نفسه، ومقارنة النصّ الخام تحرمه شارته.
 */
export async function isVerifiedBuyer(storeId, productId, phone) {
  const e164 = toE164(clean(phone, 24));
  if (!e164) return false;
  const row = await scope(storeId).raw(`
    SELECT 1 FROM orders o
      JOIN order_items i ON i.order_id = o.id
     WHERE o.store_id = ? AND i.product_id = ? AND o.cust_phone = ?
     LIMIT 1`, [storeId, productId, e164]);
  return row.length > 0;
}

/**
 * ملخّص التقييمات لمجموعة منتجات — استعلام واحد لا استعلام
 * لكل بطاقة. شبكة من ٤٨ منتجاً كانت ستعني ٤٨ رحلة للقاعدة.
 */
export async function summaryFor(storeId, productIds) {
  const ids = [...new Set(productIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) return new Map();
  const holes = ids.map(() => '?').join(',');
  const rows = await scope(storeId).raw(`
    SELECT product_id,
           COUNT(*)::int          n,
           ROUND(AVG(rating)::numeric, 2)::float avg
      FROM product_reviews
     WHERE store_id = ? AND hidden = 0 AND product_id IN (${holes})
     GROUP BY product_id`, [storeId, ...ids]);
  return new Map(rows.map((r) => [r.product_id, { count: r.n, average: r.avg }]));
}

/** ملخّص منتج واحد — بالشكل الذي تتوقّعه الواجهة دائماً */
export async function summaryOf(storeId, productId) {
  return (await summaryFor(storeId, [productId])).get(Number(productId))
      ?? { count: 0, average: 0 };
}

/** توزيع النجوم ١..٥ — يجعل «٤٫٢» رقماً مفهوماً لا مبهماً */
export async function histogramOf(storeId, productId) {
  const rows = await scope(storeId).raw(`
    SELECT rating, COUNT(*)::int n FROM product_reviews
     WHERE store_id = ? AND product_id = ? AND hidden = 0
     GROUP BY rating`, [storeId, productId]);
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) out[r.rating] = r.n;
  return out;
}

/** شكل التقييم كما يراه العميل — لا بصمة ولا حالة إخفاء */
export function publicReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    name: r.name || 'زائر',
    body: r.body,
    verified: !!r.verified,
    reply: r.reply,
    replyAt: r.reply_at,
    createdAt: r.created_at,
  };
}

const SORTS = {
  new:     'created_at DESC, id DESC',
  helpful: 'verified DESC, created_at DESC',
  high:    'rating DESC, created_at DESC',
  low:     'rating ASC, created_at DESC',
};

/** تقييمات منتج للعرض العام — الظاهرة فقط */
export async function listPublic(storeId, productId, { sort = 'helpful', limit = 20, offset = 0 } = {}) {
  const order = SORTS[sort] ?? SORTS.helpful;
  const rows = await scope(storeId).raw(`
    SELECT * FROM product_reviews
     WHERE store_id = ? AND product_id = ? AND hidden = 0
     ORDER BY ${order} LIMIT ? OFFSET ?`,
    [storeId, productId, Math.min(50, Math.max(1, limit)), Math.max(0, offset)]);
  return rows.map(publicReview);
}

/**
 * كتابة تقييم.
 *
 * ترمي `DUPLICATE` عند إعادة التقييم من الجهاز نفسه: الفهرس
 * الفريد هو الحكم لا فحصٌ مسبق — بين الفحص والإدراج نافذةٌ
 * يمرّ منها طلبان متزامنان.
 */
export async function addReview(store, productId, { rating, name, body, phone }, req) {
  const s = scope(store.id);

  const product = await s.get('products', { id: Number(productId) });
  if (!product) bad('لا يوجد منتج بهذا المعرّف', 'NO_PRODUCT');
  if (!product.live) bad('هذا المنتج غير معروض', 'NO_PRODUCT');

  const stars = toInt(rating);
  if (stars < 1 || stars > 5) bad('التقييم من نجمة إلى خمس');

  const text = clean(body, MAX_BODY);
  const who  = clean(name, 40);

  // رقم الجوال اختياري: يمنحه صاحبه ليُثبت شراءه، ولا نطلبه
  // لأن اشتراطه يعيد القيد الذي رفضناه من الباب الخلفي.
  const verified = phone ? await isVerifiedBuyer(store.id, product.id, phone) : false;

  try {
    const id = await s.insert('product_reviews', {
      product_id: product.id,
      rating: stars,
      name: who,
      body: text,
      author_key: authorKey(store.id, product.id, req),
      verified: verified ? 1 : 0,
      created_at: now(),
    });
    return await s.get('product_reviews', { id });
  } catch (e) {
    // 23505 = انتهاك قيد فريد في Postgres
    if (e?.code === '23505') bad('سبق أن قيّمت هذا المنتج', 'DUPLICATE');
    throw e;
  }
}

/**
 * متوسط تقييم المتجر كله — للوحة التاجر ولوحة الإدارة.
 * منفصل عن `summaryFor` لأنه يعبر المنتجات لا يقف عندها.
 */
export async function storeSummary(storeId) {
  const [row] = await scope(storeId).raw(`
    SELECT COUNT(*)::int n,
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float avg,
           COUNT(*) FILTER (WHERE hidden = 1)::int hidden,
           COUNT(*) FILTER (WHERE rating <= 2 AND hidden = 0)::int low,
           COUNT(*) FILTER (WHERE reply = '' AND hidden = 0)::int unanswered
      FROM product_reviews WHERE store_id = ?`, [storeId]);
  return {
    count: row?.n ?? 0,
    average: row?.avg ?? 0,
    hidden: row?.hidden ?? 0,
    low: row?.low ?? 0,
    unanswered: row?.unanswered ?? 0,
  };
}

/** متوسطات كل المتاجر دفعةً واحدة — للوحة الإدارة */
export async function summaryByStore(storeIds) {
  const ids = [...new Set(storeIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) return new Map();
  const holes = ids.map(() => '?').join(',');
  const rows = await db.prepare(`
    SELECT store_id, COUNT(*)::int n,
           COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float avg
      FROM product_reviews
     WHERE hidden = 0 AND store_id IN (${holes})
     GROUP BY store_id`).all(...ids);
  return new Map(rows.map((r) => [r.store_id, { count: r.n, average: r.avg }]));
}
