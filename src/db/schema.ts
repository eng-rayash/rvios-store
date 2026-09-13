/**
 * مخطّط Drizzle — مرآة لـ `ops/sql/schema.pg.sql` لا بديل عنه.
 *
 * قرار حاكم أثناء الترحيل: **الملفّ الأصلي يبقى مصدر الحقيقة**
 * للبنية، وهذا الملف يصفها لـTypeScript فقط. النظامان يعملان
 * على القاعدة نفسها في الوقت نفسه، فأي `drizzle-kit push` يولّد
 * هجرة موازية سيشقّ المخطّط إلى نسختين متعارضتين.
 *
 * ولذلك: نُغيّر البنية في `schema.pg.sql` أولاً، ثم نعكسها هنا.
 * وبعد اكتمال الترحيل وإطفاء الخادم القديم يُقلب الاتجاه.
 *
 * ملاحظة على الأنواع: التواريخ نصوص (TEXT) لا timestamptz —
 * إرث من SQLite قبل الهجرة إلى PostgreSQL. لا نُصلحه هنا لأن
 * ذلك يستلزم ترحيل بيانات يمسّ النظامين معاً.
 */
import {
  pgTable, integer, text, primaryKey, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

export const merchants = pgTable('merchants', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull().default(''),
  createdAt: text('created_at').notNull(),
  storeSlots: integer('store_slots').notNull().default(1),
});

export const stores = pgTable('stores', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  merchantId: integer('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sector: text('sector').notNull().default('other'),
  tagline: text('tagline').notNull().default(''),
  about: text('about').notNull().default(''),
  city: text('city').notNull().default(''),
  address: text('address').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),
  hours: text('hours').notNull().default(''),
  logo: text('logo').notNull().default(''),
  banner: text('banner').notNull().default(''),
  color: text('color').notNull().default('#9E2226'),
  colorDeep: text('color_deep').notNull().default('#6E1519'),
  plan: text('plan').notNull().default('basic'),
  verified: integer('verified').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  showcase: text('showcase').notNull().default(''),
  theme: text('theme').notNull().default('signature'),
  /** قالب واجهة برو — signature | atelier؛ محورٌ مستقلّ عن theme */
  layout: text('layout').notNull().default('signature'),
  deliveryFee: integer('delivery_fee').notNull().default(0),
  deliveryFreeOver: integer('delivery_free_over').notNull().default(0),
  deliveryNote: text('delivery_note').notNull().default(''),
  /** قائمة مفصولة بفواصل: cod,wallet,bank — والـcod لا تُنزع */
  payMethods: text('pay_methods').notNull().default('cod'),
  payNote: text('pay_note').notNull().default(''),
  /** ISO حرفان — والعملة تُشتقّ منه في lib/countries، ولا تُخزَّن */
  country: text('country').notNull().default('YE'),
}, (t) => [index('ix_stores_merchant').on(t.merchantId)]);

/**
 * مناطق التوصيل.
 * رسم واحد لصنعاء وعدن وحضرموت غير قابل للاستخدام — التاجر
 * إمّا يخسر أو يبالغ، وفي الحالتين يترك المنصة.
 */
export const deliveryZones = pgTable('delivery_zones', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  fee: integer('fee').notNull().default(0),
  freeOver: integer('free_over').notNull().default(0),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('ix_zones_store').on(t.storeId, t.sort)]);

/**
 * العملاء — هوية داخل المتجر الواحد.
 * لا عدّادات مخزَّنة هنا: «عدد الطلبات» و«إجمالي المشتريات»
 * تُحسبان بالاستعلام، لأن العدّاد المخزَّن ينحرف بصمت.
 */
export const customers = pgTable('customers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  name: text('name').notNull().default(''),
  address: text('address').notNull().default(''),
  firstAt: text('first_at').notNull(),
  lastAt: text('last_at').notNull(),
}, (t) => [uniqueIndex('ux_customer_phone').on(t.storeId, t.phone)]);

