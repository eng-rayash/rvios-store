// ═══════════════════════════════════════════════════════════
//  تشغيل التطوير — أمر واحد لخادمين
//
//  المشروع واحد لكنه يقلع عمليتين: خادم Node القديم (المصادقة
//  والطلبات وكل الـAPI) وتطبيق Next الذي يقف أمامه ويمرّر إليه
//  ما لم يُرحَّل بعد. تشغيلهما يدوياً في نافذتين كان يعني نسيان
//  إحداهما — فتظهر الصفحة وتسقط بياناتها بلا رسالة مفهومة.
//
//  هنا يقلعان معاً ويموتان معاً: سقوط أحدهما يُسقط الآخر بدل
//  أن يترك نصف نظام يعمل ويُوهم بأن كل شيء بخير.
//
//  العنوان الذي تفتحه واحد: منفذ Next. لا تفتح منفذ الخادم
//  القديم إلا لتشخيصه — فصفحاته الحيّة تُمرَّر عبر Next.
// ═══════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * قارئ `.env` مصغّر.
 *
 * الخادم القديم يقرأ الملف بنفسه، وNext يقرؤه بنفسه — لكن هذا
 * المُشغّل يحتاج المنفذين ليطبعهما ويربط أحدهما بالآخر. إضافة
 * حزمة لقراءة سطرين إسرافٌ، والاعتماد على متغيّرات الصدفة
 * يجعل الأمر يعمل عند من صدّرها ويفشل عند غيره.
 */
function env(file = path.join(ROOT, '.env')) {
  const out = {};
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const file = env();

// ‏PORT من البيئة لا يُقرأ هنا عمداً: معناه يختلف بين الطرفين
// (منفذ الخادم القديم في .env، والمنفذ العام على المنصّات). لو
// قرأناه لأعطى الاثنين المنفذ نفسه فتسابقا عليه. الأسماء هنا
// صريحة: LEGACY_PORT للخادم، وWEB_PORT لـNext.
const LEGACY_PORT = process.env.LEGACY_PORT ?? file.PORT ?? '3100';
const WEB_PORT = process.env.WEB_PORT ?? file.WEB_PORT ?? '3001';

if (LEGACY_PORT === WEB_PORT) {
  console.error(`✖ LEGACY_PORT وWEB_PORT كلاهما ${WEB_PORT} — عمليتان على منفذ واحد.`);
  process.exit(1);
}

// مسار Next مباشرةً لا عبر npx: مسار Node على ويندوز يحوي
// مسافة («C:\Program Files»)، ومع shell:true يُقَصّ عند
// المسافة فيفشل الإقلاع برسالة لا علاقة لها بالسبب.
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

// Next يقرأ LEGACY_ORIGIN ليعرف إلى أين يمرّر. لو غاب من البيئة
// اشتققناه من المنفذ نفسه بدل أن يمرّر إلى ٣٠٠٠ الافتراضي —
// وهو منفذ شائع قد يحجزه مشروع آخر على الجهاز.
const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? file.LEGACY_ORIGIN
  ?? `http://localhost:${LEGACY_PORT}`;

const children = [];
let shuttingDown = false;

/** يُقلع عملية ويصبغ سطورها كي يُعرف مصدرها في مخرج مشترك */
function run(label, color, cmd, args, extraEnv = {}) {
  const tag = `\x1b[${color}m${label.padEnd(6)}\x1b[0m│`;
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const prefix = (stream, out) => {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const l of lines) out.write(`${tag} ${l}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n\x1b[31m✖ توقّف ${label}\x1b[0m (${signal ?? `رمز ${code}`}) — نُنهي الآخر`);
    stopAll(code ?? 1);
  });

  children.push(child);
  return child;
}

function stopAll(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode === null) { try { c.kill(); } catch { /* رحل قبلنا */ } }
  }
  // مهلة قصيرة كي تُفرَّغ المخارج قبل الخروج
  setTimeout(() => process.exit(code), 300);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stopAll(0));

console.log(`
  الخادم القديم  http://localhost:${LEGACY_PORT}   (API واللوحات)
  ★ الموقع       http://localhost:${WEB_PORT}   ← افتح هذا
`);

run('خادم', '36', process.execPath, ['--no-warnings', '--watch', 'server/server.js'],
  { PORT: LEGACY_PORT });

run('Next', '35', process.execPath, [NEXT_BIN, 'dev', '-p', WEB_PORT],
  { LEGACY_ORIGIN });
