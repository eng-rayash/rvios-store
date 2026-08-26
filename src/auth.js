// ═══════════════════════════════════════════════════════════
//  المصادقة — رقم الجوال + رمز تحقق (§٣.٢، §٦.١)
//
//  §٦.١: تحقق رقم الجوال إلزامي وغير قابل للتفاوض.
//  §٣.٢: رقم الجوال بدل البريد — البريد قليل الاستخدام لدى
//        الشريحة المستهدفة.
//
//  لا يوجد مزوّد SMS في هذه المرحلة: في وضع التطوير يُطبع
//  الرمز في سجل الخادم ويُعاد في الرد. عند الإنتاج يُستبدل
//  sendOtp() بمزوّد فعلي ولا يتغير شيء آخر.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now } from './db.js';
import { HttpError, parseCookies } from './http.js';
import { deliverOtp, DEV_SHOWS_CODE } from './notify.js';
import { config } from './config.js';

export const DEV = !config.isProd;
/** يظهر الرمز في الرد فقط حين لا يوجد مزوّد إرسال فعلي */
export const SHOW_CODE = DEV && DEV_SHOWS_CODE;
const OTP_TTL_MS     = config.otp.ttlMinutes * 60 * 1000;
const SESSION_TTL_MS = config.session.days * 24 * 3600 * 1000;
export const SESSION_COOKIE = 'rvios_sid';
export const ADMIN_COOKIE   = 'rvios_admin';

/**
 * كلمة مرور لوحة الإدارة.
 * القيمة الافتراضية للتطوير فقط — `assertConfig` يوقف الإقلاع
 * إن بقيت في الإنتاج، فلا يمكن نشر لوحة إدارة بكلمة مرور معروفة.
 */
export const ADMIN_PASS = config.admin.password;

// ── رقم الجوال اليمني ────────────────────────────────────
export function normalizePhone(input) {
  // يحوّل الأرقام العربية-الهندية إلى لاتينية ثم ينظّف
  const latin = String(input ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let p = latin.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('967')) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  return p;
}

export function validPhone(p) {
  // يمني: ٧٧/٧٣/٧١/٧٠ + ٧ أرقام، أو أرضي ١-٧ أرقام
  return /^7[0137]\d{7}$/.test(p);
}

export const intlPhone = (p) => `967${p}`;

// ── الرموز ───────────────────────────────────────────────

/**
 * تجزئة الرمز قبل التخزين (§٢.١).
 * لا يُخزَّن الرمز الخام أبداً: تسريب قاعدة البيانات لا يمنح
 * المهاجم القدرة على تسجيل الدخول بحساب أي تاجر.
 */
export function hashCode(code) {
  return crypto.createHmac('sha256', config.otp.pepper || 'dev-pepper')
    .update(String(code))
    .digest('hex');
}

/** مقارنة ثابتة الزمن — لا تسرّب طول التطابق (§٢.٤) */
function sameHash(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export function issueOtp(phone) {
  const code = String(crypto.randomInt(100000, 999999));
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
  db.prepare(`INSERT INTO otps (phone, code, attempts, expires_at) VALUES (?, ?, 0, ?)
              ON CONFLICT(phone) DO UPDATE SET code = excluded.code, attempts = 0, expires_at = excluded.expires_at`)
    .run(phone, hashCode(code), expires);
  return code;   // الخام يعود للإرسال فقط، ولا يُكتب في أي مكان
}

/**
 * مهلة إعادة الإرسال (§٢.٢).
 * منفصلة عن حد المعدل: الحد يمنع الإساءة، والمهلة تمنع
 * ضغط الزر مرتين فيستهلك التاجر رصيد رسائلك بلا قصد.
 */
export async function assertResendAllowed(phone) {
  const row = await db.prepare('SELECT expires_at FROM otps WHERE phone = ?').get(phone);
  if (!row) return;
  const issuedAt = new Date(row.expires_at).getTime() - OTP_TTL_MS;
  const waited = Date.now() - issuedAt;
  const cooldownMs = config.otp.resendCooldownSec * 1000;
  if (waited < cooldownMs) {
    const left = Math.ceil((cooldownMs - waited) / 1000);
    throw new HttpError(429, `انتظر ${left.toLocaleString('ar-EG')} ثانية قبل طلب رمز جديد`);
  }
}

/** يرسل الرمز عبر المزوّد المضبوط (انظر src/notify.js) */
export async function sendOtp(phone, code) {
  return deliverOtp(phone, code);
}

/**
 * التحقق من الرمز (§٢.٤).
 *
 * كل حالات الفشل تعيد **الرسالة نفسها**: رمز غير موجود، منتهٍ،
 * خاطئ، أو مستهلَك. التمييز بينها يحوّل نقطة الدخول إلى أداة
 * تكشف أي الأرقام مسجّلة وأيها في منتصف تدفق تحقق.
 */
export async function verifyOtp(phone, code) {
  const FAIL = () => new HttpError(400, 'الرمز غير صحيح أو منتهي الصلاحية');

  const row = await db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  if (!row) throw FAIL();

  if (row.expires_at < now() || row.attempts >= config.otp.maxAttempts) {
    await db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);
    throw FAIL();
  }

  // العدّاد يزيد قبل المقارنة، فلا تُستنزف المحاولات بطلبات متوازية
  await db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(phone);

  if (!sameHash(row.code, hashCode(String(code).trim()))) throw FAIL();

  // الاستهلاك يمنع إعادة استخدام الرمز نفسه
  await db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);
  return true;
}

