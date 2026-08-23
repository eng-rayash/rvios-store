// ═══════════════════════════════════════════════════════════
//  Webhook واتساب — الطرف الوارد من Meta
//
//  يخدم غرضين:
//  ١) تحدّي التفعيل (GET) — Meta ترفض حفظ العنوان بدونه
//  ٢) تقارير حالة الرسائل (POST) — تُغلق سؤال §٢.٥ «هل وصل
//     الرمز فعلاً؟». نجاح نداء الإرسال يعني أن Meta قبِلت
//     الطلب، لا أن التاجر رأى الرمز.
//
//  كل طلب وارد يُعامل كمجهول حتى يُثبت توقيعه: أي أحد يعرف
//  العنوان يستطيع طَرْقه، والتوقيع وحده يفصل Meta عن غيرها.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now } from '../db.js';
import { json, text, readRaw, HttpError } from '../http.js';
import { config } from '../config.js';

/**
 * مقارنة التوقيع بزمن ثابت.
 * المقارنة العادية تخرج عند أول بايت مختلف، وفروق الزمن
 * الناتجة تسمح باستنتاج التوقيع الصحيح بايتاً بايتاً.
 */
function validSignature(raw, header) {
  const secret = config.meta.appSecret;
  if (!secret || !header) return false;

  const got = String(header).replace(/^sha256=/, '');
  const want = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');

  const a = Buffer.from(got, 'hex');
  const b = Buffer.from(want, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/** ٩٦٧٧٧٧… ← ٧٧٧… ليطابق ما نخزّنه محلياً */
const local = (intl) => String(intl ?? '').replace(/^967/, '');

export default function register(r) {

  // ── ١. تحدّي التفعيل ──────────────────────────────────
  //  Meta ترسل GET مرة واحدة عند حفظ العنوان، وتتوقّع أن
  //  نعيد hub.challenge نصّاً خاماً — أي تغليف JSON يُفشل الحفظ.
  r.get('/api/webhooks/whatsapp', (req, res) => {
    const mode = req.query.get('hub.mode');
    const token = req.query.get('hub.verify_token');
    const challenge = req.query.get('hub.challenge') ?? '';

    const expected = config.meta.verifyToken;
    if (!expected) throw new HttpError(503, 'الـWebhook غير مضبوط — يلزم WA_VERIFY_TOKEN');

    const ok = mode === 'subscribe'
      && token
      && token.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

    if (!ok) {
      console.warn('✖ محاولة تفعيل Webhook برمز غير صحيح');
      throw new HttpError(403, 'رمز التحقق غير صحيح');
    }

    console.log('  ✓ فُعِّل Webhook واتساب');
    text(res, challenge);
  });

  // ── ٢. الأحداث الواردة ────────────────────────────────
  r.post('/api/webhooks/whatsapp', async (req, res) => {
    const raw = await readRaw(req, 1024 * 1024);

    if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
      console.warn('✖ Webhook بتوقيع غير صالح — رُفض');
      throw new HttpError(403, 'توقيع غير صالح');
    }

    /**
     * نردّ ٢٠٠ فوراً ثم نعالج.
     * Meta تعيد المحاولة إن تأخّر الرد، فالمعالجة قبل الرد
     * تعني أحداثاً مكرّرة كلما بطؤ القرص.
     */
    json(res, { ok: true });

    try {
      const body = JSON.parse(raw);
      for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
          handleStatuses(change?.value?.statuses ?? []);
          handleIncoming(change?.value?.messages ?? []);
        }
      }
    } catch (err) {
      console.error('✖ تعذّرت معالجة حدث واتساب:', err.message);
    }
  });
}

/** تحديث حالة رسالة صادرة: sent → delivered → read، أو failed */
function handleStatuses(statuses) {
  const upd = db.prepare(`UPDATE wa_messages
                          SET status = ?, error_code = ?, error_text = ?, updated_at = ?
                          WHERE wamid = ?`);
  for (const s of statuses) {
    const err = s.errors?.[0];
    upd.run(
      s.status ?? 'sent',
      err?.code != null ? String(err.code) : null,
      err?.title ?? err?.message ?? null,
      now(),
      s.id,
    );

    if (s.status === 'failed') {
      console.error(`✖ فشل تسليم واتساب إلى ${local(s.recipient_id)}: ${err?.title ?? 'سبب غير معروف'}`);
    }
  }
}

/**
 * رسائل واردة من التجار أو العملاء.
 * لا نردّ آلياً بعد: الردّ الآلي على رقم رسمي يخلق توقّعاً
 * بأن أحداً يقرأ. نُسجّل فقط حتى يوجد من يقرأ فعلاً.
 */
function handleIncoming(messages) {
  for (const m of messages) {
    const preview = (m.text?.body ?? `[${m.type}]`).slice(0, 80);
    console.log(`  💬 رسالة واردة من ${local(m.from)}: ${preview}`);
  }
}
