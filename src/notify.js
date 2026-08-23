// ═══════════════════════════════════════════════════════════
//  طبقة الإرسال — رموز التحقق وإشعارات الطلبات
//
//  مزوّد واحد قابل للتبديل بمتغيّر بيئة، فلا يتغيّر أي كود
//  آخر عند الانتقال من التطوير إلى الإنتاج.
//
//      OTP_PROVIDER=console    الافتراضي — يطبع الرمز (تطوير)
//      OTP_PROVIDER=whatsapp   واتساب Cloud API من Meta
//      OTP_PROVIDER=sms        أي بوابة SMS عبر HTTP
//
//  إشعار التاجر بالطلب الجديد يمرّ من هنا أيضاً، لأن §٣.٣
//  تعتبر سرعة رد التاجر عنق الزجاجة الحقيقي — والطلب الذي
//  لا يعلم به التاجر لا قيمة له.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { config } from './config.js';
import { db, now } from './db.js';

export const OTP_PROVIDER = config.otp.provider;
// الرمز يُعرض في الرد فقط حين تكون الطباعة قناة فعلية — وحتى
// حينها يبقى محكوماً بوضع التطوير في auth.js
export const DEV_SHOWS_CODE = OTP_PROVIDER.split(',').some((s) => s.trim() === 'console');

const intl = (p) => `967${p}`;

// ── ١. وضع التطوير ───────────────────────────────────────
async function viaConsole(phone, code) {
  console.log(`\n  ✉  رمز التحقق للرقم ${intl(phone)} هو: ${code}\n`);
  return { ok: true, provider: 'console' };
}

// ═══════════════════════════════════════════════════════════
//  واتساب Cloud API — نداء واحد مركزي
// ═══════════════════════════════════════════════════════════

/**
 * توقيع الرمز بسرّ التطبيق (§٧ خطر ٢).
 * بدونه، رمزٌ مسروق من سجلّاتنا يعمل من أي جهاز في العالم.
 * معه، لا يعمل إلا ممّن يملك سرّ التطبيق أيضاً — أي من خادمنا وحده.
 */
