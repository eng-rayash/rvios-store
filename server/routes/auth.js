// ═══════════════════════════════════════════════════════════
//  مسارات المصادقة والتسجيل (§٣.٢)
// ═══════════════════════════════════════════════════════════
import { db, now } from '../db.js';
import { json, readBody, bad, clean, rateLimit, clientIp, cookieHeader, parseCookies, HttpError } from '../http.js';
import {
  DEV, SHOW_CODE, SESSION_COOKIE, ADMIN_COOKIE, ADMIN_PASS,
  normalizePhone, validPhone, issueOtp, sendOtp, verifyOtp, assertResendAllowed,
  findOrCreateMerchant, createSession, destroySession,
  currentMerchant, requireMerchant, createAdminSession,
} from '../auth.js';
import { config } from '../config.js';
import { checkSlug, suggestSlug } from '../slug.js';
import { PLANS } from '../plans.js';
import { isSector, DEFAULT_SECTOR } from '../sectors.js';
import { saveImage } from '../uploads.js';
import { ensureSubscription, planPrices } from '../billing.js';
import { COUNTRIES, DEFAULT_COUNTRY } from '../countries.js';
import { verifyGoogleToken, googleStatus } from '../google.js';
import { saveProfile, linkGoogle, publicProfile, profileComplete, BUSINESS_TYPES } from '../profile.js';

/**
 * رسالة الخطأ تُبنى من `COUNTRIES` لا تُكتب يدوياً: إضافة دولة
 * سطرٌ واحد هناك، ولا يبقى نصّ يقول «أدخل رقماً يمنياً» بعد أن
 * صار الأردن مقبولاً.
 */
const PHONE_HINT = 'رقم الجوال غير صحيح — اكتبه برمز دولتك مثل ‎+967777123456 ('
  + Object.values(COUNTRIES).map((c) => c.name).join(' · ') + ')';

/** ملخّص متاجر التاجر لعقد الجلسة */
async function storeSummary(merchantId) {
  const stores = await db.prepare(`SELECT id, slug, name, logo, color, plan, status
                             FROM stores WHERE merchant_id = ? ORDER BY id`).all(merchantId);
  return stores.map((s) => ({ ...s, url: `/${s.slug}` }));
}

