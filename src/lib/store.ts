import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { pgTable, integer, text } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import { categories, deliveryZones, productReviews, productVariants, products, stores } from '@/db/schema';
import { DEFAULT_COUNTRY, symbolOf } from '@/lib/countries';
import { layoutOf, tierOf } from '@/lib/theme';

/**
 * بيانات واجهة المتجر — تُقرأ على الخادم وتُصيَّر معه.
 *
 * لماذا لا تمرّ بـ`scope()`: تلك البوابة تحمي بيانات **تاجر**
 * من تاجر آخر داخل لوحته. وهنا نحن في الواجهة العامة، ونقرأ
 * متجراً واحداً بمعرّفه بعد حلّه من الرابط — وكل استعلام أدناه
 * يحمل `storeId` صريحاً في شرطه. لا استعلام واحد بلا هذا الشرط.
 */

/**
 * القالب **الفعّال** لا المحفوظ — مرآة `effectiveLayout` في
 * `src/routes/merchant.js`. متجرٌ هبط من برو يحتفظ باختياره في
 * القاعدة (§٥.٥ إخفاء لا حذف) لكن الواجهة تعود إلى «التوقيع»،
 * وإلا ظل يعرض قالباً لم يعد يدفع ثمنه.
 */
const effectiveLayout = (plan: string, layout: string) =>
  (tierOf(plan) === 'signature' ? layoutOf(layout).id : 'signature');

/** الروابط القديمة تظل تعمل وتحوّل إلى الجديد (§٣.٢) */
const slugHistory = pgTable('store_slug_history', {
  oldSlug: text('old_slug').primaryKey(),
  storeId: integer('store_id').notNull(),
  changedAt: text('changed_at').notNull(),
});

export interface StoreView {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  city: string;
  address: string;
  whatsapp: string;
  hours: string;
  logo: string;
  banner: string;
  showcase: string;
  color: string;
  colorDeep: string;
  plan: string;
  theme: string;
  /** قالب واجهة برو الفعّال — signature | atelier */
  layout: string;
  verified: boolean;
  deliveryFee: number;
  deliveryFreeOver: number;
  deliveryNote: string;
  /** طرق الدفع التي أعلنها التاجر — cod دائماً من بينها */
  payMethods: string[];
  payNote: string;
  /** ISO حرفان */
  country: string;
  /** رمز العملة المعروض — مشتقّ من الدولة لا مخزَّن معها */
  currency: string;
}

export interface ZoneView {
  id: number;
  name: string;
  fee: number;
  freeOver: number;
}

export interface ProductView {
  id: number;
  name: string;
  summary: string;
  description: string;
  variant: string;
  price: number;
  oldPrice: number | null;
  qty: number;
  image: string;
  categoryId: number | null;
  hasVariants: boolean;
  /** مؤشر توفّر صادق — لا يُستبدل بالنجوم بل يقف بجوارها (§٣.٤) */
  stock: 'none' | 'low' | 'ok';
  stockLabel: string;
  /** ماركة كتبها التاجر — فارغة تعني «بلا ماركة» فلا تُخترع */
  brand: string;
  /**
   * متوسّط التقييم وعدده — من `product_reviews` وحدها.
   * صفرٌ يعني «لا أحد قيّم بعد»، والواجهة تصمت حينها بدل أن
   * تعرض أربع نجوم اخترعها المكوّن.
   */
  rating: number;
  reviewCount: number;
  /**
   * محاور الخيارات وقيمها — تُملأ دائماً ويقرأها «أتولييه» وحده:
   * متجر أزياء يعرض المقاسات والألوان في **الشبكة** لا في ورقة
   * المنتج وحدها. فارغة حين لا خيارات — فلا يُخترع «مقاس واحد».
   */
  axes: OptionAxis[];
  /** صور الخيارات المميّزة — أوّلها صورة التمرير الثانية */
  altImages: string[];
}

/** قيمة على محور خيارات — النافد يبقى في القائمة ويُشطب */
export interface OptionValue { value: string; inStock: boolean; image: string }

/**
 * محور خيارات باسمه الذي كتبه التاجر — «المقاس»، «اللون»…
 * لا نخمّن أيّهما لون: القالب يستدلّ بالصور لا بالأسماء.
 */
export interface OptionAxis { key: 'v1' | 'v2'; name: string; values: OptionValue[] }

export interface CategoryView { id: number; name: string; count: number }

/** ماركة وعدد منتجاتها الحيّة — لا تُعرض ماركة بلا منتج */
export interface BrandView { name: string; count: number }

