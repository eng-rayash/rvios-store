// ═══════════════════════════════════════════════════════════
//  استعادة نسخة احتياطية
//      npm run backup:list           عرض النسخ المتاحة
//      npm run restore -- <اسم>     استعادة نسخة
//      npm run restore -- --latest  استعادة الأحدث
//
//  الاستعادة تُبقي القاعدة الحالية جانباً باسم .before-restore
//  قبل أي شيء: قد تكون الاستعادة نفسها هي الخطأ، والتراجع
//  عنها يجب أن يبقى ممكناً.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const args = process.argv.slice(2);
const dir = config.paths.backups;

function available() {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith('rvios-') && f.endsWith('.db'))
    .sort().reverse();
}

/** @param {string} full مسار كامل — لا اسم ملف */
function describe(full) {
  let snap;
  try {
    snap = new DatabaseSync(full, { readOnly: true });
    const n = (t) => snap.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
    return {
      kb: Math.round(fs.statSync(full).size / 1024),
      stores: n('stores'), orders: n('orders'),
      merchants: n('merchants'), invoices: n('invoices'),
    };
  } catch (err) {
    return { error: err.message };
  } finally {
    try { snap?.close(); } catch { /* لا شيء */ }
  }
}

const files = available();

// ── العرض فقط ────────────────────────────────────────────
if (!args.length || args[0] === '--list') {
  if (!files.length) {
    console.log('\n  لا توجد نسخ احتياطية بعد.');
    console.log(`  المجلد: ${dir}`);
    console.log('  أنشئ واحدة الآن:  npm run backup\n');
    process.exit(0);
  }
  console.log(`\n  ${files.length} نسخة في ${dir}\n`);
  for (const f of files) {
    const d = describe(path.join(dir, f));
    console.log(d.error
      ? `  ✖ ${f} — تالفة: ${d.error}`
      : `  ${f}  ${String(d.kb).padStart(6)}KB · ${d.stores} متجر · ${d.merchants} تاجر · ${d.orders} طلب · ${d.invoices} فاتورة`);
  }
  console.log('\n  للاستعادة:  npm run restore -- <اسم الملف>');
  console.log('  أو الأحدث:  npm run restore -- --latest\n');
  process.exit(0);
}

// ── الاستعادة ────────────────────────────────────────────
const target = args[0] === '--latest' ? files[0] : args[0];

if (!target) {
  console.error('\n  ✖ لا توجد نسخ للاستعادة.\n');
  process.exit(1);
}
const src = path.join(dir, path.basename(target));
if (!fs.existsSync(src)) {
  console.error(`\n  ✖ لا توجد نسخة باسم «${target}».`);
  console.error('  اعرض المتاح:  npm run backup:list\n');
  process.exit(1);
}

const info = describe(src);
if (info.error) {
  console.error(`\n  ✖ النسخة تالفة ولا تصلح للاستعادة: ${info.error}\n`);
  process.exit(1);
}

const live = config.paths.db;
const current = fs.existsSync(live) ? describe(live) : null;

console.log(`\n  ═══ استعادة ═══\n`);
console.log(`  من:   ${path.basename(src)}`);
console.log(`        ${info.stores} متجر · ${info.merchants} تاجر · ${info.orders} طلب · ${info.invoices} فاتورة\n`);
console.log(`  إلى:  ${live}`);
console.log(current && !current.error
  ? `        ${current.stores} متجر · ${current.merchants} تاجر · ${current.orders} طلب · ${current.invoices} فاتورة\n`
  : '        (لا توجد قاعدة حالية)\n');

if (current && !current.error) {
  const lost = {
    stores: current.stores - info.stores,
    orders: current.orders - info.orders,
    invoices: current.invoices - info.invoices,
  };
  if (lost.stores > 0 || lost.orders > 0 || lost.invoices > 0) {
    console.log('  ⚠ النسخة أقدم من الحالة الحالية. ستفقد:');
    if (lost.stores > 0)   console.log(`     ${lost.stores} متجر`);
    if (lost.orders > 0)   console.log(`     ${lost.orders} طلب`);
    if (lost.invoices > 0) console.log(`     ${lost.invoices} فاتورة`);
    console.log('');
  }
}

// تأكيد صريح ما لم يُمرَّر --yes (للاستعادة الآلية في السكربتات)
if (!args.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('  اكتب «نعم» للمتابعة: ');
  rl.close();
  if (answer.trim() !== 'نعم') {
    console.log('\n  أُلغيت الاستعادة — لم يتغيّر شيء.\n');
    process.exit(0);
  }
}

// القاعدة الحالية تُحفظ قبل الدهس — قد تكون الاستعادة هي الخطأ
if (fs.existsSync(live)) {
  const aside = `${live}.before-restore`;
  fs.copyFileSync(live, aside);
  console.log(`\n  حُفظت الحالية في: ${path.basename(aside)}`);
}

// ملفات WAL المتبقّية ستدهس المستعاد إن بقيت
for (const suffix of ['-wal', '-shm']) {
  const f = live + suffix;
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

fs.copyFileSync(src, live);
console.log(`  ✓ استُعيدت النسخة.\n`);
console.log('  الصور: النسخة تحوي مجلد uploads — انسخه يدوياً إن لزم:');
console.log(`     ${path.join(dir, 'uploads')}  →  ${config.paths.uploads}\n`);
console.log('  أعد تشغيل الخادم الآن.\n');
