/**
 * طبقة العزل بين المتاجر — النسخة المُرحَّلة.
 *
 * المبدأ الحاكم لم يتغيّر عن `src/tenancy.js`:
 *   «فرض العزل — لا الاعتماد على تذكّر المطور إضافة الفلتر
 *    في كل استعلام.»
 *
 * الخطر الحقيقي في الترحيل أن يتبخّر هذا الضمان: ORM يجعل
 * كتابة `db.select().from(products)` بلا شرط متجر أسهل من
 * كتابتها معه، فيتسرّب صفٌّ إلى متجر آخر بسطر واحد منسيّ.
 * لذلك لا يُصدَّر مقبض قاعدة عام لأي جدول تابع: البوابة الوحيدة
 * هي `scope(storeId)`، وهي تحقن `store_id` في كل شرط بنفسها.
 *
 * ولأن TypeScript يفرض هذا وقت الترجمة لا وقت التشغيل فقط،
 * فالنسيان يصير خطأ ترجمة لا تسريب بيانات — وهذا المكسب
 * الحقيقي الوحيد الذي يقدّمه الترحيل لهذه الطبقة.
 */
import { and, eq, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from './client';
import {
  categories, products, productImages, productVariants,
  orders, orderItems, visits,
} from './schema';

/** الجداول التابعة وحدها — كل واحد منها يملك عمود store_id */
const TENANT = {
  categories,
  products,
  product_images: productImages,
  product_variants: productVariants,
  orders,
  order_items: orderItems,
  visits,
} as const;

export type TenantTable = keyof typeof TENANT;

export class TenancyError extends Error {
  readonly status = 500;
  constructor(msg: string) {
    super(`[عزل المتاجر] ${msg}`);
    this.name = 'TenancyError';
  }
}

/**
 * البوابة الوحيدة لبيانات أي متجر.
 *
 * @example
 *   const s = scope(store.id);
 *   const live = await s.all('products', eq(products.live, 1));
 */
export function scope(storeId: number) {
  const id = Number(storeId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new TenancyError('مُعرّف المتجر غير صالح — رُفض الاستعلام قبل تنفيذه.');
  }

  /** يدمج شرط المتجر مع أي شرط إضافي — ولا سبيل لتخطّيه */
  const guard = (table: TenantTable, extra?: SQL) => {
    const t = TENANT[table] as PgTable & { storeId: PgColumn };
    const mine = eq(t.storeId, id);
    return extra ? and(mine, extra)! : mine;
  };

  return {
    storeId: id,

    async all<T extends TenantTable>(table: T, where?: SQL) {
      return db.select().from(TENANT[table] as PgTable).where(guard(table, where));
    },

    async one<T extends TenantTable>(table: T, where?: SQL) {
      const rows = await db.select().from(TENANT[table] as PgTable)
        .where(guard(table, where)).limit(1);
      return rows[0] ?? null;
    },

    async count<T extends TenantTable>(table: T, where?: SQL) {
      const rows = await db.select().from(TENANT[table] as PgTable).where(guard(table, where));
      return rows.length;
    },

    /**
     * الإدراج يفرض store_id من النطاق ويتجاهل أي قيمة واردة —
     * كما في النسخة الأصلية: لا يمكن كتابة صفّ في متجر آخر.
     */
    async insert<T extends TenantTable>(table: T, data: Record<string, unknown>) {
      const row = { ...data, storeId: id };
      return db.insert(TENANT[table] as PgTable).values(row as never).returning();
    },

    async update<T extends TenantTable>(table: T, where: SQL, patch: Record<string, unknown>) {
      const clean = { ...patch };
      delete clean.storeId;   // لا يُنقل صفّ من متجر لآخر
      delete clean.id;
      return db.update(TENANT[table] as PgTable).set(clean as never)
        .where(guard(table, where)).returning();
    },

    async remove<T extends TenantTable>(table: T, where: SQL) {
      return db.delete(TENANT[table] as PgTable).where(guard(table, where)).returning();
    },
  };
}

export type Scope = ReturnType<typeof scope>;