/** يحلّ الرابط إلى متجر، ويعيد وجهة التحويل إن كان الرابط قديماً */
export async function resolveStore(slug: string): Promise<
  { kind: 'ok'; store: StoreView } | { kind: 'moved'; to: string } | { kind: 'none' }
> {
  const row = await db.query.stores.findFirst({ where: eq(stores.slug, slug) });

  if (!row) {
    const old = await db.select().from(slugHistory).where(eq(slugHistory.oldSlug, slug)).limit(1);
    if (old[0]) {
      const current = await db.query.stores.findFirst({ where: eq(stores.id, old[0].storeId) });
      if (current && current.status === 'active') return { kind: 'moved', to: current.slug };
    }
    return { kind: 'none' };
  }

  // المتجر الموقوف لا يُخدم للعملاء — ولا يُكشف سبب الإيقاف
  if (row.status !== 'active') return { kind: 'none' };

  return {
    kind: 'ok',
    store: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      about: row.about,
      city: row.city,
      address: row.address,
      whatsapp: row.whatsapp,
      hours: row.hours,
      logo: row.logo,
      banner: row.banner,
      showcase: row.showcase,
      color: row.color,
      colorDeep: row.colorDeep,
      plan: row.plan,
      theme: row.theme,
      layout: effectiveLayout(row.plan, row.layout),
      verified: row.verified === 1,
      deliveryFee: row.deliveryFee,
      deliveryFreeOver: row.deliveryFreeOver,
      deliveryNote: row.deliveryNote,
      payMethods: String(row.payMethods || 'cod').split(',').map((m) => m.trim()).filter(Boolean),
      payNote: row.payNote,
      country: row.country || DEFAULT_COUNTRY,
      currency: symbolOf(row.country),
    },
  };
}

/** مناطق التوصيل — قد تكون فارغة، وحينها يُطبَّق رسم المتجر العام */
export async function storeZones(storeId: number): Promise<ZoneView[]> {
  const rows = await db.select().from(deliveryZones)
    .where(eq(deliveryZones.storeId, storeId))
    .orderBy(asc(deliveryZones.sort), asc(deliveryZones.id));

  return rows.map((z) => ({ id: z.id, name: z.name, fee: z.fee, freeOver: z.freeOver }));
}

type Verdict = { avg: number; count: number };

/** صفّ خيار كما يُقرأ من القاعدة — أقلّ ما تحتاجه الشبكة */
type VariantRow = { v1: string; v2: string; qty: number; image: string };

/**
 * محاور الخيارات لمنتج واحد.
 *
 * الترتيب ترتيب التاجر (الاستعلام مرتَّب بـ sort ثم id) ولا
 * يُرتَّب أبجدياً أبداً: «كبير» قبل «صغير» ترتيبٌ خاطئ يقرؤه
 * العميل مقاساتٍ مبعثرة.
 *
 * والقيمة النافدة تبقى في القائمة ومعها inStock=false فتُعرض
 * مشطوبة لا محذوفة — العميل يعرف أن المقاس موجود ونفد، لا أنه
 * غير مصنوع (§٣.٤).
 */
const axesOf = (p: typeof products.$inferSelect, rows: VariantRow[]): OptionAxis[] => {
  if (p.hasVariants !== 1 || rows.length === 0) return [];

  const axis = (key: 'v1' | 'v2', name: string): OptionAxis | null => {
    if (!name) return null;
    const seen = new Map<string, OptionValue>();
    for (const r of rows) {
      const value = r[key];
      if (!value) continue;
      const had = seen.get(value);
      if (!had) { seen.set(value, { value, inStock: r.qty > 0, image: r.image }); continue; }
      if (r.qty > 0) had.inStock = true;
      if (!had.image && r.image) had.image = r.image;
    }
    return seen.size ? { key, name, values: [...seen.values()] } : null;
  };

  return [axis('v1', p.opt1Name), axis('v2', p.opt2Name)]
    .filter((a): a is OptionAxis => a !== null);
};

const shape = (
  p: typeof products.$inferSelect,
  verdict?: Verdict,
  rows: VariantRow[] = [],
): ProductView => ({
  id: p.id,
  name: p.name,
  summary: p.summary,
  description: p.description,
  variant: p.variant,
  price: p.price,
  oldPrice: p.oldPrice,
  qty: p.qty,
  image: p.image,
  categoryId: p.categoryId,
  hasVariants: p.hasVariants === 1,
  stock: p.qty <= 0 ? 'none' : p.qty <= 5 ? 'low' : 'ok',
  stockLabel:
    p.qty <= 0 ? 'نفد المخزون'
      : p.qty <= 5 ? `بقي ${p.qty.toLocaleString('ar-EG')} فقط`
        : 'متوفر',
  brand: p.brand,
  rating: verdict?.avg ?? 0,
  reviewCount: verdict?.count ?? 0,
  axes: axesOf(p, rows),
  // صورة المنتج ليست بديلاً لنفسها: نستبعدها فلا يومض التمرير
  // على الصورة ذاتها
  altImages: [...new Set(rows.map((r) => r.image).filter((i) => i && i !== p.image))],
});