export const categories = pgTable('categories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('ix_categories_store').on(t.storeId, t.sort)]);

export const products = pgTable('products', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id'),
  name: text('name').notNull(),
  summary: text('summary').notNull().default(''),
  description: text('description').notNull().default(''),
  /** وصف مختصر للمنتج بلا خيارات (مقاس/حجم) — سابق لنظام الخيارات */
  variant: text('variant').notNull().default(''),
  price: integer('price').notNull().default(0),
  oldPrice: integer('old_price'),
  /** مصدر الحقيقة حين has_variants = 0، ومجموع مخزَّن حين = 1 */
  qty: integer('qty').notNull().default(0),
  image: text('image').notNull().default(''),
  live: integer('live').notNull().default(1),
  sort: integer('sort').notNull().default(0),
  createdAt: text('created_at').notNull(),
  hasVariants: integer('has_variants').notNull().default(0),
  opt1Name: text('opt1_name').notNull().default(''),
  opt2Name: text('opt2_name').notNull().default(''),
  lowStock: integer('low_stock').notNull().default(0),
  /** ماركة المنتج — فارغة تعني «لا ماركة»، فيختفي مرشّحها */
  brand: text('brand').notNull().default(''),
}, (t) => [index('ix_products_store').on(t.storeId, t.live)]);

/**
 * تقييمات المنتجات — يكتبها بشر لا مولِّد أرقام.
 * الواجهة تقرأ منها متوسّطاً وعدداً؛ الكتابة والإخفاء والردّ
 * ما زالت في الخادم القديم (`src/reviews.js`).
 */
export const productReviews = pgTable('product_reviews', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  name: text('name').notNull().default(''),
  body: text('body').notNull().default(''),
  authorKey: text('author_key').notNull().default(''),
  verified: integer('verified').notNull().default(0),
  /** إخفاء لا حذف — التاجر يُخفي المسيء ويبقى الصفّ للمراجعة */
  hidden: integer('hidden').notNull().default(0),
  reply: text('reply').notNull().default(''),
  replyAt: text('reply_at'),
  createdAt: text('created_at').notNull(),
}, (t) => [index('ix_reviews_product').on(t.storeId, t.productId, t.hidden)]);

export const productImages = pgTable('product_images', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('ix_pimages_product').on(t.productId, t.sort)]);

export const productVariants = pgTable('product_variants', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  v1: text('v1').notNull().default(''),
  v2: text('v2').notNull().default(''),
  /** NULL يعني «يرث سعر المنتج» — لا صفراً */
  price: integer('price'),
  qty: integer('qty').notNull().default(0),
  sku: text('sku').notNull().default(''),
  image: text('image').notNull().default(''),
  live: integer('live').notNull().default(1),
  sort: integer('sort').notNull().default(0),
}, (t) => [
  uniqueIndex('ux_variant_combo').on(t.productId, t.v1, t.v2),
  index('ix_variants_product').on(t.productId, t.sort),
]);

export const orders = pgTable('orders', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  ref: text('ref').notNull().unique(),
  custName: text('cust_name').notNull().default(''),
  custPhone: text('cust_phone').notNull().default(''),
  custAddress: text('cust_address').notNull().default(''),
  note: text('note').notNull().default(''),
  subtotal: integer('subtotal').notNull().default(0),
  deliveryFee: integer('delivery_fee').notNull().default(0),
  total: integer('total').notNull().default(0),
  status: text('status').notNull().default('wait'),
  createdAt: text('created_at').notNull(),
}, (t) => [index('ix_orders_store').on(t.storeId, t.status)]);

export const orderItems = pgTable('order_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId: integer('product_id'),
  variantId: integer('variant_id'),
  name: text('name').notNull(),
  /** التسمية وقت الطلب — تبقى للسجل ولو حُذف الخيار لاحقاً */
  variant: text('variant').notNull().default(''),
  price: integer('price').notNull(),
  qty: integer('qty').notNull(),
}, (t) => [index('ix_items_order').on(t.orderId)]);

export const visits = pgTable('visits', {
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.storeId, t.day] })]);

/** الجداول التابعة — أي استعلام عليها يمرّ بـ scope() */
export const TENANT_TABLES = [
  'categories', 'products', 'product_images', 'product_variants',
  'orders', 'order_items', 'visits',
] as const;

export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
