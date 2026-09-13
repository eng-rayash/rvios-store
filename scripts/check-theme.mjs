/**
 * يحرس تطابق النسخ المزدوجة من الوحدات المشتركة.
 *
 * أثناء الترحيل يوجد كل ملف منها مرّتين: واحدة يخدمها الخادم
 * القديم للمتصفح، وواحدة داخل تطبيق Next (لأن Turbopack لا
 * يستورد من خارج جذر التطبيق). انحرافهما لا يُنتج خطأً ولا
 * تحذيراً — بل متجراً يبدو بلونين مختلفين حسب الصفحة، أو رقماً
 * يُقبل في صفحة ويُرفض في أخرى. وهو عيب يصعب تتبّعه لأنه لا
 * يكسر شيئاً.
 *
 * يُشغَّل قبل البناء وفي CI.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** [نسخة Next، النسخة التي يخدمها الخادم القديم] */
const PAIRS = [
  ['محرّك الألوان', 'theme-core.js'],
  ['جدول الدول والعملات', 'countries.js'],
  ['قائمة القطاعات', 'sectors.js'],
].map(([label, file]) => ({
  label,
  paths: [
    join(here, '..', 'src', 'lib', file),
    join(here, '..', 'public', 'assets', 'js', file),
  ],
}));

const sum = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let drift = false;
for (const { label, paths } of PAIRS) {
  try {
    const [a, b] = paths.map(sum);
    if (a === b) {
      console.log(`✔ ${label} متطابق (${a.slice(0, 16)})`);
      continue;
    }
    drift = true;
    console.error(`✘ نسختا ${label} متباعدتان:`);
    paths.forEach((p, i) => console.error(`   ${[a, b][i].slice(0, 16)}  ${p}`));
  } catch (err) {
    // غياب النسخة القديمة يعني أن الترحيل اكتمل — لا خطأ
    if (err.code !== 'ENOENT') throw err;
    console.log(`✔ نسخة واحدة فقط من ${label} — اكتمل الترحيل`);
  }
}

if (drift) {
  console.error('\n  انسخ الأحدث فوق الأخرى قبل المتابعة.');
  process.exit(1);
}
