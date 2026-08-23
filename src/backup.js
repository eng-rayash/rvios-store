// ═══════════════════════════════════════════════════════════
//  النسخ الاحتياطي (§٦.٧)
//
//  ما نحميه: قاعدة البيانات (التجار، الطلبات، الفواتير،
//  الاشتراكات) وصور المتاجر. فقدان أيّها ليس عطلاً يُصلَح —
//  هو خسارة عمل تاجرٍ بأكمله، ولا سبيل لإعادته.
//
//  القاعدة تُنسخ بـ VACUUM INTO لا بنسخ الملف: النسخ العادي
//  أثناء كتابة جارية يُنتج ملفاً ممزّقاً يبدو سليماً حتى تحتاجه.
//  VACUUM INTO يُنتج لقطة متّسقة من داخل SQLite نفسها.
//
//  الصور تُنسخ تزايدياً: أسماؤها بصمات محتوى، فالملف الموجود
//  في النسخة صحيح بالتأكيد ولا يحتاج إعادة نسخ.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { db } from './db.js';
import { config } from './config.js';
import { log } from './logger.js';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * التحقق من سلامة النسخة فور إنشائها.
 * نسخة لم تُفتح قط ليست نسخة احتياطية — هي رجاء. نفتحها
 * ونعدّ صفوفها الآن، لا يوم الكارثة.
 */
function verify(file) {
  let snap;
  try {
    snap = new DatabaseSync(file, { readOnly: true });
    const check = snap.prepare('PRAGMA integrity_check').get();
    const okFlag = Object.values(check ?? {})[0];
    if (okFlag !== 'ok') return { ok: false, error: `فحص السلامة: ${okFlag}` };

    const stores = snap.prepare('SELECT COUNT(*) n FROM stores').get().n;
    const orders = snap.prepare('SELECT COUNT(*) n FROM orders').get().n;
    return { ok: true, stores, orders };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { snap?.close(); } catch { /* لا شيء */ }
  }
}

/** يحذف أقدم النسخ ويُبقي العدد المضبوط */
function prune(dir, keep) {
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('rvios-') && f.endsWith('.db'))
    .sort()
    .reverse();

  let removed = 0;
  for (const f of files.slice(keep)) {
    try { fs.unlinkSync(path.join(dir, f)); removed++; }
    catch (err) { log.warn({ file: f, err: err.message }, 'تعذّر حذف نسخة قديمة'); }
  }
  return { kept: Math.min(files.length, keep), removed };
}

/**
 * نسخ الصور تزايدياً.
 * الاسم بصمة محتوى (§٥.٣)، فوجود الملف يعني تطابقه — لا داعي
 * لمقارنة أو إعادة نسخ. هذا يجعل النسخة اليومية شبه مجانية.
 */
function copyUploads(srcRoot, dstRoot) {
  if (!fs.existsSync(srcRoot)) return { copied: 0, skipped: 0 };

  let copied = 0, skipped = 0;
  const walk = (src, dst) => {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      const to = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        ensureDir(to);
        walk(from, to);
      } else if (fs.existsSync(to)) {
        skipped++;
      } else {
        try { fs.copyFileSync(from, to); copied++; }
        catch (err) { log.warn({ file: from, err: err.message }, 'تعذّر نسخ صورة'); }
      }
    }
  };

  ensureDir(dstRoot);
  walk(srcRoot, dstRoot);
  return { copied, skipped };
}

/**
 * ينشئ نسخة الآن. يعيد وصفها أو يرمي.
 * @param {string} reason سبب النسخ — يظهر في السجل
 */
export function backupNow(reason = 'scheduled') {
  const dir = ensureDir(config.paths.backups);
  const file = path.join(dir, `rvios-${stamp()}.db`);
  const t0 = performance.now();

  // VACUUM INTO يرفض الكتابة فوق ملف قائم — وهذا ما نريده
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  const check = verify(file);
  if (!check.ok) {
    try { fs.unlinkSync(file); } catch { /* لا شيء */ }
    throw new Error(`النسخة تالفة ولم تُحفظ: ${check.error}`);
  }

  const bytes = fs.statSync(file).size;
  const images = copyUploads(config.paths.uploads, path.join(dir, 'uploads'));
  const { removed } = prune(dir, config.backup.keep);

  const info = {
    file: path.basename(file),
    kb: Math.round(bytes / 1024),
    stores: check.stores,
    orders: check.orders,
    images: images.copied,
    removed,
    ms: Math.round(performance.now() - t0),
    reason,
  };
  log.info(info, `نسخة احتياطية: ${info.kb}KB · ${info.stores} متجر · ${info.orders} طلب`);
  return info;
}

/** يبدأ الجدولة الدورية. يعيد المؤقّت أو null إن كانت معطّلة */
export function startBackups() {
  if (!config.backup.enabled) {
    log.debug('النسخ الاحتياطي معطّل — فعّله بـ BACKUP_ENABLED=1');
    return null;
  }

  const run = () => {
    try { backupNow('scheduled'); }
    catch (err) { log.error({ err: err.message }, 'فشلت النسخة الاحتياطية'); }
  };

  run();   // نسخة عند الإقلاع: أسوأ لحظة للاكتشاف هي بعد الكارثة
  return setInterval(run, config.backup.intervalHours * 60 * 60 * 1000);
}

/** قائمة النسخ المتاحة — للاستعادة وللوحة الإدارة */
export function listBackups() {
  const dir = config.paths.backups;
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.startsWith('rvios-') && f.endsWith('.db'))
    .sort().reverse()
    .map((f) => {
      const s = fs.statSync(path.join(dir, f));
      return { file: f, kb: Math.round(s.size / 1024), at: s.mtime.toISOString() };
    });
}
