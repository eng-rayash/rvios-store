// ═══════════════════════════════════════════════════════════
//  RVIOS Store — الخادم
//  §٥.٢ التوجيه: rviosstore.com/اسم-المتجر (path-based)
// ═══════════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { config, assertConfig } from './config.js';
import { log, newRequestId, logRequest } from './logger.js';
import { db, ROOT, migrate } from './db.js';
import { verifyIsolation } from './tenancy.js';
import { createRouter } from './router.js';
import { HttpError, json, parseCookies, SECURITY_HEADERS } from './http.js';
import { cleanupExpired, DEV, ADMIN_PASS } from './auth.js';
import { RESERVED } from './slug.js';
import { renderStore, renderSitemap, renderRobots } from './render.js';
import { providerStatus } from './notify.js';
import { runSubscriptionSweep, runReminderSweep } from './billing.js';
import { startBackups, backupNow } from './backup.js';
import { get as storageGet, verifyStorage } from './storage.js';

/**
 * الإعداد يُتحقَّق منه قبل أي شيء آخر.
 * إعداد خاطئ يجب أن يوقف الإقلاع بخطأ واضح، لا أن يظهر بعد
 * ساعات كسلوك غريب — أو أسوأ: كلوحة إدارة بكلمة مرور معروفة.
 */
assertConfig(log);

/** أصل الطلب — يحترم الوكيل العكسي في الإنتاج */
function originOf(req) {
  if (config.publicUrl) return config.publicUrl;
  const proto = req.headers['x-forwarded-proto'] || (config.isProd ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

import registerAuth     from './routes/auth.js';
import registerMerchant from './routes/merchant.js';
import registerPublic   from './routes/public.js';
import registerAdmin    from './routes/admin.js';
import registerWebhook  from './routes/webhook.js';

const PORT       = config.port;
const PUBLIC_DIR = config.paths.public;

// ── المخطّط ثم فحص العزل، قبل قبول أي طلب ────────────────
//  الترتيب مقصود: الفحص يقرأ information_schema، فلا معنى له
//  قبل إنشاء الجداول.
await migrate();
await verifyIsolation();

// التخزين يُفحص هنا لا عند أول رفع: تاجر يكتشف أن مفاتيح
// السلة خاطئة بعد أن يملأ متجره صوراً تجربة سيئة جداً.
{
  const s = await verifyStorage();
  log.info(`✓ التخزين: ${s.driver} — ${s.where}`);
}

const router = createRouter();
registerAuth(router);
registerMerchant(router);
registerPublic(router);
registerAdmin(router);
registerWebhook(router);

// ── ملفات ثابتة ──────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.png':  'image/png',  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * الأنواع التي يستحقّ ضغطها.
 * الصور مضغوطة أصلاً — إعادة ضغطها تستهلك المعالج وتزيد الحجم.
 */
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);

/**
 * أفضل ترميز يقبله المتصفح.
 * brotli أصغر من gzip بنحو ١٥٪، وهذا فارق ملموس على شبكة بطيئة
 * حيث يُقاس التحميل بالثواني لا بالمللي ثانية (§٨ خطر ١).
 */
function encodingFor(req) {
  const accept = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

function compressor(encoding) {
  return encoding === 'br'
    ? zlib.createBrotliCompress({
      params: {
        // الجودة ٤ توازن: قريبة من ١١ حجماً، وأسرع منها أضعافاً
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      },
    })
    : zlib.createGzip({ level: 6 });
}

/** يرسل نصاً مضغوطاً إن كان ذلك مجدياً، وإلا خاماً */
export function sendBody(req, res, body, contentType, extraHeaders = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  const enc = config.compression.enabled && buf.length >= config.compression.minBytes
    ? encodingFor(req) : null;

  const headers = { 'content-type': contentType, ...extraHeaders };

  if (!enc) {
    res.writeHead(200, { ...headers, 'content-length': buf.length });
    res.end(buf);
    return;
  }

  // Vary إلزامي: بدونه قد يخدم وسيط نسخة مضغوطة لمتصفح لا يفهمها
  const done = (out) => {
    res.writeHead(200, { ...headers, 'content-encoding': enc, 'content-length': out.length, vary: 'Accept-Encoding' });
    res.end(out);
  };
  const fn = enc === 'br' ? zlib.brotliCompress : zlib.gzip;
  fn(buf, (err, out) => (err ? (res.writeHead(200, { ...headers, 'content-length': buf.length }), res.end(buf)) : done(out)));
}

function serveFile(req, res, filePath, { immutable = false } = {}) {
  let stat;
  try { stat = fs.statSync(filePath); }
  catch { return false; }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    // §٥.٣ — الصور تُخدم بذاكرة تخزين طويلة، وهي أثقل بند
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(ext === '.html' ? SECURITY_HEADERS : {}),
  };

  const enc = config.compression.enabled
    && COMPRESSIBLE.has(ext)
    && stat.size >= config.compression.minBytes
    ? encodingFor(req) : null;

  if (!enc) {
    res.writeHead(200, { ...headers, 'content-length': stat.size });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // الحجم غير معروف قبل الضغط — نبثّه بلا content-length
  res.writeHead(200, { ...headers, 'content-encoding': enc, vary: 'Accept-Encoding' });
  pipeline(fs.createReadStream(filePath), compressor(enc), res, (err) => {
    // ECONNRESET طبيعي: المستخدم أغلق الصفحة قبل اكتمال التحميل
    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE' && err.code !== 'ECONNRESET') {
      log.warn({ file: filePath, err: err.message }, 'تعذّر بثّ ملف مضغوط');
    }
  });
  return true;
}

/** يمنع الخروج من مجلد public عبر ../ */
function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  return p.startsWith(base) ? p : null;
}

