/**
 * هجرة أرقام الجوال إلى الصيغة الدولية E.164.
 *
 * ★ أخطر هجرة في المشروع: `merchants.phone` هو **مفتاح تسجيل
 *   الدخول**، وأي خطأ فيه يمنع كل تاجر قائم من الدخول إلى
 *   متجره. ولذلك:
 *
 *   · **عكوسة** — `--undo` تعيد كل شيء إلى الصيغة المحلية.
 *   · **مُتكرِّرة بأمان (idempotent)** — تشغيلها مرتين لا يضاعف
 *     رمز الدولة، لأنها تتخطّى ما صار دولياً بالفعل.
 *   · **تتحقّق قبل الكتابة** — تتوقّف كلياً إن وجدت صفّاً واحداً
 *     لا يطابق الصيغة المتوقّعة، بدل أن تُفسد نصف الجدول.
 *   · **معاملة واحدة** — إمّا أن تنجح كلها أو لا يتغيّر شيء.
 *
 * الاستعمال:
 *   node ops/migrate-phones.mjs            فحص جاف (لا يكتب)
 *   node ops/migrate-phones.mjs --apply    التنفيذ
 *   node ops/migrate-phones.mjs --undo     التراجع
 */
import { db } from '../server/db.js';
import { COUNTRIES, DEFAULT_COUNTRY, validE164 } from '../server/countries.js';

const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');
const HOME = COUNTRIES[DEFAULT_COUNTRY];

const isLocal = (p) => HOME.mobile.test(String(p ?? ''));
const isIntl = (p) => validE164(String(p ?? ''));

/** الصفوف التي تحمل رقماً — الفارغ ليس خطأً بل غياب */
const TARGETS = [
  { table: 'merchants', col: 'phone',    required: true },
  { table: 'stores',    col: 'whatsapp', required: false },
];

async function inspect() {
  const report = [];
  for (const t of TARGETS) {
    const rows = await db.prepare(`SELECT id, ${t.col} AS v FROM ${t.table} ORDER BY id`).all();
    const local = rows.filter((r) => isLocal(r.v));
    const intl = rows.filter((r) => isIntl(r.v));
    const empty = rows.filter((r) => !r.v);
    const odd = rows.filter((r) => r.v && !isLocal(r.v) && !isIntl(r.v));
    report.push({ ...t, rows, local, intl, empty, odd });
  }
  return report;
}

const report = await inspect();

console.log('\n  حالة الأرقام قبل أي تغيير:\n');
for (const r of report) {
  console.log(`  ${r.table}.${r.col}`);
  console.log(`    محلي: ${r.local.length} · دولي: ${r.intl.length} · فارغ: ${r.empty.length} · غير معروف: ${r.odd.length}`);
  if (r.odd.length) {
    for (const o of r.odd.slice(0, 5)) console.log(`      ✘ id=${o.id}  «${o.v}»`);
  }
}

// صفّ واحد غير مفهوم يوقف كل شيء: تخمين صيغته أسوأ من التوقّف
const odd = report.flatMap((r) => r.odd);
if (odd.length) {
  console.error(`\n  ✘ ${odd.length} صفّاً بصيغة غير معروفة — لم يُكتب شيء.`);
  console.error('    صحّحها يدوياً أولاً، فالتخمين هنا يكسر تسجيل الدخول.\n');
  await db.close();
  process.exit(1);
}

if (!APPLY && !UNDO) {
  const willChange = report.reduce((n, r) => n + (r.local.length), 0);
  console.log(`\n  فحص جاف — سيتغيّر ${willChange} صفّاً.`);
  console.log('  للتنفيذ:  node ops/migrate-phones.mjs --apply\n');
  await db.close();
  process.exit(0);
}

// أسماء الجداول والأعمدة من `TARGETS` أعلاه — ثوابت مكتوبة في
// هذا الملف لا مدخلات، فتركيبها في النصّ لا يفتح باب الحقن.
if (UNDO) {
  console.log('\n  ↩ التراجع إلى الصيغة المحلية…\n');
  await db.transaction(async (tx) => {
    for (const t of TARGETS) {
      const res = await tx.prepare(
        `UPDATE ${t.table}
            SET ${t.col} = substring(${t.col} from ${HOME.dial.length + 1})
          WHERE ${t.col} LIKE ?
            AND length(${t.col}) = ?`,
      ).run(HOME.dial + '%', HOME.dial.length + 9);
      console.log(`  ${t.table}.${t.col}: ${res.changes} صفّاً`);
    }
  });
  console.log('\n  ✔ عاد كل شيء إلى الصيغة المحلية\n');
  await db.close();
  process.exit(0);
}

console.log('\n  ⇢ التنفيذ داخل معاملة واحدة…\n');
await db.transaction(async (tx) => {
  for (const r of report) {
    const upd = tx.prepare(`UPDATE ${r.table} SET ${r.col} = ? WHERE id = ?`);
    for (const row of r.local) await upd.run(HOME.dial + row.v, row.id);
    console.log(`  ${r.table}.${r.col}: ${r.local.length} صفّاً`);
  }
});

// التحقّق بعد الكتابة — لا نثق بأن الكتابة نجحت لأنها لم ترمِ
const after = await inspect();
const bad = after.flatMap((r) => [...r.local, ...r.odd]);
if (bad.length) {
  console.error(`\n  ✘ بقي ${bad.length} صفّاً لم يُحوَّل — راجع فوراً.\n`);
  await db.close();
  process.exit(1);
}

console.log('\n  ✔ اكتملت الهجرة، وكل رقم صار بصيغة دولية صالحة.');
console.log('    للتراجع:  node ops/migrate-phones.mjs --undo\n');
await db.close();
