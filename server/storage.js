// ═══════════════════════════════════════════════════════════
//  التخزين الكائني — سائقان بواجهة واحدة
//
//  local : القرص تحت DATA_DIR/uploads (الافتراضي، وما يعمل به
//          التطوير والاختبار بلا أي إعداد).
//  r2    : Cloudflare R2 عبر بروتوكول S3.
//
//  لماذا بلا SDK؟ شجرة الاعتماديات في هذا المشروع حزمة واحدة
//  (postgres). ‏@aws-sdk/client-s3 يجرّ عشرات الحزم المتعدّية
//  لأجل ثلاث عمليات: PUT وDELETE وLIST. التوقيع SigV4 نفسه
//  ستّون سطراً بـnode:crypto، وهي مكتوبة أدناه ومُختبرة.
//
//  الشكل المخزَّن في قاعدة البيانات:
//    local → /uploads/stores/3/logo/ab12cd.jpg   (مسار نسبي)
//    r2    → https://cdn.example.com/stores/3/…  (عنوان مطلق)
//  والقارئ لا يميّز: كلاهما يذهب في src="..." كما هو، والقيم
//  القديمة تبقى صالحة بعد التحويل — لا ترحيل إجباري للصور.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const R2 = config.storage.r2;
export const driver = config.storage.driver;

// ── توقيع AWS SigV4 ──────────────────────────────────────
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/** ‏YYYYMMDD'T'HHMMSS'Z' — الصيغة التي يفرضها التوقيع */
const stamp = () => new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

/**
 * ترميز المسار: كل مقطع على حدة، والشرطة المائلة تبقى فاصلاً.
 * ‏encodeURIComponent وحدها تُرمّز `/` فيفسد المفتاح.
 */
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

/**
 * طلب موقَّع إلى R2.
 * @param {'PUT'|'DELETE'|'GET'} method
 * @param {string} key      مفتاح الكائن، أو '' للعمليات على السلة
 * @param {Buffer|string} body
 * @param {Record<string,string>} extra ترويسات إضافية تدخل التوقيع
 * @param {string} query    سلسلة استعلام مرتّبة أبجدياً (للسرد)
 */
async function signedFetch(method, key, body = '', extra = {}, query = '') {
  const host = `${R2.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${R2.bucket}${key ? '/' + encodeKey(key) : ''}`;
  const payloadHash = sha256(body);
  const now = stamp();
  const date = now.slice(0, 8);

  // أسماء صغيرة منذ البداية: التوقيع يفرضها، وتطبيعها هنا
  // مرة واحدة أضمن من مطابقتها لاحقاً
  const headers = Object.fromEntries(
    Object.entries({
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': now,
      ...extra,
    }).map(([k, v]) => [k.toLowerCase(), String(v).trim()]),
  );

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((h) => `${h}:${headers[h]}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    method, canonicalUri, query, canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonicalRequest)].join('\n');

  let k = hmac(`AWS4${R2.secretAccessKey}`, date);
  for (const part of ['auto', 's3', 'aws4_request']) k = hmac(k, part);
  const signature = crypto.createHmac('sha256', k).update(toSign).digest('hex');

  const res = await fetch(`https://${host}${canonicalUri}${query ? '?' + query : ''}`, {
    method,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${R2.accessKeyId}/${scope}, `
                   + `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : body,
  });

  if (!res.ok && res.status !== 404) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`R2 ${method} ${key || R2.bucket} → ${res.status}: ${text}`);
  }
  return res;
}

// ── الواجهة العامة ───────────────────────────────────────

/**
 * أنواع لا تُعطى عنواناً عاماً مهما كان الإعداد.
 *
 * إيصالات التحويل تحمل اسم التاجر ورقم حسابه ومبلغه. هي اليوم
 * تُخدَم من الخادم بمسار يحمل بصمة المحتوى، ووضعها على نطاق
 * CDN عام يوسّع تعرّضها بلا داعٍ. تبقى خلف الخادم دائماً.
 */
const PRIVATE = /^stores\/\d+\/receipts\//;

/**
 * يحفظ كائناً ويعيد ما يُخزَّن في قاعدة البيانات.
 * @param {string} key  مثل stores/3/logo/ab12cd.jpg
 */
export async function put(key, buf, contentType) {
  if (driver === 'r2') {
    const isPrivate = PRIVATE.test(key);
    await signedFetch('PUT', key, buf, {
      'content-type': contentType,
      // الصور مُسمّاة ببصمة محتواها، فلا تتغيّر أبداً تحت المفتاح نفسه
      'cache-control': isPrivate
        ? 'private, max-age=31536000'
        : 'public, max-age=31536000, immutable',
    });
    return R2.publicUrl && !isPrivate ? `${R2.publicUrl}/${key}` : `/uploads/${key}`;
  }

  const full = path.join(config.paths.uploads, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) fs.writeFileSync(full, buf);
  return `/uploads/${key}`;
}

/** يحذف كل ما تحت بادئة — عند حذف متجر */
export async function dropPrefix(prefix) {
  if (driver !== 'r2') {
    fs.rmSync(path.join(config.paths.uploads, prefix), { recursive: true, force: true });
    return;
  }

  // السرد مُصفَّح: ألف مفتاح لكل صفحة، ونتابع بالرمز
  let token = '';
  do {
    const query = [
      'list-type=2',
      `prefix=${encodeURIComponent(prefix)}`,
      ...(token ? [`continuation-token=${encodeURIComponent(token)}`] : []),
    ].sort().join('&');

    const res = await signedFetch('GET', '', '', {}, query);
    const xml = await res.text();
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]));
    for (const key of keys) await signedFetch('DELETE', key);
    token = /<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? '';
  } while (token);
}

/**
 * يجلب كائناً — للسلال الخاصة التي لا عنوان عام لها،
 * فيمرّ الخادم بالصورة بدل أن يعيد توجيهاً إلى R2.
 * @returns {Promise<{buf: Buffer, type: string} | null>}
 */
export async function get(key) {
  if (driver !== 'r2') return null;
  const res = await signedFetch('GET', key);
  if (res.status === 404) return null;
  return {
    buf: Buffer.from(await res.arrayBuffer()),
    type: res.headers.get('content-type') ?? 'application/octet-stream',
  };
}

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

/** فحص إقلاع: هل السلة موجودة ومفاتيحها صالحة؟ */
export async function verifyStorage() {
  if (driver !== 'r2') return { ok: true, driver: 'local', where: config.paths.uploads };
  const probe = `_health/${Date.now()}.txt`;
  await put(probe, Buffer.from('rvios'), 'text/plain');
  await signedFetch('DELETE', probe);
  return { ok: true, driver: 'r2', where: R2.publicUrl || `${R2.bucket} (خاصة)` };
}