// ── الخادم ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const started = performance.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  req.query = url.searchParams;

  /**
   * معرّف يربط كل سطر سجل بالطلب الذي أنتجه.
   * يُعاد في الترويسة أيضاً، فيمكن للتاجر أن يقتبسه عند الشكوى
   * فنجد الطلب في السجل فوراً بدل التخمين من الوقت التقريبي.
   */
  req.id = newRequestId();
  req.log = log.child({ req: req.id });
  res.setHeader('x-request-id', req.id);

  const isAsset = pathname.startsWith('/assets/') || pathname.startsWith('/uploads/');
  res.on('finish', () => logRequest(req.log, {
    method: req.method, pathname, status: res.statusCode,
    ms: performance.now() - started, isAsset,
  }));

  try {
    // ٠. فحص الحياة — يسبق كل شيء ليبقى رخيصاً وسريعاً
    if (pathname === '/health' || pathname === '/healthz') {
      return await health(res);
    }

    // ١. الـ API
    if (pathname.startsWith('/api/')) {
      const hit = router.match(req.method, pathname);
      if (!hit) {
        const allowed = router.allowed(pathname);
        if (allowed.length) throw new HttpError(405, `الطريقة غير مدعومة — المتاح: ${allowed.join(', ')}`);
        throw new HttpError(404, 'مسار غير معروف');
      }
      req.params = hit.params;
      await hit.handler(req, res);
      return;
    }

    // ٢. الأصول الثابتة
    if (pathname.startsWith('/assets/')) {
      const file = safeJoin(PUBLIC_DIR, pathname);
      if (file && serveFile(req, res, file, { immutable: pathname.startsWith('/assets/img/') })) return;
      throw new HttpError(404, 'الملف غير موجود');
    }

    // ٣. صور المتاجر المرفوعة
    if (pathname.startsWith('/uploads/')) {
      const file = safeJoin(config.paths.data, pathname);
      if (file && serveFile(req, res, file, { immutable: true })) return;

      // سلة R2 خاصة (بلا نطاق عام): نمرّ بالصورة بأنفسنا.
      // مع R2_PUBLIC_URL لا يصل الطلب إلى هنا أصلاً — العنوان
      // المخزَّن يشير إلى Cloudflare مباشرة.
      if (config.storage.driver === 'r2') {
        const object = await storageGet(pathname.slice('/uploads/'.length));
        if (object) {
          sendBody(req, res, object.buf, object.type, {
            'cache-control': 'public, max-age=31536000, immutable',
          });
          return;
        }
      }
      throw new HttpError(404, 'الصورة غير موجودة');
    }

    // ٣.٥ ملفات الفهرسة — تُولَّد من قاعدة البيانات
    if (pathname === '/sitemap.xml') {
      const stores = await db.prepare(`SELECT slug, created_at FROM stores WHERE status='active' ORDER BY id`).all();
      sendBody(req, res, renderSitemap(stores, originOf(req)), 'application/xml; charset=utf-8');
      return;
    }
    if (pathname === '/robots.txt') {
      sendBody(req, res, renderRobots(originOf(req)), 'text/plain; charset=utf-8');
      return;
    }

    // ٣.٦ ملفات تطبيق الويب التقدّمي
    /**
     * عامل الخدمة من الجذر لا من /assets: نطاق العامل محدود
     * بمجلده، فوضعه في /assets يمنعه من التحكّم بصفحات المتاجر.
     *
     * ولا يُخزَّن أبداً (no-store): متصفح يحتفظ بنسخة قديمة منه
     * يظل يخدم أصولاً قديمة إلى الأبد، وهو أسوأ عطل في هذا الباب.
     */
    if (pathname === '/sw.js') {
      const file = path.join(PUBLIC_DIR, 'sw.js');
      if (fs.existsSync(file)) {
        /**
         * بلا ضغط: الملف ٤ كيلوبايت ويُجلَب مرة عند كل تحديث،
         * فالضغط بلا قيمة هنا. وتبسيط هذا المسار يزيل متغيّراً
         * من أكثر مواضع النشر إبهاماً في التشخيص.
         *
         * no-store مقصود: متصفح يحتفظ بنسخة قديمة من العامل
         * يظل يخدم أصولاً قديمة إلى الأبد بعد النشر.
         */
        const body = fs.readFileSync(file);
        res.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'content-length': body.length,
          'cache-control': 'no-store',
          'service-worker-allowed': '/',
        });
        res.end(body);
        return;
      }
    }
    if (pathname === '/manifest.json' || pathname === '/offline.html') {
      const file = path.join(PUBLIC_DIR, pathname.slice(1));
      if (serveFile(req, res, file)) return;
    }

    /**
     * ‏/favicon.ico — يطلبه المتصفح من الجذر تلقائياً مع كل صفحة
     * دون أن يذكره HTML. بلا هذا السطر كان كل تحميل صفحة يُنتج
     * ٤٠٤ في سجل الخادم وفي وحدة تحكّم المتصفح، فيغرق الضجيجُ
     * الأخطاءَ الحقيقية وقت التشخيص.
     */
    if (pathname === '/favicon.ico') {
      if (serveFile(req, res, path.join(PUBLIC_DIR, 'favicon.ico'), { immutable: true })) return;
    }

    /**
     * ٤. صفحات المنصة الباقية هنا.
     *
     * الرئيسية والأسعار والقطاعات و«عن» و«تواصل» و«القانونية» انتقلت
     * إلى تطبيق Next في `src/app`، وهي تُمرَّر إليه لا إلينا. ما بقي
     * هو ما لم يُرحَّل بعد — وهو نفسه `LEGACY_PAGES` في
     * `next.config.ts`: القائمتان تقصران معاً، وأي زيادة في
     * إحداهما بلا الأخرى تعني صفحةً تُخدم مرّتين أو لا تُخدم أصلاً.
     */
    const PAGES = {
      '/login':      'login.html',
      '/track':      'track.html',
      '/onboarding': 'onboarding.html',
      '/dashboard':  'dashboard.html',
      '/admin':      'admin.html',
    };
    const page = PAGES[pathname.replace(/\/$/, '') || '/'];
    if (page && serveFile(req, res, path.join(PUBLIC_DIR, page))) return;

    // ٥. رابط المتجر: /username  (§٥.٢)
    const seg = pathname.split('/').filter(Boolean);
    if (seg.length === 1 && !RESERVED.has(seg[0])) {
      const store = await db.prepare('SELECT * FROM stores WHERE slug = ?').get(seg[0]);
      if (store && store.status === 'active') {
        // HTML مولّد من الخادم: واتساب ومحركات البحث لا تنفّذ JS
        const shell = fs.readFileSync(path.join(PUBLIC_DIR, 'store.html'), 'utf8');
        sendBody(req, res, await renderStore(shell, store, originOf(req)), 'text/html; charset=utf-8',
          { 'cache-control': 'no-cache', ...SECURITY_HEADERS });
        return;
      }
      if (store) {
        // موقوف — نخدم القشرة، والـ API يردّ ٤١٠ فتعرض الواجهة السبب
        if (serveFile(req, res, path.join(PUBLIC_DIR, 'store.html'))) return;
      }

      // §٣.٣ — رابط قديم؟ حوّل ٣٠١ بدل أن تكسر ما نُشر في واتساب
      const moved = await db.prepare(`
        SELECT s.slug FROM store_slug_history h
        JOIN stores s ON s.id = h.store_id
        WHERE h.old_slug = ? AND s.status = 'active'`).get(seg[0]);
      if (moved) {
        res.writeHead(301, {
          location: '/' + encodeURIComponent(moved.slug) + (url.search || ''),
          'cache-control': 'public, max-age=86400',
        });
        res.end();
        return;
      }
      // رابط غير موجود → صفحة ٤٠٤ مخصّصة تقترح إنشاء متجر
      const notFoundPage = path.join(PUBLIC_DIR, '404.html');
      if (fs.existsSync(notFoundPage)) {
        const body = fs.readFileSync(notFoundPage);
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'content-length': body.length });
        res.end(body);
        return;
      }
      throw new HttpError(404, 'لا يوجد متجر بهذا الرابط');
    }

    throw new HttpError(404, 'الصفحة غير موجودة');

  } catch (err) {
    const status = err.status ?? 500;
    /**
     * ٥٠٠ يعني خللاً فينا: نسجّل الأثر كاملاً ونُخفيه عن المستخدم.
     * رسالة الاستثناء قد تحمل مسار ملف أو جزء استعلام، وكشفها
     * يعطي مهاجماً خريطة مجانية للنظام.
     */
    if (status >= 500) {
      req.log.error({ method: req.method, path: pathname, err: err.message, stack: err.stack }, 'خطأ غير متوقع');
    }
    if (res.headersSent) return res.end();
    json(res, {
      error: status >= 500 && config.isProd
        ? `حدث خطأ غير متوقع — اذكر الرقم ${req.id} عند التواصل مع الدعم`
        : (err.message || 'خطأ غير متوقع'),
      code: err.code ?? '',
      requestId: req.id,
    }, status);
  }
});

