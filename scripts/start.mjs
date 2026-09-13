// ═══════════════════════════════════════════════════════════
//  تشغيل الإنتاج — عمليتان خلف منفذ واحد
//
//  المنصّات المُدارة (Render وغيرها) تعطي منفذاً واحداً في
//  `PORT` وتتوقّع أن يستمع عليه شيء واحد. فيأخذه Next لأنه
//  الواجهة، ويعيش الخادم القديم خلفه على منفذ داخلي لا يخرج
//  من الحاوية — يصله الطلب مُمرَّراً من Next وحده.
//
//  ولهذا لا يُمرَّر `PORT` كما هو إلى الخادم القديم: لو فعلنا
//  لتسابق الاثنان على المنفذ نفسه، وفاز أحدهما عشوائياً.
//
//  للتشغيل المنفصل — لو أردت كل عملية في حاوية — استعمل
//  `npm run start:server` و`npm run start:web` مباشرةً.
// ═══════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PUBLIC_PORT = process.env.PORT ?? '3000';
const LEGACY_PORT = process.env.LEGACY_PORT ?? '3100';

if (PUBLIC_PORT === LEGACY_PORT) {
  console.error(`✖ PORT وLEGACY_PORT كلاهما ${PUBLIC_PORT} — عمليتان على منفذ واحد.`);
  process.exit(1);
}

// ‏127.0.0.1 لا localhost: على بعض المضيفين يُحلّ الاسم إلى
// ‏::1 أوّلاً بينما يستمع الخادم على IPv4 وحده، فيفشل التمرير
// بـECONNREFUSED رغم أن العملية تعمل.
const LEGACY_ORIGIN = `http://127.0.0.1:${LEGACY_PORT}`;

// مسار Next مباشرةً لا عبر npx — لنفس سبب dev.mjs: مسار Node
// قد يحوي مسافة، وshell:true يقصّه عندها.
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

const children = [];
let shuttingDown = false;

function run(label, cmd, args, extraEnv) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`✖ توقّف ${label} (${signal ?? `رمز ${code}`}) — نُنهي العملية كلها`);
    stopAll(code ?? 1);
  });
  children.push(child);
}

function stopAll(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode === null) { try { c.kill('SIGTERM'); } catch { /* رحل قبلنا */ } }
  }
  setTimeout(() => process.exit(code), 5000).unref();
}

// الإيقاف الرشيد في الخادم القديم يُفرِّغ الطلبات الجارية قبل
// أن يقفل. تمرير الإشارة إليه لا قتله هو ما يجعل النشر بلا
// طلبٍ مقطوع في منتصفه.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stopAll(0));

run('الخادم القديم', process.execPath, ['--no-warnings', 'server/server.js'],
  { PORT: LEGACY_PORT });

run('Next', process.execPath, [NEXT_BIN, 'start', '-p', PUBLIC_PORT],
  { LEGACY_ORIGIN });
