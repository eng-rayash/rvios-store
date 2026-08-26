// ═══════════════════════════════════════════════════════════
//  فحص ربط واتساب — قراءة فقط، لا يرسل رسالة لأحد
//      npm run check:wa
//
//  يجيب على ثلاثة أسئلة بالترتيب الذي تفشل به عادةً:
//  ١) هل الرمز صالح ويرى هذا الرقم؟
//  ٢) هل القالب موجود ومعتمد باللغة المطلوبة؟
//  ٣) ما نسبة وصول الرسائل التي أرسلناها فعلاً؟
// ═══════════════════════════════════════════════════════════
import { config } from '../src/config.js';
import { checkWhatsApp } from '../src/notify.js';
import { db } from '../src/db.js';

const line = (k, v) => console.log(`   ${k.padEnd(22, '·')} ${v}`);

console.log('\n  ╭─ فحص ربط واتساب ─────────────────────────╮\n');

line('المزوّد', config.otp.provider);
line('معرّف الرقم', config.whatsapp.phoneId || '— ناقص —');
line('الرمز', config.whatsapp.token ? `مضبوط (${config.whatsapp.token.length} حرفاً)` : '— ناقص —');
line('سرّ التطبيق', config.meta.appSecret ? 'مضبوط ✓' : '— ناقص (بلا توقيع) —');
line('رمز الـWebhook', config.meta.verifyToken ? 'مضبوط ✓' : '— ناقص —');
line('القالب', `${config.whatsapp.template} / ${config.whatsapp.lang}`);

console.log('');

let failed = false;
try {
  const out = await checkWhatsApp();
  if (!out.ok) {
    console.log(`  ✖ ${out.error}\n`);
    failed = true;
  } else {
    const p = out.phone ?? {};
    console.log('  ── الرقم في Meta ──');
    line('الاسم المعتمد', p.verified_name ?? '—');
    line('الرقم الظاهر', p.display_phone_number ?? '—');
    line('المنصّة', p.platform_type ?? '—');
    line('الحالة', p.status ?? '—');
    line('تقييم الجودة', p.quality_rating ?? '—');

    for (const issue of out.issues ?? []) {
      console.log(`\n   ✖ ${issue}`);
      failed = true;
    }

    console.log('\n  ── القالب ──');
    const t = out.template;
    if (t.approved) {
      line('الحالة', '✓ معتمد وجاهز');
    } else if (t.found) {
      line('الحالة', `✖ موجود لكن ${t.status ?? 'بلغة أخرى'} — اللغات: ${t.languages?.join(', ') || '—'}`);
      failed = true;
    } else {
      line('الحالة', `✖ «${t.name}» غير موجود`);
      if (t.all?.length) console.log(`\n   القوالب المتاحة: ${t.all.join(' · ')}`);
      else if (t.error) console.log(`\n   ${t.error}`);
      failed = true;
    }
  }
} catch (err) {
  console.log(`  ✖ ${err.message}\n`);
  failed = true;
}

// ── نسبة الوصول الفعلية من سجل الـWebhook ────────────────
const rows = await db.prepare(`SELECT status, COUNT(*) n FROM wa_messages GROUP BY status`).all();
if (rows.length) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  console.log('\n  ── تسليم الرسائل ──');
  for (const r of rows) {
    line(r.status, `${r.n} (${Math.round((r.n / total) * 100)}٪)`);
  }
  const fails = await db.prepare(`SELECT phone, error_text FROM wa_messages
                            WHERE status='failed' ORDER BY sent_at DESC LIMIT 3`).all();
  for (const f of fails) console.log(`   ✖ ${f.phone}: ${f.error_text ?? '—'}`);
} else {
  console.log('\n  (لا رسائل مسجّلة بعد)');
}

console.log(failed ? '\n  ✖ الربط غير مكتمل\n' : '\n  ✓ الربط سليم\n');
process.exitCode = failed ? 1 : 0;
