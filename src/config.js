// ═══════════════════════════════════════════════════════════
//  الإعدادات — مصدر واحد، مُتحقَّق منه، يفشل مبكراً
//
//  لا يقرأ أي ملف آخر process.env مباشرة. السبب: متغيّر بيئة
//  ناقص أو خاطئ يجب أن يوقف الإقلاع بخطأ واضح، لا أن يظهر
//  كسلوك غريب بعد ساعات من التشغيل.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

/**
 * يُحمّل .env قبل أي قراءة للبيئة.
 * متغيّرات البيئة الحقيقية تفوز دائماً على الملف، فبيئة
 * الإنتاج لا يدهسها ملف منسيّ على القرص.
 */
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    // loadEnvFile لا يدهس ما هو مضبوط أصلاً — تحقّقنا من ذلك عملياً
    process.loadEnvFile(ENV_FILE);
  } catch { /* ملف تالف — نتابع بالبيئة وحدها */ }
}

const errors = [];
const warnings = [];

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(key, when = true) {
  const v = env[key];
  if (when && !v) errors.push(`${key} مطلوب`);
  return v ?? '';
}

function int(key, fallback, { min = -Infinity, max = Infinity } = {}) {
  if (env[key] === undefined) return fallback;
  const n = Number.parseInt(env[key], 10);
  if (!Number.isFinite(n)) { errors.push(`${key} يجب أن يكون رقماً`); return fallback; }
  if (n < min || n > max) { errors.push(`${key} خارج المدى المسموح (${min}–${max})`); return fallback; }
  return n;
}

function bool(key, fallback) {
  if (env[key] === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(env[key].toLowerCase());
}

function oneOf(key, allowed, fallback) {
  const v = env[key] ?? fallback;
  if (!allowed.includes(v)) errors.push(`${key} يجب أن يكون أحد: ${allowed.join(' · ')}`);
  return v;
}

/** قائمة مفصولة بفواصل، كل عنصر منها من المسموح */
function chain(key, allowed, fallback) {
  const raw = env[key] ?? fallback;
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) { errors.push(`${key} فارغ`); return fallback; }
  for (const p of parts) {
    if (!allowed.includes(p)) errors.push(`${key}: «${p}» غير معروف — المسموح: ${allowed.join(' · ')}`);
  }
  return parts.join(',');
}

// ── الأساسيات ────────────────────────────────────────────
export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd,
  port: int('PORT', 3000, { min: 1, max: 65535 }),
  host: env.HOST ?? '0.0.0.0',

  paths: {
    root: ROOT,
    public: path.join(ROOT, 'public'),
    data: env.DATA_DIR ?? path.join(ROOT, 'data'),
    get uploads() { return path.join(this.data, 'uploads'); },
    get db() { return path.join(this.data, 'rvios.db'); },
    get backups() { return env.BACKUP_DIR ?? path.join(this.data, 'backups'); },
  },

  // العنوان العام — يُستخدم في Open Graph وsitemap
  publicUrl: (env.PUBLIC_URL ?? '').replace(/\/$/, ''),

  log: {
    level: oneOf('LOG_LEVEL', ['debug', 'info', 'warn', 'error'], isProd ? 'info' : 'debug'),
    json: bool('LOG_JSON', isProd),
  },

  admin: {
    password: env.RVIOS_ADMIN_PASS || 'rvios-admin',
    sessionHours: int('ADMIN_SESSION_HOURS', 12, { min: 1, max: 168 }),
  },

  session: {
    days: int('SESSION_DAYS', 30, { min: 1, max: 365 }),
  },

  otp: {
    /**
     * قناة واحدة أو سلسلة مفصولة بفواصل: whatsapp,sms
     * تُجرَّب بالترتيب حتى تنجح واحدة (§٢.٥).
     */
    provider: chain('OTP_PROVIDER', ['console', 'whatsapp', 'sms'], 'console'),
    ttlMinutes: int('OTP_TTL_MINUTES', 5, { min: 1, max: 30 }),
    maxAttempts: int('OTP_MAX_ATTEMPTS', 5, { min: 3, max: 10 }),
    // §٢.٢ — الحدود بالساعة كما في المواصفة
    perPhone: int('OTP_PER_PHONE', 5, { min: 1, max: 20 }),
    perIp: int('OTP_PER_IP', 20, { min: 1, max: 200 }),
    windowMinutes: int('OTP_WINDOW_MINUTES', 60, { min: 1, max: 240 }),
    resendCooldownSec: int('OTP_RESEND_COOLDOWN', 60, { min: 0, max: 600 }),
    /**
     * فلفل التجزئة (§٢.١): الرمز يُخزَّن كـHMAC لا خاماً.
     * لو سُرّبت قاعدة البيانات لا يمكن استخدام الرموز المخزّنة،
     * لأن التجزئة بلا الفلفل عديمة الفائدة.
     */
    pepper: env.OTP_PEPPER ?? '',
  },

  /**
   * واتساب Cloud API.
   * نقبل تسميتَي المتغيّرات: أسماء لوحة Meta (META_TOKEN / WA_PHONE_ID)
   * والأسماء الوصفية. سبب القبول المزدوج أن مَن ينسخ المفاتيح من
   * لوحة Meta ينسخ أسماءها معها، فلا يُفترض به إعادة تسميتها يدوياً.
   */
  whatsapp: {
    token:   env.WHATSAPP_TOKEN    || env.META_TOKEN  || '',
    /**
     * معرّف **الرقم** لا معرّف الحساب.
     * الاثنان متجاوران في لوحة Meta ويسهل الخلط بينهما، والخلط
     * لا يظهر إلا عند أول إرسال فاشل. لذلك نحتفظ بالاثنين منفصلين.
     */
    phoneId: env.WHATSAPP_PHONE_ID || env.WA_PHONE_ID || '',
    wabaId:  env.WA_WABA_ID ?? '',
    template: env.WHATSAPP_TEMPLATE ?? 'otp_code',
    lang: env.WHATSAPP_LANG ?? 'ar',
    /** رقم إصدار Graph API — تثبيته يمنع كسراً مفاجئاً عند ترقية Meta */
    version: env.META_API_VERSION ?? 'v21.0',
  },

  meta: {
    appId: env.META_APP_ID ?? '',
    /**
     * سرّ التطبيق — يُستخدم لأمرين لا ثالث لهما:
     * ١) التحقق من توقيع X-Hub-Signature-256 على الـWebhook
     * ٢) بناء appsecret_proof الذي يمنع استخدام رمز مسروق من خارج خادمنا
     */
    appSecret: env.META_APP_SECRET ?? '',
    /** الرمز الذي تتوقّعه Meta في تحدّي تفعيل الـWebhook */
    verifyToken: env.WA_VERIFY_TOKEN ?? '',
  },

  sms: {
    url: env.SMS_URL ?? '',
    method: (env.SMS_METHOD ?? 'GET').toUpperCase(),
    body: env.SMS_BODY ?? '',
    auth: env.SMS_AUTH ?? '',
    text: env.SMS_TEXT ?? 'رمز التحقق في RVIOS Store: {code}',
  },

  uploads: {
    maxBytes: int('UPLOAD_MAX_BYTES', 2 * 1024 * 1024, { min: 64 * 1024 }),
    maxBodyBytes: int('MAX_BODY_BYTES', 6 * 1024 * 1024, { min: 64 * 1024 }),
  },

  jobs: {
    enabled: bool('JOBS_ENABLED', true),
    intervalMs: int('JOBS_INTERVAL_MS', 5000, { min: 500, max: 300000 }),
    maxAttempts: int('JOBS_MAX_ATTEMPTS', 5, { min: 1, max: 20 }),
    batch: int('JOBS_BATCH', 10, { min: 1, max: 100 }),
  },

  backup: {
    enabled: bool('BACKUP_ENABLED', isProd),
    intervalHours: int('BACKUP_INTERVAL_HOURS', 6, { min: 1, max: 168 }),
    keep: int('BACKUP_KEEP', 14, { min: 1, max: 200 }),
  },

  // ملح بصمة الزيارة — ثابت في الإنتاج ليبقى العدّ صحيحاً بعد إعادة التشغيل
  visitSalt: env.VISIT_SALT ?? crypto.randomBytes(16).toString('hex'),

  compression: {
    enabled: bool('COMPRESSION', true),
    minBytes: int('COMPRESSION_MIN_BYTES', 1024, { min: 0 }),
  },

  trustProxy: bool('TRUST_PROXY', isProd),
};

