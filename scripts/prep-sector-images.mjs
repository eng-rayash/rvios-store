/**
 * يحضّر صور القطاعات الواردة للنشر.
 *
 * الصور تصل بأسماء عربية وبأحجام تُقاس بالميغابايت (١٫٢–٢٫٨)،
 * بينما الصور القائمة في المجلّد نفسه بين ١٣ و٤٧ كيلوبايت. فرقٌ
 * كهذا لا يظهر على جهاز المطوّر ولا في CI — يظهر عند تاجر يفتح
 * الصفحة على شبكة بطيئة فينتظر ثلاث عشرة ميغابايت من الزينة.
 *
 * ثلاث خطوات لكل صورة:
 *   ١) قصّ الهامش الشفاف — الصور تصل بهوامش متفاوتة، فبلا قصّ
 *      يبدو قطاعٌ أكبر من جاره بلا سبب إلا سخاء المولّد.
 *   ٢) احتواء داخل مربّع واحد ثم توسيط في ٥٦٠×٥٦٠ — فتتساوى
 *      الأوزان البصرية في الشبكة.
 *   ٣) ترميز WebP. والشفافية تبقى: الصور تُعرض بـobject-fit:
 *      contain على لوح ملوّن، فخلفية مطبوعة تعني مستطيلاً باهتاً
 *      داخل اللوح. وWebP اختير على PNG لأنه وفّر ٤٠٪ على الحزمة
 *      نفسها (٨٦٤ك ← ٥١٧ك) بلا فرق مرئي — والفرق يقع كله على
 *      شبكة التاجر البطيئة لا على جهازنا.
 *
 * يُشغَّل عند وصول صور جديدة فقط، لا في كل بناء.
 *
 * ★ `sharp` غير مُعلَنة في package.json — تصل متعدّيةً مع Next.
 *   يكفي هذا اليوم، لكن ترقية Next قد تُسقطها: إن فشل الاستيراد
 *   فأضِفها devDependency بدل مطاردة السبب.
 *
 *   node scripts/prep-sector-images.mjs [مجلّد المصدر]
 */
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const DEST = join(here, '..', 'public', 'assets', 'img', 'sectors');

const SRC = process.argv[2]
  ?? 'C:/Users/USERWD/Desktop/استلام بلوتوث/صور القطاعات';

/** الاسم العربي كما وصل ← مُعرِّف القطاع في `sectors.js` */
const NAMES = {
  'التجميل والعناية':          'beauty',
  'الصحة والمكملات':           'health',
  'السيارات والدراجات والقطع': 'auto',
  'الكتب والقرطاسية والهدايا': 'stationery',
  'مواد البناء وادوات ومعادن': 'hardware',
  'الزراعة ومستلزماتها':       'agriculture',
  'مشغولات يدوية وفنون':       'handmade',
  'العاب وترفيه':              'toys',
  'أخرى':                      'other',
};

const SIZE = 560;   // ضعف مقاس العرض (٢٨٠) ليبقى حادّاً على الشاشات المضاعفة
const BOX  = 512;   // المربّع الذي يُحتوى فيه الموضوع بعد القصّ، فيبقى هامش يتنفّس

const kb = (n) => (n / 1024).toFixed(0).padStart(4) + 'ك';

mkdirSync(DEST, { recursive: true });

const rows = [];
let missing = Object.keys(NAMES).length;

for (const file of readdirSync(SRC)) {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
  // الأسماء تصل أحياناً بمسافة زائدة قبل الامتداد
  const key = basename(file).replace(/\.[^.]+$/, '').trim();
  const id = NAMES[key];
  if (!id) { rows.push([`؟ ${key}`, '—', '—', 'اسم غير معروف — تُخطّى']); continue; }
  missing--;

  const before = statSync(join(SRC, file)).size;

  const out = join(DEST, `${id}.webp`);
  const info = await sharp(join(SRC, file))
    .ensureAlpha()
    .trim({ threshold: 2 })
    .resize(BOX, BOX, { fit: 'inside', withoutEnlargement: true })
    .extend({ top: 0, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 78, alphaQuality: 90, effort: 6 })
    .toFile(out);

  rows.push([id, kb(before), kb(info.size), `${info.width}×${info.height}`]);
}

const w = Math.max(...rows.map((r) => r[0].length));
console.log('\n  القطاع'.padEnd(w + 4) + '   قبل    بعد   المقاس');
console.log('  ' + '─'.repeat(w + 26));
for (const [id, a, b, note] of rows.sort()) {
  console.log('  ' + id.padEnd(w) + '  ' + a + '  ' + b + '   ' + note);
}
if (missing > 0) console.log(`\n  ✘ ${missing} صورة متوقّعة لم تُوجد في المصدر`);
console.log();
