// ═══════════════════════════════════════════════════════════
//  اختبار تذكيرات التجديد (§٥.٥)
//
//  الخطأ الأسوأ هنا ليس غياب التذكير بل تكراره: تاجر يصله
//  «اشتراكك ينتهي غداً» كل ست ساعات يكتم الرقم — فنخسر قناة
//  التواصل كلها، لا التذكير وحده.
// ═══════════════════════════════════════════════════════════
import { finish } from './finish.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

const { db, now } = await import('../src/db.js');
const { runReminderSweep, runSubscriptionSweep } = await import('../src/billing.js');

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

// تنظيف مسبق: تشغيل سابق انقطع قد يترك صفوفاً، ومجموعة
// اختبار تفشل بسبب سابقتها تُخفي الأخطاء الحقيقية
db.prepare(`DELETE FROM stores WHERE slug = 'rem-test'`).run();
db.prepare(`DELETE FROM merchants WHERE phone = '700111222'`).run();
db.prepare(`DELETE FROM audit_log WHERE target = 'rem-test'`).run();

// متجر اختبار معزول — لا نلمس متاجر البذرة
const merchantId = db.prepare(
  `INSERT INTO merchants (phone, created_at) VALUES (?,?)`,
).run('700111222', now()).lastInsertRowid;

const storeId = Number(db.prepare(`
  INSERT INTO stores (merchant_id, slug, name, whatsapp, plan, created_at)
  VALUES (?,?,?,?,?,?)`).run(merchantId, 'rem-test', 'متجر التذكير', '700111222', 'plus', now()).lastInsertRowid);

const subId = Number(db.prepare(`
  INSERT INTO subscriptions (store_id, plan, status, current_period_end, created_at)
  VALUES (?,?,?,?,?)`).run(storeId, 'plus', 'active', inDays(30), now()).lastInsertRowid);

const sub = () => db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);
const setEnd = (iso, stage = null) =>
  db.prepare('UPDATE subscriptions SET current_period_end = ?, notified_stage = ?, status = ? WHERE id = ?')
    .run(iso, stage, 'active', subId);

console.log('── بعيد عن الانتهاء ──');
{
  setEnd(inDays(30));
  const s = await runReminderSweep();
  ok(s.d7 === 0 && s.d1 === 0, 'لا تذكير قبل ثلاثين يوماً');
  ok(sub().notified_stage === null, 'لم تُسجَّل مرحلة');
}

console.log('\n── قبل سبعة أيام ──');
{
  setEnd(inDays(5));
  const s = await runReminderSweep();
  ok(s.d7 === 1, 'أُرسل تذكير الأسبوع');
  ok(sub().notified_stage === 'd7', 'سُجّلت المرحلة d7');
  ok(!!sub().notified_at, 'سُجّل وقت الإرسال');
}
{
  const s = await runReminderSweep();
  ok(s.d7 === 0, 'لا يتكرّر تذكير الأسبوع في الكنس التالي');
}
{
  // ثلاث كنسات متتالية — الكنس يعمل كل ٦ ساعات
  for (let i = 0; i < 3; i++) await runReminderSweep();
  ok(sub().notified_stage === 'd7', 'يبقى عند d7 مهما تكرّر الكنس');
}

console.log('\n── قبل يوم ──');
{
  setEnd(inDays(0.5), 'd7');
  const s = await runReminderSweep();
  ok(s.d1 === 1, 'أُرسل تذكير اليوم الأخير');
  ok(sub().notified_stage === 'd1', 'انتقلت المرحلة إلى d1');
}
{
  const s = await runReminderSweep();
  ok(s.d1 === 0 && s.d7 === 0, 'لا تكرار بعد d1');
}
{
  // d7 لا يُرسَل بعد d1 — التسلسل لا يرجع للخلف
  setEnd(inDays(5), 'd1');
  const s = await runReminderSweep();
  ok(s.d7 === 0, 'لا يعود إلى d7 بعد d1');
}

console.log('\n── تذكير مباشر لمن لم يُذكَّر ──');
{
  // اشتراك دخل نطاق اليوم الأخير بلا مروره بـd7 (اشتراك قصير)
  setEnd(inDays(0.5), null);
  const s = await runReminderSweep();
  ok(s.d1 === 1, 'اشتراك قصير يصله تذكير اليوم مباشرة');
}

console.log('\n── دخول المهلة والانتهاء ──');
{
  setEnd(inDays(-1), 'd1');
  const changed = runSubscriptionSweep();
  ok(changed.toGrace >= 1, 'انتقل إلى المهلة');
  ok(sub().status === 'grace', 'الحالة grace');
}
{
  // بعد انقضاء المهلة
  db.prepare('UPDATE subscriptions SET current_period_end = ? WHERE id = ?')
    .run(inDays(-99), subId);
  const changed = runSubscriptionSweep();
  ok(changed.toExpired >= 1, 'انتهى بعد المهلة');
  ok(sub().status === 'expired', 'الحالة expired');

  const store = db.prepare('SELECT plan FROM stores WHERE id = ?').get(storeId);
  ok(store.plan === 'basic', 'رجع المتجر إلى الباقة المجانية');
}
{
  // §٥.٥ إخفاء لا حذف
  const s = db.prepare('SELECT COUNT(*) n FROM stores WHERE id = ?').get(storeId).n;
  ok(s === 1, 'المتجر لم يُحذف — إخفاء لا حذف');
}

console.log('\n── الباقة المجانية لا تُذكَّر ──');
{
  db.prepare(`UPDATE subscriptions SET plan='basic', status='active',
              current_period_end=?, notified_stage=NULL WHERE id=?`).run(inDays(0.5), subId);
  const s = await runReminderSweep();
  ok(s.d1 === 0 && s.d7 === 0, 'لا تذكير لمن لا يدفع');
}

console.log('\n── سجل التدقيق ──');
{
  const n = db.prepare(
    `SELECT COUNT(*) n FROM audit_log WHERE action = 'subscription.reminder' AND target = 'rem-test'`,
  ).get().n;
  ok(n >= 2, `التذكيرات مسجّلة في التدقيق (${n})`);
}

// ── تنظيف ────────────────────────────────────────────────
db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
db.prepare('DELETE FROM merchants WHERE id = ?').run(merchantId);
db.prepare(`DELETE FROM audit_log WHERE target = 'rem-test'`).run();
ok(!db.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId), 'نُظّفت بيانات الاختبار');

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