// ── فحوص خاصة بالإنتاج ───────────────────────────────────
if (isProd) {
  if (config.admin.password === 'rvios-admin') {
    errors.push('RVIOS_ADMIN_PASS لا يزال بالقيمة الافتراضية — غيّرها قبل الإنتاج');
  }
  if (!config.otp.pepper) {
    errors.push('OTP_PEPPER مطلوب في الإنتاج — بدونه تفقد تجزئة الرموز قيمتها');
  }
  if (!env.VISIT_SALT) {
    warnings.push('VISIT_SALT غير مضبوط — سيتغيّر عند كل إعادة تشغيل فتتضخّم أرقام الزوّار');
  }
  if (!config.publicUrl) {
    warnings.push('PUBLIC_URL غير مضبوط — سنعتمد على ترويسات الطلب لبناء روابط المشاركة');
  }
  if (config.otp.provider === 'console') {
    warnings.push('OTP_PROVIDER=console وحدها في الإنتاج — لن تصل رموز التحقق لأحد');
  }
}

// كل قناة في السلسلة يجب أن تكون مكتملة الإعداد
const otpChain = config.otp.provider.split(',');
if (otpChain.includes('whatsapp') && (!config.whatsapp.token || !config.whatsapp.phoneId)) {
  errors.push('قناة whatsapp تتطلب META_TOKEN و WA_PHONE_ID');
}
if (otpChain.includes('sms') && !config.sms.url) {
  errors.push('قناة sms تتطلب SMS_URL');
}
if (config.whatsapp.token && !config.meta.appSecret) {
  warnings.push('META_APP_SECRET غير مضبوط — لن نتمكّن من توقيع الطلبات (appsecret_proof) ولا التحقق من الـWebhook');
}
if (isProd && otpChain.includes('console') && otpChain[0] !== 'console') {
  warnings.push('console آخر السلسلة في الإنتاج — الرمز سيُطبع في السجل إن فشلت بقية القنوات');
}

export function validateConfig() {
  return { errors, warnings, ok: errors.length === 0 };
}

/** يوقف الإقلاع عند أي خطأ إعداد، ويطبع كل الأخطاء دفعة واحدة */
export function assertConfig(log) {
  for (const w of warnings) log.warn({ config: true }, w);
  if (errors.length) {
    for (const e of errors) log.error({ config: true }, e);
    log.error({ config: true }, `تعذّر الإقلاع: ${errors.length} خطأ في الإعداد`);
    process.exit(1);
  }
}