export async function storeCatalogue(storeId: number) {
  const [rows, cats, verdicts, options] = await Promise.all([
    db.select().from(products)
      .where(and(eq(products.storeId, storeId), eq(products.live, 1)))
      .orderBy(asc(products.sort), desc(products.id)),
    /**
     * التصنيفات بلا عدّاد هنا — يُحسب أدناه من المنتجات نفسها.
     * العدّ باستعلام منفصل كان يعطي رقماً لا يطابق ما يُعرض حين
     * يختلف شرط الأول عن شرط الثاني، والرقم الذي يقول «٤ منتجات»
     * ثم تفتحه على منتجين أسوأ من غياب الرقم.
     */
    db.select({ id: categories.id, name: categories.name }).from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(asc(categories.sort), asc(categories.id)),
    /**
     * التقييمات تُجمع في استعلام واحد لكل المتجر، لا استعلام
     * لكل منتج: شبكة من أربعين منتجاً تعني أربعين ذهاباً وإياباً
     * إلى قاعدة خلف مجمّع — وهو ما يُبطئ الصفحة أكثر مما تفيده
     * النجوم. والمخفيّ لا يدخل الحساب.
     */
    db.select({
      productId: productReviews.productId,
      avg: sql<number>`avg(${productReviews.rating})::float`,
      count: sql<number>`count(*)::int`,
    }).from(productReviews)
      .where(and(eq(productReviews.storeId, storeId), eq(productReviews.hidden, 0)))
      .groupBy(productReviews.productId),
    /**
     * خيارات المتجر كلها في استعلام واحد.
     *
     * قالب «أتولييه» يعرض المقاسات والألوان في الشبكة ويرشّح
     * بها، ومرشّحٌ بلا قيم لا يُبنى. واستعلامٌ لكل بطاقة يعني
     * أربعين ذهاباً وإياباً لشبكة واحدة — كما في التقييمات
     * أعلاه، فجُمعت هنا مرة واحدة.
     *
     * والترتيب ترتيب التاجر، وهو ترتيب العرض.
     */
    db.select({
      productId: productVariants.productId,
      v1: productVariants.v1,
      v2: productVariants.v2,
      qty: productVariants.qty,
      image: productVariants.image,
    }).from(productVariants)
      .where(and(eq(productVariants.storeId, storeId), eq(productVariants.live, 1)))
      .orderBy(asc(productVariants.sort), asc(productVariants.id)),
  ]);

  const byProduct = new Map<number, Verdict>(
    verdicts.map((v) => [v.productId, { avg: Number(v.avg) || 0, count: v.count }]),
  );

  const optsOf = new Map<number, VariantRow[]>();
  for (const o of options) {
    const list = optsOf.get(o.productId);
    if (list) list.push(o); else optsOf.set(o.productId, [o]);
  }

  const shaped = rows.map((p) => shape(p, byProduct.get(p.id), optsOf.get(p.id) ?? []));

  // العدّادات كلّها تُشتقّ من المنتجات المعروضة نفسها، فلا يظهر
  // في مرشّحٍ خيارٌ لا يعطي اختياره نتيجة واحدة
  const catTally = new Map<number, number>();
  const brandTally = new Map<string, number>();
  for (const p of shaped) {
    if (p.categoryId !== null) catTally.set(p.categoryId, (catTally.get(p.categoryId) ?? 0) + 1);
    if (p.brand) brandTally.set(p.brand, (brandTally.get(p.brand) ?? 0) + 1);
  }

  return {
    products: shaped,
    categories: cats
      .map((c): CategoryView => ({ ...c, count: catTally.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0),
    brands: [...brandTally.entries()]
      .map(([name, count]): BrandView => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar')),
  };
}

/** خيارات منتج — تُجلب عند فتح المنتج فقط، لا مع الشبكة */
export async function variantsFor(storeId: number, productId: number) {
  return db.select().from(productVariants)
    .where(and(
      eq(productVariants.storeId, storeId),
      eq(productVariants.productId, productId),
      eq(productVariants.live, 1),
    ))
    .orderBy(asc(productVariants.sort), asc(productVariants.id));
}
