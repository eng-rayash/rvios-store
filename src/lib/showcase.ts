import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { products, stores } from '@/db/schema';
import { symbolOf } from '@/lib/countries';

/**
 * المتاجر المعروضة على الصفحة الرئيسية.
 *
 * شرط العرض ليس تجميلياً: متجر بلا منتجات يُسيء إلى المنصة
 * أكثر مما ينفعها، ومتجر موقوف لا يُعرض إطلاقاً. الترتيب
 * يقدّم الموثّق ثم الأحدث.
 *
 * هذه قراءة **عابرة للمتاجر** بطبيعتها (نعرض متاجر كثيرة)،
 * فلا تمرّ بـscope — وهو الاستثناء الوحيد المسموح: تقرأ من
 * `stores`، وهو ليس جدولاً تابعاً، وكل حقل تُعيده عامٌّ أصلاً.
 */
export interface ShowcaseStore {
  slug: string;
  name: string;
  sector: string;
  logo: string;
  color: string;
  colorDeep: string;
  plan: string;
  theme: string;
  verified: boolean;
  city: string;
  productCount: number;
  /** رمز العملة المعروض — مشتقّ من دولة المتجر لا مخزَّن معها */
  currency: string;
}

/**
 * المشهد يسقط وحده، لا الصفحة معه.
 *
 * الرئيسية سطح تسويقي: عطلٌ في القاعدة يجب أن يُخفي شريط
 * المتاجر لا أن يردّ ٥٠٠ على زائر جاء ليقرأ ما نبيعه. ولهذا
 * تُبتلع أخطاء القراءة هنا وحدها — وتُسجَّل كاملةً كي لا يصير
 * الابتلاع صمتاً.
 *
 * وهذا أيضاً ما يجعل `next build` يمرّ داخل الصورة بلا قاعدة
 * متاحة: تُصيَّر الصفحة بلا مشهد، ويملؤه أوّل تجديد (ISR).
 */
async function soft<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`[showcase] تعذّرت قراءة ${what} — عُرضت الصفحة بلا مشهد:`, err);
    return fallback;
  }
}

export async function showcaseStores(limit = 8): Promise<ShowcaseStore[]> {
  return soft('المتاجر المعروضة', async () => {
    const rows = await db
      .select({
        slug: stores.slug,
        name: stores.name,
        sector: stores.sector,
        logo: stores.logo,
        color: stores.color,
        colorDeep: stores.colorDeep,
        plan: stores.plan,
        theme: stores.theme,
        verified: stores.verified,
        city: stores.city,
        country: stores.country,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(stores)
      .leftJoin(products, and(eq(products.storeId, stores.id), eq(products.live, 1)))
      .where(eq(stores.status, 'active'))
      .groupBy(stores.id)
      .having(gt(sql`count(${products.id})`, 0))
      .orderBy(desc(stores.verified), desc(stores.id))
      .limit(limit);

    // المشهد على الصفحة الرئيسية يعرض أسعار متاجر حقيقية،
    // وعرضها بعملة غير عملة صاحبها كذبٌ صغير لا داعي له
    return rows.map(({ country, ...r }) => ({
      ...r, verified: r.verified === 1, currency: symbolOf(country),
    }));
  }, []);
}

export interface ShowcaseProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  variant: string;
  summary: string;
}

/** منتجات متجر للعرض داخل أجهزة المشهد — حقيقية لا هيكلية */
export async function storeProducts(slug: string, limit = 6): Promise<ShowcaseProduct[]> {
  return soft(`منتجات ${slug}`, async () => {
    const store = await db.query.stores.findFirst({ where: eq(stores.slug, slug) });
    if (!store) return [];

    return db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        image: products.image,
        variant: products.variant,
        summary: products.summary,
      })
      .from(products)
      // شرط store_id صريح: قراءة منتجات متجر بعينه لا تتخطّى العزل
      .where(and(eq(products.storeId, store.id), eq(products.live, 1)))
      .orderBy(products.sort, desc(products.id))
      .limit(limit);
  }, []);
}
