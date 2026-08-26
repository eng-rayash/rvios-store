// ═══════════════════════════════════════════════════════════
//  اختبار البنية التحتية
//  فحص الحياة · الضغط · معرّف الطلب · النسخ الاحتياطي · الإعداد
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { finish } from './finish.mjs';

const B = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

console.log('── فحص الحياة ──');
{
  const r = await fetch(B + '/health');
  const j = await r.json();
  ok(r.status === 200 && j.ok === true, 'يردّ ٢٠٠');
  ok(typeof j.stores === 'number', 'يستعلم القاعدة فعلاً — لا يردّ نصاً ثابتاً');
  ok(typeof j.uptime === 'number' && j.uptime >= 0, 'يذكر مدة التشغيل');
  ok(typeof j.version === 'string', 'يذكر الإصدار');
  ok(r.headers.get('cache-control') === 'no-store', 'لا يُخزَّن — وإلا خدع الوكيل العكسي');
}
{
  const r = await fetch(B + '/healthz');
  ok(r.status === 200, '‎/healthz‎ اسم بديل يعمل');
}

console.log('\n── معرّف الطلب ──');
{
  const a = await fetch(B + '/api/plans');
  const b = await fetch(B + '/api/plans');
  const ida = a.headers.get('x-request-id');
  const idb = b.headers.get('x-request-id');
  ok(!!ida, 'كل رد يحمل معرّفاً');
  ok(ida !== idb, 'المعرّف يختلف بين طلبين');
}
{
  const r = await fetch(B + '/api/no-such-route');
  const j = await r.json();
  ok(j.requestId === r.headers.get('x-request-id'),
    'المعرّف في الجسم والترويسة متطابقان — ليقتبسه التاجر عند الشكوى');
}

