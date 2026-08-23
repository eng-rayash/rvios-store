// ═══════════════════════════════════════════════════════════
//  التسجيل — منظّم، بمعرّف لكل طلب
//
//  في التطوير: سطر ملوّن مقروء.
//  في الإنتاج: JSON سطراً بسطر، يبتلعه أي مجمّع سجلات.
//
//  معرّف الطلب (requestId) يربط كل سطر بالطلب الذي أنتجه،
//  فيمكن تتبّع خطأ واحد عبر كل الطبقات دون تخمين.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.log.level] ?? LEVELS.info;

const COLORS = {
  debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m',
  dim: '\x1b[2m', reset: '\x1b[0m',
};

function emit(level, context, message) {
  if (LEVELS[level] < threshold) return;

  const time = new Date().toISOString();

  if (config.log.json) {
    process.stdout.write(JSON.stringify({ time, level, msg: message, ...context }) + '\n');
    return;
  }

  const c = COLORS[level];
  const tag = level.toUpperCase().padEnd(5);
  const extras = Object.entries(context)
    .filter(([k]) => k !== 'msg')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');

  const line = `${COLORS.dim}${time.slice(11, 23)}${COLORS.reset} ${c}${tag}${COLORS.reset} ${message}`
    + (extras ? ` ${COLORS.dim}${extras}${COLORS.reset}` : '');

  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
}

/** يبني مسجّلاً يحمل سياقاً ثابتاً (مثل requestId) */
export function createLogger(base = {}) {
  const bind = (level) => (contextOrMessage, maybeMessage) => {
    const hasContext = typeof contextOrMessage === 'object' && contextOrMessage !== null;
    const context = hasContext ? contextOrMessage : {};
    const message = hasContext ? (maybeMessage ?? '') : String(contextOrMessage ?? '');
    emit(level, { ...base, ...context }, message);
  };

  return {
    debug: bind('debug'),
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error'),
    child: (extra) => createLogger({ ...base, ...extra }),
  };
}

export const log = createLogger();

export const newRequestId = () => crypto.randomBytes(6).toString('hex');

/**
 * يسجّل الطلب عند انتهائه.
 * لا نسجّل الأصول الثابتة الناجحة — تُغرق السجل بلا فائدة.
 */
export function logRequest(reqLog, { method, pathname, status, ms, isAsset }) {
  if (isAsset && status < 400) return;

  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  reqLog[level]({ method, path: pathname, status, ms: Math.round(ms) },
    `${method} ${pathname} → ${status}`);
}