// ── فحص الحياة (§٦.٧) ────────────────────────────────────
//  يجيب على سؤال الوكيل العكسي: هل أوجّه الطلبات لهذه النسخة؟
//  استعلام حقيقي على القاعدة — خادم يردّ بينما قاعدته مقفلة
//  «حيّ» شكلاً وميّت فعلاً، وهذا أسوأ من التوقف الصريح.
let shuttingDown = false;
const startedAt = Date.now();

async function health(res) {
  if (shuttingDown) {
    return json(res, { ok: false, status: 'shutting_down' }, 503);
  }
  try {
    const stores = (await db.prepare('SELECT COUNT(*) n FROM stores').get()).n;
    json(res, {
      ok: true,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      stores,
      env: config.env,
      version: VERSION,
    }, 200, { 'cache-control': 'no-store' });
  } catch (err) {
    log.error({ err: err.message }, 'فحص الحياة فشل — القاعدة لا تستجيب');
    json(res, { ok: false, error: 'قاعدة البيانات لا تستجيب' }, 503);
  }
}

const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; }
  catch { return '0.0.0'; }
})();

// تنظيف دوري للجلسات والرموز المنتهية
const timers = [];
timers.push(setInterval(cleanupExpired, 60 * 60 * 1000));
await cleanupExpired();