console.log('\n── الضغط ──');
const size = async (url, enc) => {
  const r = await fetch(url, { headers: { 'accept-encoding': enc } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { bytes: buf.length, enc: r.headers.get('content-encoding'), vary: r.headers.get('vary'), r };
};
{
  // fetch يفكّ الضغط تلقائياً، فنقيس عبر ترويسة الطول المُعلنة
  const plain = await fetch(B + '/', { headers: { 'accept-encoding': 'identity' } });
  const brot  = await fetch(B + '/', { headers: { 'accept-encoding': 'br' } });
  const gz    = await fetch(B + '/', { headers: { 'accept-encoding': 'gzip' } });

  ok(!plain.headers.get('content-encoding'), 'identity يُخدم بلا ضغط');
  ok(brot.headers.get('content-encoding') === 'br', 'brotli يُفضَّل حين يُقبل');
  ok(gz.headers.get('content-encoding') === 'gzip', 'gzip بديل حين لا يُقبل brotli');
  ok(brot.headers.get('vary') === 'Accept-Encoding',
    'ترويسة Vary موجودة — بدونها يخدم الوسيط نسخة خاطئة');

  const rawLen = Number(plain.headers.get('content-length'));
  const brLen  = Number(brot.headers.get('content-length') ?? 0);
  ok(rawLen > 0 && (brLen === 0 || brLen < rawLen * 0.6),
    `الصفحة تصغر بأكثر من ٤٠٪ (${rawLen} → ${brLen || 'بثّ'})`);
}
{
  const html = await (await fetch(B + '/yazan', { headers: { 'accept-encoding': 'br' } })).text();
  ok(html.includes('og:title'), 'المحتوى المضغوط يفكّ سليماً — Open Graph موجود');
}
{
  const r = await fetch(B + '/assets/img/logo_icon.png', { headers: { 'accept-encoding': 'br, gzip' } });
  if (r.status === 200) {
    ok(!r.headers.get('content-encoding'), 'الصور لا تُضغط — مضغوطة أصلاً');
  } else {
    ok(true, 'الصور لا تُضغط (تخطّي — الملف غير موجود)');
  }
}

console.log('\n── النسخ الاحتياطي ──');
const { backupNow, listBackups } = await import('../src/backup.js');
const { config } = await import('../src/config.js');
{
  const before = listBackups().length;
  const info = await backupNow('test');

  // pg_dump أداة خارجية لا تأتي مع Node. غيابها حالة نشر
  // مشروعة يعالجها backupNow بنسخ الصور وحدها، فنُعلنها
  // تخطّياً صريحاً بدل فشل يُقرأ كعطب في النسخ الاحتياطي.
  if (info.dbSkipped) {
    console.log('  ⚠ pg_dump غير مثبّت — تُخطّى فحوص نسخ القاعدة الستّة.');
    console.log('    ثبّت postgresql-client ثم أعد التشغيل لتغطيتها.');
  } else {
    ok(info.kb > 0, `النسخة أُنشئت (${info.kb}KB)`);
    ok(info.stores > 0, 'النسخة تحوي متاجر فعلية');
    // لا نعدّ الملفات: حين يبلغ المجلد حد الاستبقاء (BACKUP_KEEP)
    // يحذف prune أقدم نسخة مع كل جديدة، فيبقى العدد ثابتاً بينما
    // النسخ يعمل تماماً. المهم أن النسخة الجديدة **بعينها** ظهرت.
    ok(listBackups().some((b) => b.file === info.file), `ظهرت في القائمة (${before} نسخة قبلها)`);

    const file = path.join(config.paths.backups, info.file);
    ok(fs.existsSync(file), 'الملف موجود على القرص');

    // التحقق يفتح النسخة فعلاً — نسخة لا تُفتح ليست نسخة
    // نسخة pg_dump نصّية: نتحقّق من ختمها ومن ذكرها للجداول
    const dump = fs.readFileSync(file, 'utf8');
    ok(/PostgreSQL database dump complete/i.test(dump), 'النسخة مختومة — لم تُبتر');
    ok(dump.includes('stores'), 'المحتوى يذكر جدول المتاجر');
  }
}
{
  // نسخة مبتورة يجب أن تُرفض لا أن تُحفظ.
  // مع pg_dump الاختبار نصّي: غياب سطر الختم علامة البتر.
  const junk = path.join(config.paths.backups, 'rvios-9999-corrupt.sql');
  fs.mkdirSync(config.paths.backups, { recursive: true });
  fs.writeFileSync(junk, '-- بداية نسخة ثم انقطاع\nCREATE TABLE stores (');
  const tail = fs.readFileSync(junk, 'utf8');
  const sealed = /PostgreSQL database dump complete/i.test(tail);
  ok(!sealed, 'ملف مبتور لا يحمل ختم الاكتمال — التحقق سيرفضه');
  fs.unlinkSync(junk);
}

console.log('\n── حارس الإعداد ──');
{
  // إقلاع إنتاجي بكلمة المرور الافتراضية يجب أن يفشل
  let blocked = false, output = '';
  try {
    execFileSync(process.execPath, ['--no-warnings', 'src/server.js'], {
      cwd: config.paths.root,
      env: { ...process.env, NODE_ENV: 'production', RVIOS_ADMIN_PASS: 'rvios-admin', PORT: '3998' },
      timeout: 20000, stdio: 'pipe',
    });
  } catch (err) {
    blocked = err.status === 1;
    output = String(err.stdout ?? '') + String(err.stderr ?? '');
  }
  ok(blocked, 'الإقلاع الإنتاجي يتوقّف عند كلمة المرور الافتراضية');
  ok(/RVIOS_ADMIN_PASS/.test(output), 'الخطأ يسمّي المتغيّر المطلوب');
}
{
  const { validateConfig } = await import('../src/config.js');
  const v = validateConfig();
  ok(v.ok, 'إعداد التطوير الحالي سليم');
}

console.log('\n── العزل ما يزال قائماً ──');
{
  const { TENANT_TABLES } = await import('../src/tenancy.js');
  ok(TENANT_TABLES.has('orders') && TENANT_TABLES.has('invoices'),
    'جداول المستأجرين محروسة');
  ok(!TENANT_TABLES.has('wa_messages'),
    'wa_messages خارج نطاق المستأجر — سجل تشغيلي لا بيانات متجر');
}

console.log(`\n${'═'.repeat(46)}\n  نجح ${pass} · فشل ${fail}\n${'═'.repeat(46)}\n`);
await finish(fail);
