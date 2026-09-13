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
import { spawn } from 'node:child_process';
import { db } from '../server/db.js';
import { config } from '../server/config.js';

const args = process.argv.slice(2);
const dir = config.paths.backups;

function available() {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith('rvios-') && f.endsWith('.sql'))
    .sort().reverse();
}

/**
 * وصف نسخة pg_dump.
 * النسخة نصّية، فنعدّ جمل الإدراج بدل فتح قاعدة. العدّ تقريبي
 * لكنه يكفي للغرض: أن يرى المشغّل حجم ما سيستعيده قبل الدهس.
 * @param {string} full مسار كامل — لا اسم ملف
 */
function describe(full) {
  try {
    const text = fs.readFileSync(full, 'utf8');
    if (!/PostgreSQL database dump complete/i.test(text)) {
      return { error: 'النسخة مبتورة — لم يكتمل pg_dump' };
    }
    // pg_dump يُخرج البيانات إما بـ COPY (الافتراضي) أو INSERT
    const NL = String.fromCharCode(10);
    const rowsIn = (table) => {
      const head = `COPY public.${table} `;
      const at = text.indexOf(head);
      if (at >= 0) {
        const from = text.indexOf(NL, at) + 1;
        const end = text.indexOf(`${NL}\\.`, from);
        if (end > from) return text.slice(from, end).split(NL).filter(Boolean).length;
      }
      return (text.split(`INSERT INTO public.${table} `).length - 1);
    };
    return {
      kb: Math.round(fs.statSync(full).size / 1024),
      stores: rowsIn('stores'), orders: rowsIn('orders'),
      merchants: rowsIn('merchants'), invoices: rowsIn('invoices'),
    };
  } catch (err) {
    return { error: err.message };
  }
}

/** يُنفّذ ملف SQL على القاعدة الحيّة عبر psql */
function psqlRestore(file, url) {
  return new Promise((resolve) => {
    const proc = spawn('psql', ['--quiet', '--set', 'ON_ERROR_STOP=1', '-f', file, url],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', (e) => resolve({ ok: false, error: e.code === 'ENOENT' ? 'psql غير مثبَّت على هذا المضيف' : e.message }));
    proc.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: err.slice(0, 400) }));
  });
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

const live = config.databaseUrl.replace(/:[^:@]*@/, ':****@');   // بلا كلمة مرور في الطباعة
const n = async (table) => (await db.prepare(`SELECT COUNT(*)::int n FROM ${table}`).get()).n;
let current = null;
try {
  current = { stores: await n('stores'), merchants: await n('merchants'),
              orders: await n('orders'), invoices: await n('invoices') };
} catch { current = null; }

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
