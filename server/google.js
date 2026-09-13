// ═══════════════════════════════════════════════════════════
//  التحقق من هوية جوجل (رمز الهوية / ID token)
//
//  الهاتف يُثبت أن الشريحة بيد صاحبها، والبريد يُثبت هويةً
//  ثانية لا تُشترى من بسطة. اجتماعهما يجعل انتحال تاجرٍ
//  مكلفاً بما يكفي لينصرف عنه العابثون.
//
//  **لا نثق بما يرسله المتصفّح.** الواجهة تستلم رمزاً من جوجل
//  وتمرّره إلينا، ونحن نتحقّق من توقيعه على مفاتيح جوجل
//  العامة بأنفسنا. بدون ذلك يكفي أن يصنع أحدهم JSON فيه
//  `email: "الملك@gmail.com"` ليصير مَن يشاء.
//
//  ولا سرّ هنا: التحقق من التوقيع عملية عامة بطبيعتها. سرّ
//  التطبيق يلزم لتدفّق OAuth الكامل الذي يصل إلى بيانات
//  المستخدم في جوجل — ونحن لا نريد إلا بريداً مُثبَتاً.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { config } from './config.js';
import { HttpError } from './http.js';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * مفاتيح جوجل العامة، محفوظة مؤقتاً.
 *
 * جوجل تدوّر مفاتيحها، وجلبها مع كل تسجيل دخول يضيف رحلة
 * شبكة إلى مسار حسّاس للسرعة. نحترم `max-age` من ترويستها
 * بدل رقم نخترعه — هي أدرى بموعد التدوير.
 */
let cache = { keys: null, until: 0 };

export async function googleKeys({ force = false } = {}) {
  if (!force && cache.keys && Date.now() < cache.until) return cache.keys;

  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new HttpError(502, 'تعذّر الوصول إلى جوجل للتحقق — أعد المحاولة');

  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1]);
  cache = {
    keys,
    until: Date.now() + (Number.isFinite(maxAge) ? maxAge : 3600) * 1000,
  };
  return keys;
}

/** يفكّ ترميز base64url — رموز JWT لا تستخدم base64 العادي */
function b64url(part) {
  return Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * يتحقّق من رمز هوية جوجل ويعيد ما فيه، أو يرمي.
 *
 * الترتيب مقصود: نتحقّق من التوقيع **قبل** أن نصدّق أي حقل.
 * قراءة `email` من رمز لم يُتحقّق منه هي الثغرة نفسها التي
 * يفتحها كل من نسي هذه الخطوة.
 */
export async function verifyGoogleToken(credential, { clientId = config.google.clientId } = {}) {
  if (!clientId) throw new HttpError(503, 'تحقّق جوجل غير مُفعَّل على هذا الخادم');

  const parts = String(credential ?? '').split('.');
  if (parts.length !== 3) throw new HttpError(400, 'رمز جوجل غير صالح');

  const [rawHeader, rawPayload, rawSig] = parts;

  let header, payload;
  try {
    header  = JSON.parse(b64url(rawHeader).toString('utf8'));
    payload = JSON.parse(b64url(rawPayload).toString('utf8'));
  } catch { throw new HttpError(400, 'رمز جوجل غير مقروء'); }

  if (header.alg !== 'RS256') throw new HttpError(400, 'خوارزمية توقيع غير مقبولة');

  // ── ١) التوقيع ──────────────────────────────────────────
  // إن لم نجد المفتاح فقد تكون جوجل دوّرت مفاتيحها بعد آخر
  // جلب — نعيد الجلب مرة واحدة قبل أن نحكم بالفشل
  let keys = await googleKeys();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await googleKeys({ force: true });
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new HttpError(401, 'رمز جوجل موقَّع بمفتاح غير معروف');

  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${rawHeader}.${rawPayload}`),
    key,
    b64url(rawSig),
  );
  if (!ok) throw new HttpError(401, 'توقيع رمز جوجل غير صحيح');

  // ── ٢) الادّعاءات ───────────────────────────────────────
  // `aud` هو ما يمنع إعادة استخدام رمز صادر لتطبيق آخر: توقيعه
  // سليم من جوجل، لكنه لم يُصدَر لنا ولا يخصّنا
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) throw new HttpError(401, 'رمز جوجل صادر لتطبيق آخر');
  if (!ISSUERS.has(payload.iss)) throw new HttpError(401, 'مُصدِر الرمز ليس جوجل');

  const nowSec = Math.floor(Date.now() / 1000);
  // ٦٠ ثانية تسامح لفارق ساعة الخادم — بدونها يفشل تسجيل
  // دخول صحيح على خادم ساعته متقدّمة بثوانٍ
  if (typeof payload.exp === 'number' && payload.exp + 60 < nowSec) {
    throw new HttpError(401, 'انتهت صلاحية رمز جوجل — أعد تسجيل الدخول');
  }
  if (typeof payload.iat === 'number' && payload.iat - 60 > nowSec) {
    throw new HttpError(401, 'رمز جوجل من المستقبل — تحقّق من ساعة جهازك');
  }

  // بريد غير مؤكَّد لا يُثبت شيئاً: جوجل نفسها لم تتحقّق منه
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new HttpError(400, 'بريد جوجل غير مؤكَّد — أكّده من حسابك ثم أعد المحاولة');
  }
  if (!payload.email) throw new HttpError(400, 'رمز جوجل بلا بريد');

  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: String(payload.name ?? ''),
    picture: String(payload.picture ?? ''),
  };
}

/** حالة التحقق — تقرأها الواجهة لتعرف أتعرض الزر أم تتخطّاه */
export function googleStatus() {
  return {
    enabled: config.google.enabled,
    clientId: config.google.clientId,
  };
}