// §٥.٥ — تدرّج انتهاء الاشتراك: نشط ← مهلة ← منتهٍ (بلا حذف)
async function sweep() {
  try {
    const changed = await runSubscriptionSweep();
    if (changed.toGrace || changed.toExpired) {
      log.info({ ...changed }, `اشتراكات: ${changed.toGrace} إلى المهلة · ${changed.toExpired} انتهت`);
    }
  } catch (err) {
    log.error({ err: err.message }, 'تعذّر تحديث الاشتراكات');
  }

  // التذكيرات منفصلة عن الكنس: فشل إرسالٍ لا يجوز أن يمنع
  // انتقال بقية الاشتراكات إلى حالتها الصحيحة
  try {
    const sent = await runReminderSweep();
    if (sent.d7 || sent.d1) {
      log.info({ ...sent }, `تذكيرات تجديد: ${sent.d7} قبل أسبوع · ${sent.d1} قبل يوم`);
    }
  } catch (err) {
    log.error({ err: err.message }, 'تعذّر إرسال تذكيرات التجديد');
  }
}
timers.push(setInterval(sweep, 6 * 60 * 60 * 1000));
await sweep();

timers.push(startBackups());
for (const t of timers) t?.unref?.();

// ═══════════════════════════════════════════════════════════
//  إيقاف رشيد
//  القتل الفوري يقطع طلباً في منتصفه: تاجر يرفع صورة منتج
//  يخسر رفعه، وعميل يؤكّد طلباً لا يدري أوصل أم لا.
// ═══════════════════════════════════════════════════════════
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'إيقاف رشيد — لا طلبات جديدة، ننتظر الجارية');

  // نتوقّف عن القبول، ثم ننتظر انتهاء ما هو قيد التنفيذ
  server.close(async () => {
    for (const t of timers) clearInterval(t);
    try { await backupNow('shutdown'); } catch { /* لا نمنع الإيقاف */ }
    try { await db.close(); } catch { /* ربما أُغلقت */ }
    log.info('انتهى الإيقاف بسلام');
    process.exit(0);
  });

  // شبكة أمان: طلب معلّق لا يجوز أن يحتجز النشر إلى الأبد
  setTimeout(() => {
    log.warn('انقضت مهلة الإيقاف — إنهاء قسري');
    process.exit(1);
  }, 15_000).unref();
}

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => shutdown(sig));