function appSecretProof(token) {
  const secret = config.meta.appSecret;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

/**
 * ترجمة أخطاء Meta إلى رسائل تقول ما العمل.
 * الرد الخام من Graph API يقول «(#132001) Template not found»
 * وهذا لا يفيد مَن يقرأ السجل عند الثالثة فجراً.
 */
function explainMetaError(status, body) {
  let err = null;
  try { err = JSON.parse(body)?.error ?? null; } catch { /* ليس JSON */ }

  const code = err?.code;
  const sub = err?.error_subcode;
  const msg = err?.message ?? body.slice(0, 200);

  const HINTS = {
    190: 'الرمز منتهٍ أو مُبطَل — أنشئ رمزاً دائماً من مستخدم نظام في لوحة Meta',
    100: 'معرّف الرقم (WA_PHONE_ID) غير صحيح أو لا ينتمي لهذا التطبيق',
    131030: 'الرقم المستقبِل غير مُدرج في قائمة أرقام الاختبار — أضفه في لوحة Meta أو انقل التطبيق للوضع المباشر',
    132001: `القالب «${config.whatsapp.template}» غير موجود أو غير معتمد بلغة «${config.whatsapp.lang}»`,
    133010: 'الرقم غير مسجَّل في Cloud API — سجّله من WhatsApp Manager (خطوة Register) قبل الإرسال',
    133005: 'رمز التحقق المكوّن من ٦ أرقام (رمز PIN) غير صحيح عند تسجيل الرقم',
    132000: 'عدد المتغيّرات لا يطابق ما يتوقّعه القالب المعتمد',
    131047: 'انقضت نافذة الـ٢٤ ساعة — لا يمكن إرسال رسالة حرّة، استخدم قالباً معتمداً',
    131056: 'تجاوزتَ حدّ التكرار لهذا الرقم — أمهله قليلاً',
    80007: 'بلغتَ حدّ معدّل الإرسال في حسابك',
  };

  const hint = HINTS[code] ?? (sub === 2494049 ? 'الحساب في وضع الاختبار' : null);
  return `واتساب رفض الإرسال (${status}${code ? `/${code}` : ''}): ${msg}${hint ? ` — ${hint}` : ''}`;
}

/**
 * تسجيل رسالة صادرة كي يجد الـWebhook ما يُحدّثه لاحقاً.
 * لا يُفشل الإرسال أبداً: فشل السجل مشكلة قياس لا مشكلة تسليم.
 */
function trackOutbound(wamid, phone, kind) {
  if (!wamid) return;
  try {
    const t = now();
    db.prepare(`INSERT OR REPLACE INTO wa_messages
                (wamid, phone, kind, status, sent_at, updated_at)
                VALUES (?,?,?,'sent',?,?)`).run(wamid, phone, kind, t, t);
  } catch (err) {
    console.error('✖ تعذّر تسجيل رسالة واتساب:', err.message);
  }
}

/** نداء Graph API واحد يمرّ منه كل شيء: التوقيع، المهلة، وترجمة الخطأ */
async function graph(path, payload, { method = 'POST' } = {}) {
  const { token, version } = config.whatsapp;
  if (!token) throw new Error('واتساب غير مضبوط — يلزم META_TOKEN');

  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  const proof = appSecretProof(token);
  if (proof) url.searchParams.set('appsecret_proof', proof);

  // مهلة صريحة: بدونها يعلّق طلب التاجر حتى تستسلم الشبكة
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(explainMetaError(res.status, text));
  try { return JSON.parse(text); } catch { return {}; }
}

// ── ٢. واتساب — رمز التحقق ───────────────────────────────
//  الأنسب لليمن: الانتشار شبه شامل، والتسليم أوثق من SMS.
async function viaWhatsApp(phone, code) {
  const { phoneId, template, lang } = config.whatsapp;
  if (!phoneId) throw new Error('واتساب غير مضبوط — يلزم WA_PHONE_ID');

  const out = await graph(`${phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to: intl(phone),
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        // قوالب المصادقة في Meta تتطلب زر النسخ بنفس الرمز
        { type: 'button', sub_type: 'url', index: '0',
          parameters: [{ type: 'text', text: code }] },
      ],
    },
  });

  const wamid = out?.messages?.[0]?.id ?? null;
  trackOutbound(wamid, phone, 'otp');
  return { ok: true, provider: 'whatsapp', id: wamid };
}

// ── ٣. بوابة SMS عامة ────────────────────────────────────
//  تناسب أي مزوّد محلي يقبل طلب HTTP. اضبط القالب:
//      SMS_URL=https://gateway.example/send?to={phone}&msg={text}&key=ABC
//  أو استخدم SMS_METHOD=POST مع SMS_BODY كقالب JSON.
async function viaSms(phone, code) {
  const urlTemplate = config.sms.url;
  if (!urlTemplate) throw new Error('بوابة SMS غير مضبوطة — يلزم SMS_URL');

  const text = config.sms.text.replace('{code}', code);

  const fill = (s) => s
    .replaceAll('{phone}', encodeURIComponent(intl(phone)))
    .replaceAll('{code}', encodeURIComponent(code))
    .replaceAll('{text}', encodeURIComponent(text));

  const method = config.sms.method;
  const url = fill(urlTemplate);

  const init = { method, signal: AbortSignal.timeout(15_000) };
  if (method === 'POST' && config.sms.body) {
    init.headers = { 'content-type': 'application/json' };
    // القالب يُملأ بقيم غير مُرمَّزة داخل JSON
    init.body = config.sms.body
      .replaceAll('{phone}', intl(phone))
      .replaceAll('{code}', code)
      .replaceAll('{text}', text);
  }
  if (config.sms.auth) {
    init.headers = { ...init.headers, authorization: config.sms.auth };
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`فشل إرسال SMS (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return { ok: true, provider: 'sms' };
}

const PROVIDERS = { console: viaConsole, whatsapp: viaWhatsApp, sms: viaSms };

/**
 * سلسلة القنوات: OTP_PROVIDER=whatsapp,sms
 * تُجرَّب بالترتيب حتى تنجح واحدة.
 *
 * السبب أن عطل قناة واحدة لا يجوز أن يُغلق التسجيل كله: تاجر
 * لا يصله الرمز هو تاجر خسرناه، ولن يعاود المحاولة غداً.
 */
export const OTP_CHAIN = OTP_PROVIDER.split(',').map((s) => s.trim()).filter(Boolean);

/** يرسل رمز التحقق عبر أول قناة تنجح */
export async function deliverOtp(phone, code) {
  const failures = [];

  for (const name of OTP_CHAIN) {
    const send = PROVIDERS[name];
    if (!send) { failures.push(`${name}: مزوّد غير معروف`); continue; }
    try {
      const out = await send(phone, code);
      if (failures.length) {
        console.warn(`  ↩ تحوّلنا إلى ${name} بعد فشل: ${failures.join(' · ')}`);
      }
      return out;
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(failures.join(' · ') || 'لا توجد قناة إرسال مضبوطة');
}

// ═══════════════════════════════════════════════════════════
//  إشعار التاجر بطلب جديد
//  لا يُفشل الطلب أبداً إن تعذّر الإرسال — الطلب مسجّل فعلاً،
//  والإشعار تحسين لا شرط.
// ═══════════════════════════════════════════════════════════
/**
 * رسالة نصّية للتاجر — تذكيرات الاشتراك وما شابهها.
 *
 * ملاحظة عن نافذة الـ٢٤ ساعة: الرسائل الحرّة لا تصل إلا داخلها.
 * التذكير يأتي غالباً بعد صمت طويل، فالأرجح أن يُرفض. القالب
 * المعتمد هو الحل الصحيح، ويلزمه إنشاؤه في لوحة Meta أولاً —
 * حتى ذلك الحين نُسجّل الفشل بدل ابتلاعه صامتين.
 */
export async function notifyMerchant(store, text) {
  const failures = [];

  for (const channel of OTP_CHAIN) {
    if (channel === 'whatsapp') {
      const { token, phoneId } = config.whatsapp;
      if (!token || !phoneId || !store.whatsapp) { failures.push('whatsapp: غير مضبوط'); continue; }
      try {
        const out = await graph(`${phoneId}/messages`, {
          messaging_product: 'whatsapp',
          to: intl(store.whatsapp),
          type: 'text',
          text: { body: text },
        });
        trackOutbound(out?.messages?.[0]?.id, store.whatsapp, 'notice');
        return { ok: true, provider: 'whatsapp' };
      } catch (err) { failures.push(`whatsapp: ${err.message}`); }
    }

    if (channel === 'console') {
      if (failures.length) console.warn(`  ↩ تعذّرت القنوات: ${failures.join(' · ')}`);
      console.log(`\n  📣 ${store.name} (${store.whatsapp ?? '—'}):\n${text}\n`);
      return { ok: true, provider: 'console' };
    }
  }

  throw new Error(failures.join(' · ') || 'لا قناة إشعار مضبوطة');
}

export async function notifyNewOrder(store, order) {
  const items = order.items.map((i) => `• ${i.name} × ${i.qty}`).join('\n');
  const text = [
    `طلب جديد في ${store.name}`,
    '',
    `رقم الطلب: ${order.ref}`,
    order.cust_name ? `العميل: ${order.cust_name}` : '',
    '',
    items,
    '',
    `الإجمالي: ${order.total.toLocaleString('en-US')} ر.ي`,
    '',
    'افتح لوحتك لتأكيد الطلب.',
  ].filter(Boolean).join('\n');

  try {
    if (OTP_PROVIDER === 'whatsapp') {
      const { token, phoneId } = config.whatsapp;
      if (!token || !phoneId || !store.whatsapp) return { ok: false, reason: 'غير مضبوط' };

      /**
       * رسالة حرّة لا قالب: التاجر بدأ المحادثة معنا عند التسجيل،
       * فنافذة الـ٢٤ ساعة مفتوحة غالباً. إن أُغلقت يفشل الإرسال
       * بهدوء — ولوحة التحكم تبقى مصدر الحقيقة للطلبات.
       */
      const out = await graph(`${phoneId}/messages`, {
        messaging_product: 'whatsapp',
        to: intl(store.whatsapp),
        type: 'text',
        text: { body: text },
      });
      trackOutbound(out?.messages?.[0]?.id, store.whatsapp, 'order');
      return { ok: true, provider: 'whatsapp' };
    }

    console.log(`\n  🔔 ${store.name} — طلب جديد ${order.ref} بقيمة ${order.total}\n`);
    return { ok: true, provider: 'console' };
  } catch (err) {
    console.error('✖ تعذّر إشعار التاجر:', err.message);
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
//  فحص الاتصال — يُستدعى من سكربت الفحص ومن لوحة الإدارة
//  قراءة فقط: يسأل Meta عن الرقم ولا يرسل شيئاً لأحد.
// ═══════════════════════════════════════════════════════════
export async function checkWhatsApp() {
  const { token, phoneId, wabaId, template, lang } = config.whatsapp;
  if (!token || !phoneId) {
    return { ok: false, error: 'ينقص META_TOKEN أو WA_PHONE_ID' };
  }

  const info = await graph(
    `${phoneId}?fields=verified_name,display_phone_number,quality_rating,platform_type,status,name_status`,
    null, { method: 'GET' },
  );

  /**
   * فخّ شائع: وضع معرّف الحساب (WABA) مكان معرّف الرقم.
   * عقدة الحساب ترد ٢٠٠ بلا أي من هذه الحقول، فيبدو كل شيء
   * سليماً حتى تفشل أول رسالة. نكشفه هنا صراحةً.
   */
  if (!info?.display_phone_number) {
    return {
      ok: false,
      error: `المعرّف ${phoneId} ليس معرّف رقم — على الأرجح هو معرّف الحساب (WABA). `
           + 'خذ المعرّف الظاهر أسفل الرقم نفسه في WhatsApp Manager.',
    };
  }

  const issues = [];
  if (info.platform_type === 'ON_PREMISE') {
    issues.push('الرقم مسجّل على On-Premise API لا Cloud API — لن يعمل الإرسال حتى تنقله إلى Cloud API');
  }
  if (info.status && info.status !== 'CONNECTED') {
    issues.push(`حالة الرقم ${info.status} — يلزم تسجيله في Cloud API ليصبح CONNECTED`);
  }

  // هل القالب المطلوب موجود فعلاً ومعتمد؟ أكثر سبب لفشل أول إرسال
  let tpl = { found: false };
  try {
    let id = wabaId;
    if (!id) {
      const waba = await graph(`${phoneId}?fields=whatsapp_business_account`, null, { method: 'GET' });
      id = waba?.whatsapp_business_account?.id;
    }
    if (id) {
      const list = await graph(
        `${id}/message_templates?fields=name,status,language&limit=200`,
        null, { method: 'GET' },
      );
      const match = (list?.data ?? []).filter((t) => t.name === template);
      const exact = match.find((t) => t.language === lang);
      tpl = {
        found: match.length > 0,
        approved: exact?.status === 'APPROVED',
        status: exact?.status ?? null,
        languages: match.map((t) => t.language),
        all: (list?.data ?? []).map((t) => `${t.name} (${t.language}/${t.status})`),
      };
    } else {
      tpl = { found: false, error: 'تعذّر تحديد معرّف الحساب — اضبط WA_WABA_ID' };
    }
  } catch (err) {
    tpl = { found: false, error: err.message };
  }

  return { ok: true, phone: info, issues, template: { name: template, lang, ...tpl } };
}

/** حالة قناة واحدة */
function channelStatus(name) {
  if (name === 'console') return 'console (تطوير — الرمز يظهر في السجل وفي الصفحة)';
  if (name === 'whatsapp') {
    const { token, phoneId, template, lang } = config.whatsapp;
    if (!token || !phoneId) return 'whatsapp ✖ ينقصه META_TOKEN/WA_PHONE_ID';
    const proof = config.meta.appSecret ? 'موقَّع' : 'بلا توقيع';
    return `whatsapp ✓ (رقم ${phoneId} · قالب ${template}/${lang} · ${proof})`;
  }
  if (name === 'sms') return config.sms.url ? 'sms ✓ مضبوط' : 'sms ✖ ينقصه SMS_URL';
  return `${name} ✖ غير معروف`;
}

/** حالة الإعداد — تُعرض في سجل الإقلاع */
export function providerStatus() {
  return OTP_CHAIN.map(channelStatus).join('\n                      ثم ');
}
