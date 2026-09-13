// ═══════════════════════════════════════════════════════════
//  أدوات HTTP — قراءة الجسم، الكوكيز، الردود، حد المعدل
// ═══════════════════════════════════════════════════════════
import { db, now } from './db.js';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const bad      = (m, c) => { throw new HttpError(400, m, c); };
export const unauth   = (m = 'يلزم تسجيل الدخول') => { throw new HttpError(401, m); };
export const forbid   = (m = 'غير مصرّح') => { throw new HttpError(403, m); };
export const notFound = (m = 'غير موجود') => { throw new HttpError(404, m); };

export function json(res, data, status = 200, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

const MAX_BODY = config.uploads.maxBodyBytes; // يكفي لصورة مضمّنة

/**
 * الجسم الخام كنص.
 * يلزم للتحقق من توقيع Webhook: التوقيع محسوب على البايتات
 * كما وصلت، وأي إعادة تسلسل عبر JSON.parse تكسره.
 */
export function readRaw(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'حجم الطلب أكبر من المسموح'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function readBody(req) {
  const raw = await readRaw(req);
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw new HttpError(400, 'صيغة JSON غير صالحة'); }
}

/** رد نصّي خام — تحدّي تفعيل الـWebhook يتطلّبه بلا تغليف JSON */
export function text(res, body, status = 200) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * كوكي الجلسة.
 * Secure يُضاف في الإنتاج فقط، لأن إضافته في التطوير على
 * http://localhost تمنع المتصفح من حفظ الكوكي أصلاً فيتعطّل الدخول.
 */
export function cookieHeader(name, value, { maxAge = 60 * 60 * 24 * 30, clear = false } = {}) {
  const bits = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${clear ? 0 : maxAge}`,
  ];
  if (config.isProd) bits.push('Secure');
  return bits.join('; ');
}

/**
 * ترويسات الأمان الأساسية.
 * CSP يسمح بخطوط Google وبالصور المضمّنة (data:) لأن المعاينة
 * في الإعداد تعرض الصورة قبل رفعها.
 */
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  /**
   * نطاقات جوجل مسموحة لتسجيل الدخول وحده (Google Identity
   * Services): السكربت من `accounts.google.com`، والزر نفسه
   * إطارٌ منها، والاتصال يعود إليها. ثلاثة توجيهات لا واحد
   * لأن كلاً منها يحكم قناة مختلفة — ونسيان `frame-src` يترك
   * زراً يُرسم ولا يفتح شيئاً حين يُضغط.
   *
   * ولا نضيف `'unsafe-inline'` لـ script-src: ثمن راحةٍ صغيرة
   * هو فتح الباب لأخطر ما تحمينا منه هذه الترويسة.
   */
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "connect-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
};

// ── حد المعدل (§٦.٢: يمنع حسابات وهمية) ──────────────────
export async function rateLimit(key, { max = 5, windowMs = 60_000 } = {}) {
  const reset = new Date(Date.now() + windowMs).toISOString();
  const row = await db.prepare('SELECT * FROM rate_limits WHERE key = ?').get(key);

  if (!row || row.reset_at < now()) {
    await db.prepare(`INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
                ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`).run(key, reset);
    return;
  }
  if (row.count >= max) {
    throw new HttpError(429, 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة');
  }
  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  return (first ?? '').toString().split(',')[0].trim()
      || req.socket.remoteAddress
      || 'unknown';
}

/** تنقية نص من المستخدم: إزالة محارف التحكم وقصّ الطول */
export function clean(v, max = 500) {
  return String(v ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function toInt(v, def = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