/**
 * خطأ لم يلتقطه أحد: نسجّله ثم نخرج.
 * المتابعة بحالة مجهولة أخطر من إعادة التشغيل — مدير العمليات
 * سيُعيدنا خلال ثانية، والحالة المشوّهة تبقى ساعات.
 */
process.on('uncaughtException', (err) => {
  log.error({ err: err.message, stack: err.stack }, 'استثناء غير ملتقَط');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log.error({ err: String(reason?.message ?? reason) }, 'وعد مرفوض بلا معالجة');
});

server.listen(PORT, config.host, async () => {
  const storeCount = (await db.prepare('SELECT COUNT(*)::int n FROM stores').get()).n;

  if (config.log.json) {
    log.info({ port: PORT, env: config.env, stores: storeCount, version: VERSION }, 'RVIOS Store يعمل');
    return;
  }

  console.log(`
  ╭──────────────────────────────────────────────╮
  │   RVIOS Store — يعمل الآن                    │
  ╰──────────────────────────────────────────────╯

   الموقع        http://localhost:${PORT}/
   لوحة التاجر   http://localhost:${PORT}/dashboard
   لوحة الإدارة  http://localhost:${PORT}/admin${DEV ? `     (كلمة المرور: ${ADMIN_PASS})` : ''}
   إنشاء متجر    http://localhost:${PORT}/onboarding
   فحص الحياة    http://localhost:${PORT}/health

   المتاجر في قاعدة البيانات: ${storeCount}
   الوضع: ${DEV ? 'تطوير' : 'إنتاج'}  ·  الإصدار: ${VERSION}
   الضغط: ${config.compression.enabled ? 'brotli/gzip ✓' : 'معطّل'}
   إرسال رمز التحقق: ${providerStatus()}
`);
});