// ── التجار والجلسات ──────────────────────────────────────
export async function findOrCreateMerchant(phone) {
  const found = await db.prepare('SELECT * FROM merchants WHERE phone = ?').get(phone);
  if (found) return found;
  const res = db.prepare('INSERT INTO merchants (phone, name, created_at) VALUES (?, ?, ?)')
                .run(phone, '', now());
  return await db.prepare('SELECT * FROM merchants WHERE id = ?').get(Number(res.lastInsertRowid));
}

export function createSession(merchantId, kind = 'merchant') {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, merchant_id, kind, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(token, merchantId, kind, now(), new Date(Date.now() + SESSION_TTL_MS).toISOString());
  return token;
}

/** جلسة إدارة — لا ترتبط بتاجر، وعمرها أقصر */
export function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, merchant_id, kind, created_at, expires_at) VALUES (?,NULL,?,?,?)')
    .run(token, 'admin', now(), new Date(Date.now() + 12 * 3600 * 1000).toISOString());
  return token;
}

export async function destroySession(token) {
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** التاجر الحالي أو null */
export async function currentMerchant(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const s = await db.prepare('SELECT * FROM sessions WHERE token = ? AND kind = ?').get(token, 'merchant');
  if (!s) return null;
  if (s.expires_at < now()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return await db.prepare('SELECT * FROM merchants WHERE id = ?').get(s.merchant_id) ?? null;
}

export function requireMerchant(req) {
  const m = currentMerchant(req);
  if (!m) throw new HttpError(401, 'يلزم تسجيل الدخول');
  return m;
}

/** كل متاجر التاجر، الأقدم أولاً */
export async function storesOf(merchantId) {
  return await db.prepare('SELECT * FROM stores WHERE merchant_id = ? ORDER BY id').all(merchantId);
}

/** المتجر المثبَّت في هذه الجلسة، إن وُجد */
async function sessionActiveStore(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const row = await db.prepare('SELECT active_store_id FROM sessions WHERE token = ?').get(token);
  return row?.active_store_id ?? null;
}

/** يثبّت المتجر النشط على الجلسة الحالية */
export async function setActiveStore(req, storeId) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await db.prepare('UPDATE sessions SET active_store_id = ? WHERE token = ?').run(storeId, token);
}

/**
 * المتجر الحالي — البوابة الوحيدة إلى scope().
 *
 * يُحلّ بثلاث درجات:
 *   ١) ترويسة `X-Store` أو `?store=` — صريح، فتبويبان على
 *      متجرين مختلفين يعملان معاً بلا تعارض.
 *   ٢) المتجر المثبَّت في الجلسة — يتذكّر اختيار التاجر.
 *   ٣) الأقدم — يحافظ على سلوك أصحاب المتجر الواحد حرفياً.
 *
 * متجر مطلوب لا يملكه التاجر يسقط بصمت إلى الافتراضي: لا نكشف
 * وجوده من عدمه، ولا نسمح بالوصول إليه.
 */
export function requireStore(req) {
  const m = requireMerchant(req);
  const stores = storesOf(m.id);
  if (!stores.length) throw new HttpError(409, 'لم تُنشئ متجرك بعد', 'NO_STORE');

  const asked = req.headers?.['x-store'] ?? req.query?.get?.('store') ?? null;
  const activeId = sessionActiveStore(req);

  const store =
    (asked && stores.find((s) => s.slug === asked || String(s.id) === String(asked)))
    ?? stores.find((s) => s.id === activeId)
    ?? stores[0];

  if (store.status === 'suspended') throw new HttpError(403, 'هذا المتجر موقوف — تواصل مع الدعم');
  return { merchant: m, store, stores };
}

// ── الإدارة ──────────────────────────────────────────────
export async function isAdmin(req) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return false;
  const s = await db.prepare('SELECT * FROM sessions WHERE token = ? AND kind = ?').get(token, 'admin');
  return !!s && s.expires_at >= now();
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'يلزم دخول الإدارة');
}

export async function cleanupExpired() {
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  await db.prepare('DELETE FROM otps WHERE expires_at < ?').run(now());
  await db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(now());
  // بصمات الزيارة لا تُحتفظ أكثر من يومين
  const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  await db.prepare('DELETE FROM visit_marks WHERE day < ?').run(cutoff);
}
