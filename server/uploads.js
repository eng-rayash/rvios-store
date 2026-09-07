// ═══════════════════════════════════════════════════════════
//  الصور (§٥.٣)
//
//  «الصور هي أكبر بند تكلفة تشغيلية» — لذلك لا تُخزَّن داخل
//  قاعدة البيانات كـ data URI، بل كملفات بمسارات منظّمة:
//      stores/{store_id}/{kind}/{hash}.jpg
//  والوعد الذي قطعه هذا الملف — «الانتقال تغيير دالة
//  واحدة» — استُوفي: كل الكتابة تمرّ الآن عبر storage.js،
//  فيختار القرصَ أو Cloudflare R2 دون أن يعرف هذا الملف.
//
//  الضغط وإعادة التحجيم يحدثان في المتصفح قبل الرفع، ثم
//  يُتحقق من الحجم هنا — لا يُترك للتاجر (§٥.٣).
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { HttpError } from './http.js';
import { put, dropPrefix } from './storage.js';

const MAX_BYTES = 2 * 1024 * 1024;               // ٢ ميجابايت لكل صورة بعد الضغط
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const DATA_URL = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * يقبل إما data URI (فيحفظه كملف ويعيد مساره)
 * أو مساراً محفوظاً سابقاً (فيعيده كما هو).
 * @returns {Promise<string>} مسار عام أو عنوان مطلق على R2
 */
export async function saveImage(storeId, kind, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // قيمة محفوظة سابقاً — أعدها دون لمس التخزين.
  // العناوين المطلقة تأتي من سلة R2 ذات النطاق العام.
  if (raw.startsWith('/uploads/') || raw.startsWith('/assets/') || raw.startsWith('https://')) {
    return raw.slice(0, 300);
  }

  const m = DATA_URL.exec(raw);
  if (!m) throw new HttpError(400, 'صيغة الصورة غير مدعومة');

  const ext = TYPES[m[1]];
  if (!ext) throw new HttpError(400, 'نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WebP');

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'الصورة أكبر من ٢ ميجابايت');
  if (buf.length < 64)        throw new HttpError(400, 'ملف الصورة تالف');

  // اسم من محتوى الصورة: الرفع نفسه مرتين لا ينتج ملفين
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const key = `stores/${storeId}/${kind}/${hash}.${ext}`;

  return await put(key, buf, m[1]);
}

/** يحذف صور متجر كاملة (عند حذف المتجر من الإدارة) */
export async function dropStoreImages(storeId) {
  await dropPrefix(`stores/${storeId}`);
}

/**
 * يزامن معرض صور منتج مع القائمة القادمة من الواجهة.
 * أول صورة تصبح الغلاف (products.image)، والباقي في
 * product_images. العدد محدود بالباقة (§٢.١).
 *
 * @param {ReturnType<import('./tenancy.js').scope>} s
 * @param {string[]} incoming  data URIs أو مسارات محفوظة
 * @param {number} max         حد الباقة
 * @returns {string} مسار صورة الغلاف
 */
export async function syncGallery(s, productId, incoming, max) {
  const urls = (await Promise.all(
    (Array.isArray(incoming) ? incoming : [])
      .filter(Boolean)
      .slice(0, Math.max(1, max))
      .map((v) => saveImage(s.storeId, 'products', v)),
  )).filter(Boolean);

  // نستبدل المعرض بالكامل: الترتيب القادم من الواجهة هو المرجع
  for (const row of await s.all('product_images', { product_id: productId })) {
    await s.remove('product_images', row.id);
  }
  // forEach لا تنتظر الوعود — الحلقة تضمن ترتيب الإدراج وإتمامه
  for (const [i, url] of urls.slice(1).entries()) {
    await s.insert('product_images', { product_id: productId, url, sort: i + 1 });
  }

  return urls[0] ?? '';
}

/** يعيد صور المنتج مرتّبة، والغلاف أولاً */
export async function galleryOf(s, product) {
  const extra = await s.all('product_images', { product_id: product.id }, { order: 'sort, id' });
  return [product.image, ...extra.map((r) => r.url)].filter(Boolean);
}
