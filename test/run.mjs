// ═══════════════════════════════════════════════════════════
//  مُشغّل مجموعات الفحص
//
//  كانت القائمة مكتوبة مرّتين: سلسلة `&&` في `package.json`
//  وقائمة أخرى في `.github/workflows/ci.yml`. وقد تباعدتا فعلاً
//  — ثلاث مجموعات (`variants` و`entry` و`countries`) تعمل على
//  جهاز المطوّر ولا تعمل في CI إطلاقاً.
//
//  وهذا أسوأ من غياب الفحص: البناء أخضر، والانحدار يمرّ.
//
//  فصار الترتيب هنا وحده، ويستدعيه الاثنان.
//
//  الاستعمال:
//      node test/run.mjs              كل المجموعات بالترتيب
//      node test/run.mjs pages infra  ما طابق الاسم فقط
// ═══════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * الترتيب مقصود لا أبجدي: `smoke` أوّلاً لأنه يكشف الأعطال
 * الجسيمة في ثوانٍ، فلا ينتظر المطوّر دقيقتين ليعلم أن الخادم
 * لا يردّ أصلاً. وما بعده مرتَّب من الأرخص إلى الأغلى.
 *
 * ‏`readiness` ليست هنا: تدقيق ساكن للملفات لا يحتاج خادماً،
 * ويُشغَّل وحده بـ`npm run readiness` قبل تجهيز القاعدة.
 */
const SUITES = [
  'smoke',
  'images',
  'gallery',
  'variants',
  'entry',
  'billing',
  'stores',
  'pages',
  'webhook',
  'infra',
  'reminders',
  'pwa',
  'pagination',
  'countries',
];

const wanted = process.argv.slice(2);
const suites = wanted.length
  ? SUITES.filter((s) => wanted.some((w) => s.includes(w)))
  : SUITES;

if (!suites.length) {
  console.error(`✖ لا مجموعة تطابق: ${wanted.join(' ')}`);
  console.error(`  المتاح: ${SUITES.join(' · ')}`);
  process.exit(1);
}

const started = Date.now();

for (const [i, suite] of suites.entries()) {
  console.log(`\n━━━ [${i + 1}/${suites.length}] ${suite} ━━━`);

  // عملية لكل مجموعة لا استيراد: المجموعات تفترض حالة طازجة
  // وتضبط `process.exitCode` لنفسها، واستيرادها في عملية واحدة
  // يجعل أوّل فشل يبتلع رمز خروج ما بعده.
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(HERE, `${suite}.mjs`)],
    { stdio: 'inherit' });

  if (r.error) {
    console.error(`\n✖ تعذّر تشغيل ${suite}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    // التوقّف عند أوّل فشل: المجموعات تتشارك قاعدة واحدة، وفشل
    // مبكّر يترك حالة تُفشل ما بعده بأخطاء تابعة تُضلّل التشخيص.
    console.error(`\n✖ فشلت ${suite} (رمز ${r.status}) — توقّفنا هنا`);
    process.exit(r.status);
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n✔ ${suites.length} مجموعة · ${secs} ثانية`);
