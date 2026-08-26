// ═══════════════════════════════════════════════════════════
//  قاعدة البيانات — المخطط والاتصال
//  §٥.١ العزل بين المتاجر: كل جدول تابع يحمل store_id
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, connect } from './pg.js';

export { db };

/**
 * المسارات من الإعدادات لا من جذر المشروع.
 * في الحاوية تعيش البيانات في حجم منفصل (DATA_DIR=/data): لو
 * بنينا المسار من الجذر لكُتبت القاعدة داخل الحاوية نفسها،
 * فتُمحى مع أول تحديث — وتذهب معها متاجر التجار وطلباتهم.
 */
export const ROOT = config.paths.root;
export const DATA_DIR = config.paths.data;
export const UPLOAD_DIR = config.paths.uploads;

// المجلّد يُنشأ حتى مع التخزين السحابي: النسخ الاحتياطي
// يقرأه، وقد تبقى صور قديمة من قبل التحويل.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

connect(config.databaseUrl);

/**
 * المخطّط في ملف SQL واحد لا في سلاسل نصّية داخل الكود.
 * السبب: نفس الملف يُطبَّق يدوياً على قاعدة مُدارة
 * (`psql "$DATABASE_URL" -f ops/sql/schema.pg.sql`) وآلياً عند
 * الإقلاع — فلا تتباعد نسختان من الحقيقة.
 *
 * كل الجمل idempotent (IF NOT EXISTS)، فالتشغيل المتكرّر آمن.
 */
export async function migrate() {
  const file = path.join(config.paths.root, 'ops', 'sql', 'schema.pg.sql');
  await db.exec(fs.readFileSync(file, 'utf8'));
}

export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
