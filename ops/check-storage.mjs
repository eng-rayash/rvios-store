// ═══════════════════════════════════════════════════════════
//  فحص التخزين — رحلة كاملة: رفع، قراءة، حذف
//
//  التوقيع SigV4 إمّا يعمل تماماً أو يفشل بـ403 مبهم. هذا
//  الفحص يقطع الشك قبل أن يرفع تاجر صورة واحدة.
//
//  لا يطبع أي مفتاح — الأطوال فقط، ليُميَّز الناقص من الخاطئ.
// ═══════════════════════════════════════════════════════════
import { config } from '../server/config.js';
import { put, get, dropPrefix, driver } from '../server/storage.js';

const mask = (v) => (v ? `مضبوط (${v.length} محرفاً)` : '✖ غائب');
const line = (k, v) => console.log(`  ${k.padEnd(24)} ${v}`);

console.log('\n  ── إعداد التخزين ──');
line('السائق', driver);

if (driver !== 'r2') {
  line('المجلّد', config.paths.uploads);
  console.log('\n  ℹ التخزين محلي — لا شيء يُفحص عن بُعد.');
  console.log('    للانتقال إلى السحابة: STORAGE_DRIVER=r2\n');
  process.exit(0);
}

const r2 = config.storage.r2;
line('معرّف الحساب', r2.accountId || '✖ غائب');
line('السلة', r2.bucket || '✖ غائب');
line('مفتاح الوصول', mask(r2.accessKeyId));
line('المفتاح السرّي', mask(r2.secretAccessKey));
line('النطاق العام', r2.publicUrl || '(خاصة — يمرّ الخادم بالصور)');

const key = `_health/check-${Date.now()}.txt`;
const payload = Buffer.from('rvios storage check', 'utf8');
let failed = false;

try {
  console.log('\n  ── الرحلة ──');

  const url = await put(key, payload, 'text/plain');
  line('رفع', `✓ ${url}`);

  const back = await get(key);
  if (!back) throw new Error('الكائن غير موجود بعد رفعه مباشرة');
  if (!back.buf.equals(payload)) throw new Error('المحتوى المُعاد لا يطابق المرفوع');
  line('قراءة', `✓ ${back.buf.length} بايت · ${back.type}`);

  // النطاق العام يجب أن يخدم الملف نفسه بلا توقيع
  if (r2.publicUrl) {
    const res = await fetch(url);
    line('النطاق العام', res.ok
      ? `✓ ${res.status}`
      : `✖ ${res.status} — السلة غير معروضة للعموم أو النطاق خاطئ`);
    if (!res.ok) failed = true;
  }

  await dropPrefix('_health');
  line('حذف', (await get(key)) ? '✖ بقي الكائن بعد الحذف' : '✓');
  if (await get(key)) failed = true;
} catch (err) {
  failed = true;
  console.log(`\n  ✖ ${err.message}`);
  console.log('\n  الأسباب الشائعة:');
  console.log('    • 403 → المفتاح السرّي خاطئ، أو صلاحية الرمز قراءة فقط');
  console.log('    • 404 → اسم السلة خاطئ، أو السلة في حساب آخر');
  console.log('    • فشل الاسم → معرّف الحساب خاطئ');
}

console.log(failed ? '\n  ✖ التخزين غير جاهز\n' : '\n  ✓ التخزين جاهز\n');
process.exitCode = failed ? 1 : 0;
