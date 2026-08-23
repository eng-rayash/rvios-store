// ═══════════════════════════════════════════════════════════
//  الروابط (§٥.٢) — توجيه بالمسار: rviosstore.com/username
//
//  الرابط لاتيني حصراً (a–z، أرقام، شرطة). السبب عملي لا
//  جمالي: الرابط العربي يتحوّل عند النسخ إلى ترميز مثل
//  %D8%B3%D8%A7%D8%B1%D8%A9 فيبدو مشوّهاً في واتساب والبطاقات
//  والإعلانات، ويصعب نطقه أو كتابته يدوياً.
//
//  لذلك نولّد اقتراحاً لاتينياً من الاسم العربي بالحرفنة
//  (transliteration)، ويبقى للتاجر تعديله كما يشاء.
// ═══════════════════════════════════════════════════════════
import { db } from './db.js';

/** مسارات المنصة نفسها — لا يجوز أن يأخذها تاجر */
export const RESERVED = new Set([
  'api', 'assets', 'data', 'uploads', 'static', 'public', 'img', 'css', 'js',
  'dashboard', 'admin', 'login', 'logout', 'onboarding', 'start', 'signup', 'signin',
  'pricing', 'plans', 'sectors', 'about', 'contact', 'help', 'support', 'track',
  'legal', 'terms', 'privacy', 'faq', 'blog', 'docs', 'status',
  'store', 'stores', 'shop', 'shops', 'app', 'www', 'mail', 'ftp', 'cdn',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json', 'sw.js',
  'rvios', 'rviosstore', 'index', 'home', 'search', 'cart', 'order', 'orders',
  'account', 'profile', 'settings', 'billing', 'new', 'edit', 'delete', 'test',
]);

const DIACRITICS = /[ً-ْٰـ]/g;

/** حرفنة عربية → لاتينية */
const AR2LAT = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ٱ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'y', 'ء': '',
  'ؤ': 'w', 'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'گ': 'g',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * بادئات عامة تُسقط لأنها لا تميّز متجراً عن آخر.
 * «بيت» و«دار» مستثناتان عمداً: غالباً جزء من الاسم التجاري
 * نفسه («بيت الورد»)، وإسقاطهما يمحو الكلمة المميّزة.
 */
const PREFIXES = /^(متجر|محل|مؤسسة|شركة)\s+/;

/**
 * حرفنة كلمة واحدة.
 * العربية لا تكتب الحركات القصيرة، فلا سبيل لاستخراجها آلياً
 * («يزن» لا يمكن أن تعطي yazan). لكن معالجة أداة التعريف
 * وحروف المدّ تُحسّن النتيجة كثيراً: «للعطور» → utur لا llatwr.
 */
function translitWord(word) {
  let w = word;

  // إسقاط أدوات التعريف والجرّ الملتصقة: لل… · ال… · بال… · وال…
  w = w.replace(/^(لل|بال|كال|فال|وال|ال)/, '');
  if (!w) return '';

  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    // و و ي حرفا مدّ في وسط الكلمة، وحرفا علّة في أولها
    if (ch === 'و') { out += i === 0 ? 'w' : 'u'; continue; }
    if (ch === 'ي') { out += i === 0 ? 'y' : 'i'; continue; }
    out += AR2LAT[ch] !== undefined ? AR2LAT[ch] : ch;
  }
  return out;
}

export function transliterate(input) {
  return String(input ?? '')
    .replace(DIACRITICS, '')
    .replace(PREFIXES, '')
    .split(/\s+/)
    .map(translitWord)
    .filter(Boolean)
    .join(' ');
}

/** يحوّل أي نص إلى رابط لاتيني صالح */
export function slugify(input) {
  return transliterate(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // لاتيني وأرقام فقط
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

export function slugProblem(slug) {
  if (!slug)                        return 'الرابط مطلوب';
  if (slug.length < 3)              return 'الرابط قصير جداً — ٣ أحرف على الأقل';
  if (slug.length > 30)             return 'الرابط طويل جداً — ٣٠ حرفاً كحد أقصى';
  if (RESERVED.has(slug))           return 'هذا الرابط محجوز للمنصة';
  if (/^-|-$/.test(slug))           return 'لا يبدأ الرابط أو ينتهي بشرطة';
  if (/^\d+$/.test(slug))           return 'لا يصلح رابط من أرقام فقط';
  if (!/^[a-z0-9-]+$/.test(slug))   return 'الرابط بالإنجليزية فقط — أحرف وأرقام وشرطة';
  return null;
}

/**
 * الرابط محجوز إن كان مستخدماً الآن، **أو** كان رابطاً قديماً
 * لمتجر آخر: إعطاؤه لتاجر جديد يحوّل زبائن المتجر الأول إليه
 * — وهو انتحال فعلي لا مجرد تعارض أسماء (§٣.٣).
 */
export function slugTaken(slug, exceptStoreId = 0) {
  const live = db.prepare('SELECT id FROM stores WHERE slug = ?').get(slug);
  if (live && live.id !== exceptStoreId) return true;

  const retired = db.prepare('SELECT store_id FROM store_slug_history WHERE old_slug = ?').get(slug);
  return !!retired && retired.store_id !== exceptStoreId;
}

/** فحص فوري لتوفر الرابط (§٣.٢ — يمنع أكثر مصادر الإحباط شيوعاً) */
export function checkSlug(raw, exceptStoreId = 0) {
  const slug = slugify(raw);
  const problem = slugProblem(slug);
  if (problem) return { slug, ok: false, reason: problem };
  if (slugTaken(slug, exceptStoreId)) {
    return { slug, ok: false, reason: 'هذا الرابط محجوز', taken: true };
  }
  return { slug, ok: true, reason: 'متاح' };
}

/** يقترح بديلاً متاحاً عند التعارض */
export function suggestSlug(raw) {
  let base = slugify(raw);
  if (!base || base.length < 3) base = 'mystore';

  if (!slugProblem(base) && !slugTaken(base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`.slice(0, 30).replace(/-$/, '');
    if (!slugProblem(candidate) && !slugTaken(candidate)) return candidate;
  }
  return `${base.slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;
}
