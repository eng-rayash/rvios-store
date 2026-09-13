import 'server-only';
import { eq } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import type { PlanId } from './plans';

/**
 * كل ما يمسّ القاعدة من أمر الباقات — معزولاً عن `plans.ts`.
 *
 * السبب ليس تنظيمياً بل أمنيّ: `plans.ts` تستورده مكوّنات
 * عميل (استوديو الدرجات)، ولو بقيت قراءة الأسعار فيه لسُحب
 * سائق PostgreSQL — ومعه `DATABASE_URL` — إلى حزمة المتصفح.
 *
 * و`import 'server-only'` أعلاه يحوّل هذا الخطأ من تسريب صامت
 * إلى فشل بناء صريح: أي مكوّن عميل يستورد هذا الملف لن يُبنى.
 */
const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * السعر بالريال يُضبط من لوحة الإدارة، ولا يُخترع في الكود.
 * `null` يعني «لم يُحسم بعد» فتعرض الواجهة «—» بدل رقم مضلّل.
 */
export async function planPrices(): Promise<Record<PlanId, number | null>> {
  const out: Record<PlanId, number | null> = { basic: 0, plus: null, pro: null };
  try {
    for (const id of ['plus', 'pro'] as const) {
      const row = await db.select().from(platformSettings)
        .where(eq(platformSettings.key, `price.${id}`)).limit(1);
      const n = Number(row[0]?.value);
      out[id] = Number.isFinite(n) && n > 0 ? n : null;
    }
  } catch {
    // تعذّر قراءة الإعدادات: نعرض «—» لا رقماً مخترعاً
  }
  return out;
}