export default async function register(r) {

  // ── ١. طلب رمز تحقق ───────────────────────────────────
  r.post('/api/auth/request-code', async (req, res) => {
    const body = await readBody(req);
    // `country` اختياري: من يكتب رمز دولته صراحةً (+962…) لا يحتاجه،
    // ومن يكتب رقمه المحلي يحتاج من يقول لنا أيّ دولة يقصد.
    const phone = normalizePhone(body.phone, body.country);
    if (!validPhone(phone)) bad(PHONE_HINT);

    // §٢.٢ — حد على الرقم وعلى الـIP معاً (§٧ خطر ٢: استنزاف رصيد الرسائل)
    const windowMs = config.otp.windowMinutes * 60_000;
    await rateLimit(`otp:${phone}`,            { max: config.otp.perPhone, windowMs });
    await rateLimit(`otp-ip:${clientIp(req)}`, { max: config.otp.perIp,    windowMs });
    await assertResendAllowed(phone);

    const code = await issueOtp(phone);

    // فشل الإرسال يجب أن يظهر للمستخدم، لا أن يُبتلع صامتاً
    try {
      await sendOtp(phone, code);
    } catch (err) {
      console.error('✖ تعذّر إرسال رمز التحقق:', err.message);
      throw new HttpError(502, 'تعذّر إرسال رمز التحقق حالياً — حاول بعد قليل');
    }

    // §٢.٣ — الرد لا يكشف أبداً هل الرقم مسجّل مسبقاً.
    // كشف ذلك يحوّل نقطة التسجيل إلى أداة تعداد تفضح هوية تجارك.
    json(res, {
      ok: true,
      phone,
      expiresIn: config.otp.ttlMinutes * 60,
      // يظهر فقط في وضع التطوير بلا مزوّد فعلي
      devCode: SHOW_CODE ? code : undefined,
    });
  });

  // ── ٢. تأكيد الرمز → جلسة ─────────────────────────────
  r.post('/api/auth/verify', async (req, res) => {
    const body = await readBody(req);
    // التوحيد نفسه المستعمل عند الإصدار — وإلا صار مفتاح الرمز
    // مختلفاً عن مفتاح التحقّق وفشل كل رمز صحيح
    const phone = normalizePhone(body.phone, body.country);
    if (!validPhone(phone)) bad(PHONE_HINT);

    await verifyOtp(phone, body.code);

    const merchant = await findOrCreateMerchant(phone);
    const token = await createSession(merchant.id);
    const stores = await storeSummary(merchant.id);

    json(res, {
      ok: true,
      merchant: { id: merchant.id, phone: merchant.phone, name: merchant.name },
      stores,
      hasStore: stores.length > 0,
      slug: stores[0]?.slug ?? null,      // يبقى للتوافق مع الواجهات القائمة
    }, 200, { 'set-cookie': cookieHeader(SESSION_COOKIE, token) });
  });

  // ── ٣. من أنا ─────────────────────────────────────────
  r.get('/api/auth/me', async (req, res) => {
    const m = await currentMerchant(req);
    if (!m) return json(res, { authenticated: false });

    const stores = await storeSummary(m.id);
    const owned = stores.length;
    const slots = m.store_slots ?? 1;

    json(res, {
      authenticated: true,
      merchant: { id: m.id, phone: m.phone, name: m.name },
      stores,
      slots: { owned, slots, free: Math.max(0, slots - owned) },
      hasStore: owned > 0,
      slug: stores[0]?.slug ?? null,
      storeName: stores[0]?.name ?? null,
      // الإعداد يقرأ هذين ليعرف أين يستأنف: تاجر أكمل بياناته
      // ثم انقطع لا يُعاد إلى خطوة ملأها
      profile: publicProfile(m),
      google: googleStatus(),
    });
  });

  // ═══ التحقق من هوية التاجر ════════════════════════════

  // ── حالة تحقّق جوجل — تقرأها الواجهة قبل رسم الزر ──────
  //  حين لا يكون مضبوطاً تتخطّى الواجهة الخطوة بدل أن تعرض
  //  زراً لا يعمل: خادم تطوير بلا حساب Google Cloud يجب أن
  //  يُكمل الإعداد لا أن يتوقّف عنده.
  r.get('/api/auth/google/status', async (_req, res) => {
    json(res, googleStatus());
  });

  // ── ربط بريد جوجل بالحساب ─────────────────────────────
  r.post('/api/auth/google', async (req, res) => {
    const merchant = await requireMerchant(req);
    // رمز جوجل يُتحقّق منه بمفاتيحها، لكن حدّ المعدّل يبقى:
    // كل محاولة رحلةُ شبكة إلى جوجل، ولا نترك بابها مفتوحاً
    await rateLimit(`google:${clientIp(req)}`, { max: 10, windowMs: 10 * 60_000 });

    const body = await readBody(req);
    const claims = await verifyGoogleToken(body.credential);
    const m = await linkGoogle(merchant.id, claims);

    json(res, { ok: true, profile: publicProfile(m) });
  });

  // ── بيانات التاجر ─────────────────────────────────────
  r.get('/api/me/profile', async (req, res) => {
    const merchant = await requireMerchant(req);
    json(res, {
      profile: publicProfile(merchant),
      businessTypes: Object.entries(BUSINESS_TYPES).map(([id, label]) => ({ id, label })),
      google: googleStatus(),
    });
  });

  r.patch('/api/me/profile', async (req, res) => {
    const merchant = await requireMerchant(req);
    const body = await readBody(req);
    // `partial` أثناء الإعداد: التاجر يحفظ خطوةً نصفَها مكتمل
    // ولا يُطالَب بكل الحقول قبل أن يصل إليها
    const m = await saveProfile(merchant.id, body, { partial: body.partial === true });
    json(res, { ok: true, profile: publicProfile(m) });
  });

  // ── ٤. خروج ───────────────────────────────────────────
  r.post('/api/auth/logout', async (req, res) => {
    await destroySession(parseCookies(req)[SESSION_COOKIE]);
    json(res, { ok: true }, 200, { 'set-cookie': cookieHeader(SESSION_COOKIE, '', { clear: true }) });
  });

  // ── ٥. فحص فوري لتوفر الرابط (§٣.٢) ───────────────────
  r.get('/api/slug/check', async (req, res) => {
    const raw = req.query.get('q') ?? '';
    if (!raw.trim()) return json(res, { slug: '', ok: false, reason: 'اكتب اسم متجرك' });
    const result = await checkSlug(raw);
    json(res, { ...result, suggestion: result.ok ? null : await suggestSlug(raw) });
  });

  // ── ٦. إنشاء المتجر — نهاية تدفق الإعداد (§٣.٢) ────────
  r.post('/api/stores', async (req, res) => {
    const merchant = await requireMerchant(req);
    const body = await readBody(req);

    // خانات المتاجر: التاجر يبدأ بواحدة، والإضافية تُشترى (برو)
    const owned = (await db.prepare('SELECT COUNT(*) n FROM stores WHERE merchant_id = ?').get(merchant.id)).n;
    if (owned >= (merchant.store_slots ?? 1)) {
      bad('بلغتَ عدد المتاجر المتاح في حسابك. اشترِ خانة متجر إضافي من قسم الاشتراك.', 'NO_STORE_SLOT');
    }

    /**
     * التحقق عند إنشاء المتجر الأول.
     *
     * على المتجر الأول وحده: التاجر يُعرَّف مرة، ومتجره الثاني
     * يرث تعريفاً قائماً — إعادة سؤاله عبثٌ يوهم بأننا نسينا.
     *
     * والبريد يُشترط فقط حين يكون تحقّق جوجل مضبوطاً على هذا
     * الخادم. اشتراطه بلا مفتاح يوقف كل إنشاء متجر في التطوير
     * وفي أي نشرٍ لم يُربط بجوجل بعد.
     */
    if (owned === 0) {
      if (!profileComplete(merchant)) {
        bad('أكمل بياناتك الشخصية قبل إنشاء متجرك', 'PROFILE_INCOMPLETE');
      }
      if (config.google.enabled && !merchant.email_verified) {
        bad('وثّق بريدك عبر جوجل قبل إنشاء متجرك', 'EMAIL_UNVERIFIED');
      }
    }

    const name = clean(body.name, 60);
    if (name.length < 2) bad('اسم المتجر مطلوب');

    const check = await checkSlug(body.slug || name);
    if (!check.ok) bad(check.reason);

    // الدولة قبل الرقم: هي ما يجعل `790123456` أردنياً لا يمنياً
    const country = String(body.country || '').toUpperCase() || DEFAULT_COUNTRY;
    if (!COUNTRIES[country]) bad('دولة غير مدعومة');

    const whatsapp = normalizePhone(body.whatsapp || merchant.phone, country);
    if (!validPhone(whatsapp)) bad('رقم واتساب المتجر غير صحيح');

    /**
     * المتجر الإضافي يرث باقة الحساب: التاجر دفع برو ثم دفع خانة
     * بسعر مخفّض — لو بدأ متجره الثاني بحدود المجانية لكان اشترى خانة
     * بلا قيمة. الأول يبدأ بالمجانية كالمعتاد.
     */
    const inherited = owned === 0 ? 'basic'
      : (await db.prepare(`SELECT plan FROM stores WHERE merchant_id = ?
                    ORDER BY CASE plan WHEN 'pro' THEN 3 WHEN 'plus' THEN 2 ELSE 1 END DESC
                    LIMIT 1`).get(merchant.id))?.plan ?? 'basic';

    const storeId = Number((await db.prepare(`
      INSERT INTO stores (merchant_id, slug, name, sector, tagline, city, whatsapp, color, color_deep, plan, country, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        merchant.id, check.slug, name,
        isSector(body.sector) ? body.sector : DEFAULT_SECTOR,
        clean(body.tagline, 120),
        clean(body.city, 40),
        whatsapp,
        /^#[0-9A-Fa-f]{6}$/.test(body.color ?? '') ? body.color : '#9E2226',
        /^#[0-9A-Fa-f]{6}$/.test(body.colorDeep ?? '') ? body.colorDeep : '#6E1519',
        inherited,
        country,
        now(),
      )).lastInsertRowid);

    // كل متجر يحتاج صف اشتراك — لم تكن تُستدعى عند الإنشاء إطلاقاً
    await ensureSubscription(storeId, inherited);

    // الصور تُحفظ كملفات بعد توفّر store_id (§٥.٣)
    const logo   = await saveImage(storeId, 'logo', body.logo);
    const banner = await saveImage(storeId, 'banner', body.banner);
    if (logo || banner) {
      await db.prepare('UPDATE stores SET logo = ?, banner = ? WHERE id = ?').run(logo, banner, storeId);
    }

    // اسم التاجر يُكتب مرة واحدة — لا يُدهس عند إنشاء متجر ثانٍ
    if (!merchant.name && body.ownerName && owned === 0) {
      await db.prepare('UPDATE merchants SET name = ? WHERE id = ?').run(clean(body.ownerName, 60), merchant.id);
    }

    // منتج أول اختياري (§٣.٢ الخطوة ٦ — قابلة للتخطي)
    let firstProduct = null;
    if (body.product?.name) {
      const { scope } = await import('../tenancy.js');
      firstProduct = await scope(storeId).insert('products', {
        name: clean(body.product.name, 100),
        price: Math.max(0, Number(body.product.price) || 0),
        qty: Math.max(0, Number(body.product.qty) || 1),
        image: await saveImage(storeId, 'products', body.product.image),
        live: 1,
        created_at: now(),
      });
    }

    json(res, { ok: true, slug: check.slug, storeId, firstProduct }, 201);
  });

  // ── ٧. الباقات (عامة — لصفحة الأسعار) ─────────────────
  r.get('/api/plans', async (_req, res) => {
    const prices = await planPrices();
    json(res, Object.values(PLANS).map((p) => ({
      ...p,
      products: p.products === Infinity ? null : p.products,
      // السعر المعروض للعملاء يأتي من الإعدادات لا من الكود (§١١)
      price: prices[p.id] ?? null,
    })));
  });

  // ── ٨. دخول الإدارة ───────────────────────────────────
  r.post('/api/admin/login', async (req, res) => {
    await rateLimit(`admin:${clientIp(req)}`, { max: 6, windowMs: 10 * 60_000 });
    const body = await readBody(req);
    if (String(body.pass ?? '') !== ADMIN_PASS) throw new HttpError(401, 'كلمة المرور غير صحيحة');
    const token = await createAdminSession();
    json(res, { ok: true }, 200, { 'set-cookie': cookieHeader(ADMIN_COOKIE, token, { maxAge: 60 * 60 * 12 }) });
  });

  r.post('/api/admin/logout', async (req, res) => {
    await destroySession(parseCookies(req)[ADMIN_COOKIE]);
    json(res, { ok: true }, 200, { 'set-cookie': cookieHeader(ADMIN_COOKIE, '', { clear: true }) });
  });
}
