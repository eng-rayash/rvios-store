// ═══════════════════════════════════════════════════════════
//  اختبار Webhook واتساب
//  هذه أخطر نقطة في المشروع: مسار عام بلا جلسة، لا يحرسه
//  إلا التوقيع. كل حالة رفض هنا تُختبر صراحةً.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { finish } from './finish.mjs';

const B = 'http://localhost:3000';
const HOOK = B + '/api/webhooks/whatsapp';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

// الأسرار تُقرأ من .env عبر config — لا تُكتب في ملف اختبار أبداً.
// اختبار يحمل مفتاحاً حقيقياً يسرّبه إلى Git مثل أي ملف آخر.
const { config } = await import('../src/config.js');
const SECRET = config.meta.appSecret;
const VERIFY = config.meta.verifyToken;

if (!SECRET || !VERIFY) {
  console.log('  ⏭ تخطّي فحوص الـWebhook — يلزم META_APP_SECRET و WA_VERIFY_TOKEN في .env');
  process.exit(0);
}

const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex');

const post = (raw, sig) => fetch(HOOK, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) },
  body: raw,
});

console.log('── تحدّي التفعيل ──');
{
  const q = `?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=CHALLENGE-123`;
  const r = await fetch(HOOK + q);
  const body = await r.text();
  ok(r.status === 200 && body === 'CHALLENGE-123', 'الرمز الصحيح يعيد التحدي نصّاً خاماً');
  ok(!body.startsWith('{'), 'الرد ليس JSON — Meta ترفض التغليف');
}
{
  const r = await fetch(HOOK + `?hub.mode=subscribe&hub.verify_token=خطأ&hub.challenge=X`);
  ok(r.status === 403, 'رمز تحقق خاطئ يُرفض ٤٠٣');
}
{
  const r = await fetch(HOOK + `?hub.mode=subscribe&hub.challenge=X`);
  ok(r.status === 403, 'بلا رمز تحقق يُرفض ٤٠٣');
}
{
  // طول مختلف: يجب ألّا يرمي timingSafeEqual استثناءً غير معالَج
  const r = await fetch(HOOK + `?hub.mode=subscribe&hub.verify_token=x&hub.challenge=X`);
  ok(r.status === 403, 'رمز بطول مختلف يُرفض بلا انهيار');
}

console.log('\n── التوقيع ──');
const EVENT = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { statuses: [
    { id: 'wamid.TEST-DELIVERED', status: 'delivered', recipient_id: '967771234567' },
  ] } }] }],
});

{
  const r = await post(EVENT, null);
  ok(r.status === 403, 'حدث بلا توقيع يُرفض');
}
{
  const r = await post(EVENT, 'sha256=' + 'a'.repeat(64));
  ok(r.status === 403, 'توقيع خاطئ بطول صحيح يُرفض');
}
{
  // حروف خارج النطاق السداسي — Buffer.from(...,'hex') يقطعها
  const r = await post(EVENT, 'sha256=' + 'zq'.repeat(32));
  ok(r.status === 403, 'توقيع غير سداسي يُرفض بلا انهيار');
}
{
  const r = await post(EVENT, 'sha256=');
  ok(r.status === 403, 'توقيع فارغ يُرفض');
}
{
  const r = await post(EVENT, sign(EVENT).replace('sha256=', ''));
  ok(r.status === 200, 'التوقيع بلا بادئة sha256= يُقبل أيضاً');
}
{
  // نفس الجسم بترتيب مفاتيح مختلف — التوقيع محسوب على البايتات
  const other = JSON.stringify({ entry: [], object: 'whatsapp_business_account' });
  const r = await post(EVENT, sign(other));
  ok(r.status === 403, 'توقيع جسم آخر لا يُقبل');
}
{
  const r = await post(EVENT, sign(EVENT));
  ok(r.status === 200, 'التوقيع الصحيح يُقبل');
}

console.log('\n── تسجيل الحالة ──');
{
  // رسالة لم نرسلها: يجب أن تُقبل ٢٠٠ ولا تُنشئ صفاً وهمياً
  const r = await post(EVENT, sign(EVENT));
  ok(r.status === 200, 'حالة لرسالة غير معروفة تُقبل بهدوء');
}
{
  const failed = JSON.stringify({
    entry: [{ changes: [{ value: { statuses: [{
      id: 'wamid.TEST-FAILED', status: 'failed', recipient_id: '967771234567',
      errors: [{ code: 131047, title: 'انقضت النافذة' }],
    }] } }] }],
  });
  const r = await post(failed, sign(failed));
  ok(r.status === 200, 'حدث فشل تسليم يُعالَج');
}
{
  const incoming = JSON.stringify({
    entry: [{ changes: [{ value: { messages: [
      { from: '967771234567', type: 'text', text: { body: 'مرحباً' } },
    ] } }] }],
  });
  const r = await post(incoming, sign(incoming));
  ok(r.status === 200, 'رسالة واردة تُسجَّل بلا رد آلي');
}
{
  const junk = 'ليس JSON إطلاقاً';
  const r = await post(junk, sign(junk));
  ok(r.status === 200, 'جسم تالف بتوقيع صحيح لا يُسقط الخادم');
}

console.log('\n── الخادم حيّ بعد كل ذلك ──');
{
  const r = await fetch(B + '/api/plans');
  ok(r.status === 200, 'الـAPI يستجيب بعد أحداث الـWebhook');
}

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
