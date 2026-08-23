// ═══════════════════════════════════════════════════════════
//  الصور (§٥.٣)
//
//  «الصور هي أكبر بند تكلفة تشغيلية» — لذلك لا تُخزَّن داخل
//  قاعدة البيانات كـ data URI، بل كملفات بمسارات منظّمة:
//      uploads/stores/{store_id}/{kind}/{hash}.jpg
//  وهو نفس التنظيم الذي ستأخذه لاحقاً على Object storage
//  متوافق مع S3، فيصبح الانتقال تغيير دالة واحدة هنا.
//
//  الضغط وإعادة التحجيم يحدثان في المتصفح قبل الرفع، ثم
//  يُتحقق من الحجم هنا — لا يُترك للتاجر (§٥.٣).
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR } from './db.js';
import { HttpError } from './http.js';

const MAX_BYTES = 2 * 1024 * 1024;               // ٢ ميجابايت لكل صورة بعد الضغط
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const DATA_URL = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * يقبل إما data URI (فيحفظه كملف ويعيد مساره)
 * أو مساراً محفوظاً سابقاً (فيعيده كما هو).
 * @returns {string} مسار عام مثل /uploads/stores/3/logo/ab12cd.jpg
 */
export function saveImage(storeId, kind, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // مسار محفوظ سابقاً — أعده دون لمس القرص
  if (raw.startsWith('/uploads/') || raw.startsWith('/assets/')) {
    return raw.slice(0, 300);
  }

  const m = DATA_URL.exec(raw);
  if (!m) throw new HttpError(400, 'صيغة الصورة غير مدعومة');

  const ext = TYPES[m[1]];
  if (!ext) throw new HttpError(400, 'نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WebP');

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'الصورة أكبر من ٢ ميجابايت');
  if (buf.length < 64)        throw new HttpError(400, 'ملف الصورة تالف');

  const dir = path.join(UPLOAD_DIR, 'stores', String(storeId), kind);
  fs.mkdirSync(dir, { recursive: true });

  // اسم من محتوى الصورة: الرفع نفسه مرتين لا ينتج ملفين
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const file = `${hash}.${ext}`;
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) fs.writeFileSync(full, buf);

  return `/uploads/stores/${storeId}/${kind}/${file}`;
}

/** يحذف صور متجر كاملة (عند حذف المتجر من الإدارة) */
export function dropStoreImages(storeId) {
  const dir = path.join(UPLOAD_DIR, 'stores', String(storeId));
  fs.rmSync(dir, { recursive: true, force: true });
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
export function syncGallery(s, productId, incoming, max) {
  const urls = (Array.isArray(incoming) ? incoming : [])
    .filter(Boolean)
    .slice(0, Math.max(1, max))
    .map((v) => saveImage(s.storeId, 'products', v))
    .filter(Boolean);

  // نستبدل المعرض بالكامل: الترتيب القادم من الواجهة هو المرجع
  for (const row of s.all('product_images', { product_id: productId })) {
    s.remove('product_images', row.id);
  }
  urls.slice(1).forEach((url, i) => {
    s.insert('product_images', { product_id: productId, url, sort: i + 1 });
  });

  return urls[0] ?? '';
}

/** يعيد صور المنتج مرتّبة، والغلاف أولاً */
export function galleryOf(s, product) {
  const extra = s.all('product_images', { product_id: product.id }, { order: 'sort, id' });
  return [product.image, ...extra.map((r) => r.url)].filter(Boolean);
}
