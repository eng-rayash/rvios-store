// ═══════════════════════════════════════════════════════════
//  طبقة العزل بين المتاجر (§٥.١)
//
//  المبدأ الحاكم من الوثيقة:
//  «فرض العزل — لا الاعتماد على تذكّر المطور إضافة الفلتر
//   في كل استعلام.»
//
//  PostgreSQL يوفّر ذلك عبر Row Level Security. SQLite لا
//  يملكها، فنفرض المكافئ بنيوياً: لا يمكن الحصول على مقبض
//  استعلام لأي جدول تابع إلا عبر scope(storeId)، وكل جملة
//  SQL تُبنى هنا مع store_id مضموناً. المنفذ الوحيد للـ SQL
//  الحر (raw) يرفض أي جملة لا تذكر store_id صراحةً.
// ═══════════════════════════════════════════════════════════
import { db } from './db.js';

/** الجداول التي لا يجوز لمسها بدون store_id */
export const TENANT_TABLES = new Set([
  'categories', 'products', 'product_images', 'product_variants',
  'orders', 'order_items',
  'visits', 'reports', 'service_requests', 'invoices', 'subscriptions',
]);

export class TenancyError extends Error {
  constructor(msg) {
    super(`[عزل المتاجر] ${msg}`);
    this.name = 'TenancyError';
    this.status = 500;
  }
}

function assertTable(table) {
  if (!TENANT_TABLES.has(table)) {
    throw new TenancyError(`الجدول «${table}» ليس جدولاً تابعاً — استخدم db مباشرة عبر طبقة غير تابعة.`);
  }
}

/** يبني `a = ? AND b = ?` مع القيم، ودائماً store_id أولاً */
function buildWhere(storeId, where) {
  const clauses = ['store_id = ?'];
  const values = [storeId];
  for (const [k, v] of Object.entries(where ?? {})) {
    if (v === undefined) continue;
    if (v === null) { clauses.push(`${k} IS NULL`); continue; }
    clauses.push(`${k} = ?`);
    values.push(v);
  }
  return { sql: clauses.join(' AND '), values };
}

/**
 * البوابة الوحيدة لبيانات أي متجر.
 * @param {number} storeId
 */
export function scope(storeId, conn = db) {
  const id = Number(storeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new TenancyError('مُعرّف المتجر غير صالح — رُفض الاستعلام قبل تنفيذه.');
  }

  const api = {
    storeId: id,

    async all(table, where, { order = '', limit = 0, offset = 0 } = {}) {
      assertTable(table);
      const w = buildWhere(id, where);
      let sql = `SELECT * FROM ${table} WHERE ${w.sql}`;
      if (order) sql += ` ORDER BY ${order}`;
      if (limit) sql += ` LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
      return conn.prepare(sql).all(...w.values);
    },

    /**
     * `forUpdate` يقفل الصف حتى نهاية المعاملة.
     * SQLite كان يسلسل كل الكتابات بـ BEGIN IMMEDIATE؛ Postgres
     * يسمح بالتزامن، فبدون القفل يقرأ طلبان الكمية نفسها ويبيعان
     * القطعة ذاتها مرتين.
     */
    async get(table, where, { forUpdate = false } = {}) {
      assertTable(table);
      const w = buildWhere(id, where);
      const lock = forUpdate ? ' FOR UPDATE' : '';
      return await conn.prepare(`SELECT * FROM ${table} WHERE ${w.sql} LIMIT 1${lock}`).get(...w.values);
    },

    async count(table, where) {
      assertTable(table);
      const w = buildWhere(id, where);
      const row = await conn.prepare(`SELECT COUNT(*)::int n FROM ${table} WHERE ${w.sql}`).get(...w.values);
      return row.n;
    },

    async insert(table, data) {
      assertTable(table);
      // store_id يُفرض من النطاق، ويتجاهل أي قيمة قادمة من المُدخل
      const row = { ...data, store_id: id };
      const cols = Object.keys(row);
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      const res = await conn.prepare(sql).run(...cols.map((c) => row[c]));
      return Number(res.lastInsertRowid);
    },

    async update(table, rowId, data) {
      assertTable(table);
      const patch = { ...data };
      delete patch.store_id;            // لا يمكن نقل صف من متجر لآخر
      delete patch.id;
      const cols = Object.keys(patch);
      if (!cols.length) return 0;
      const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ? AND store_id = ?`;
      const res = await conn.prepare(sql).run(...cols.map((c) => patch[c]), rowId, id);
      return res.changes;
    },

    async remove(table, rowId) {
      assertTable(table);
      const res = await conn.prepare(`DELETE FROM ${table} WHERE id = ? AND store_id = ?`).run(rowId, id);
      return res.changes;
    },

    /**
     * منفذ SQL الحر — للاستعلامات المركّبة (JOIN / GROUP BY).
     * يرفض أي جملة لا تذكر store_id، فلا يمكن تسريب صف عن طريق النسيان.
     */
    async raw(sql, params = []) {
      if (!/\bstore_id\b/.test(sql)) {
        throw new TenancyError('جملة SQL حرة بلا شرط store_id — رُفضت.');
      }
      return conn.prepare(sql).all(...params);
    },
  };

  return api;
}

/** فحص انطلاق: يتأكد أن كل جدول تابع يملك فعلاً عمود store_id */
export async function verifyIsolation() {
  const missing = [];
  // information_schema بديل PRAGMA — ونسأل مرة واحدة لا مرة لكل جدول
  const rows = await db.prepare(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'store_id'`).all();
  const have = new Set(rows.map((r) => r.table_name));
  for (const t of TENANT_TABLES) {
    if (!have.has(t)) missing.push(t);
  }
  if (missing.length) {
    throw new TenancyError(`جداول تابعة بلا عمود store_id: ${missing.join(', ')}`);
  }
  return true;
}
