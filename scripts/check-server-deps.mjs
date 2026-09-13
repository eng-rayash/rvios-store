// ═══════════════════════════════════════════════════════════
//  حارس اعتماديات الخادم
//
//  قبل الدمج كان للخادم `package.json` خاص باعتمادية واحدة
//  (`postgres`)، وكان CI يفحص ذلك بعدّ شجرة الاعتماديات. وبعد
//  أن صار المشروع حزمةً واحدة تضمّ Next وReact، فقد ذلك العدّ
//  معناه — لكن **السبب** لم يفقده:
//
//  الخادم يحمل المصادقة والطلبات والفوترة، وكل حزمة تدخله
//  تدخل معها سطح هجوم وتحديثات وانقطاعات. بقاؤه على اعتمادية
//  واحدة قرارٌ لا صدفة.
//
//  فانتقل الفحص من «كم حزمة في الشجرة» إلى «ماذا يستورد
//  الخادم فعلاً»: أدقّ من سابقه، لأنه يقيس الاستعمال لا
//  التثبيت.
// ═══════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['server', 'ops', 'test'];

/** ما يُسمح للخادم باستيراده من خارج الملفات النسبية */
const ALLOWED = new Set(['postgres']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

// `import x from 'y'` و`import 'y'` و`await import('y')`
const STATIC = /^\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]/gm;
const BARE = /^\s*import\s*['"]([^'"]+)['"]/gm;
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const offenders = [];
let scanned = 0;

for (const d of DIRS) {
  let files;
  try { files = walk(path.join(ROOT, d)); } catch { continue; }
  for (const file of files) {
    scanned++;
    const src = readFileSync(file, 'utf8');
    for (const re of [STATIC, BARE, DYNAMIC]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/')) continue;   // نسبي
        if (spec.startsWith('node:')) continue;                       // مدمج
        if (ALLOWED.has(spec) || ALLOWED.has(spec.split('/')[0])) continue;
        offenders.push({ file: path.relative(ROOT, file), spec });
      }
    }
  }
}

if (offenders.length) {
  console.error('✖ الخادم يستورد حزماً من خارج القائمة المسموحة:\n');
  for (const { file, spec } of offenders) console.error(`   ${spec.padEnd(24)} ${file}`);
  console.error(`\n  المسموح: node:* · ${[...ALLOWED].join(' · ')} · المسارات النسبية.`);
  console.error('  إن كانت الحزمة ضرورية فعلاً، أضِفها إلى ALLOWED هنا بقرار واعٍ.');
  process.exit(1);
}

console.log(`✔ ${scanned} ملفاً في ${DIRS.join(' · ')} — لا اعتمادية خارج: ${[...ALLOWED].join(' · ')}`);
