
CREATE TABLE IF NOT EXISTS merchants (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sector      TEXT NOT NULL DEFAULT 'other',
  tagline     TEXT NOT NULL DEFAULT '',
  about       TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  whatsapp    TEXT NOT NULL DEFAULT '',
  hours       TEXT NOT NULL DEFAULT '',
  logo        TEXT NOT NULL DEFAULT '',
  banner      TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#9E2226',
  color_deep  TEXT NOT NULL DEFAULT '#6E1519',
  plan        TEXT NOT NULL DEFAULT 'basic',
  verified    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL
);

-- §٣.٣ — الروابط القديمة لا تُحذف أبداً، بل تُحوَّل ٣٠١.
-- رابط التاجر منشور في مئات محادثات واتساب؛ كسره يعني
-- خسارة مبيعاته وثقته دفعةً واحدة (§٧ خطر ٣).
CREATE TABLE IF NOT EXISTS store_slug_history (
  old_slug   TEXT PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id  INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  variant     TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL DEFAULT 0,
  old_price   INTEGER,
  qty         INTEGER NOT NULL DEFAULT 0,
  image       TEXT NOT NULL DEFAULT '',
  live        INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ref        TEXT NOT NULL UNIQUE,
  cust_name  TEXT NOT NULL DEFAULT '',
  cust_phone TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  total      INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'wait',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER,
  name       TEXT NOT NULL,
  variant    TEXT NOT NULL DEFAULT '',
  price      INTEGER NOT NULL,
  qty        INTEGER NOT NULL
);

-- صور إضافية لكل منتج (§٢.١ — العدد يتدرّج مع الباقة).
-- products.image يبقى صورة الغلاف: أسرع في قوائم الشبكة،
-- ويضمن أن كل منتج له صورة واحدة على الأقل بلا انضمام.
CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visits (
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, day)
);

-- بصمة زائر يومية لعدّ الزوّار الفريدين بدل كل تحديث للصفحة.
-- تُخزَّن كتجزئة فقط (لا IP خام)، وتُحذف بعد يومين — فلا تتبّع
-- أفراد ولا احتفاظ ببيانات تعريفية (سياسة الخصوصية §١).
CREATE TABLE IF NOT EXISTS visit_marks (
  mark     TEXT PRIMARY KEY,
  day      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_requests (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  contact    TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

-- ═══ الفوترة (§٥) ═══════════════════════════════════════
-- النطاق: التاجر → RVIOS فقط. مبيعات العملاء للتجار لا تمرّ
-- بالمنصة إطلاقاً، فتبقى «بائع خدمة برمجية» لا مجمّع مدفوعات.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id           INTEGER NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  plan               TEXT NOT NULL DEFAULT 'basic',
  status             TEXT NOT NULL DEFAULT 'active',  -- active | grace | expired
  current_period_end TEXT,
  auto_renew         INTEGER NOT NULL DEFAULT 0,
  notified_at        TEXT,                            -- آخر تذكير أُرسل
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ref         TEXT NOT NULL UNIQUE,      -- RV-INV-4821 · يكتبه التاجر في ملاحظات التحويل
  kind        TEXT NOT NULL,             -- subscription | store_build | domain | extra_store
  plan        TEXT,
  months      INTEGER NOT NULL DEFAULT 1,
  amount      INTEGER NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'YER',
  status      TEXT NOT NULL DEFAULT 'unpaid',  -- unpaid | under_review | paid | void
  method      TEXT,
  proof_key   TEXT,
  paid_at     TEXT,
  reviewed_by TEXT,
  void_reason TEXT,
  due_at      TEXT,
  created_at  TEXT NOT NULL
);

-- إعدادات المنصة (أسعار الباقات وتعليمات التحويل).
-- في قاعدة البيانات لا في الكود: §١١ تترك السعر قراراً معلّقاً،
-- فيضبطه الفريق من لوحة الإدارة دون إعادة نشر.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- سجل تدقيق لأفعال الإدارة (§٤ قاعدة ٤)
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'merchant',
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otps (
  phone      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

-- سجل رسائل واتساب الصادرة وحالتها الفعلية من Meta.
-- بدونه لا نعرف إن كان رمز التحقق قد وصل أصلاً: نجاح نداء
-- الـAPI يعني «قبِلَت Meta الطلب» لا «قرأه التاجر». الفرق
-- بينهما هو الفرق بين تاجر يدخل وتاجر يظنّ المنصة معطّلة.
CREATE TABLE IF NOT EXISTS wa_messages (
  wamid      TEXT PRIMARY KEY,
  phone      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'otp',   -- otp · order
  status     TEXT NOT NULL DEFAULT 'sent',  -- sent · delivered · read · failed
  error_code TEXT,
  error_text TEXT,
  sent_at    TEXT NOT NULL,
  updated_at TEXT NOT NULL
);


CREATE INDEX IF NOT EXISTS ix_products_store   ON products(store_id, live);
CREATE INDEX IF NOT EXISTS ix_categories_store ON categories(store_id, sort);
CREATE INDEX IF NOT EXISTS ix_orders_store     ON orders(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS ix_items_store      ON order_items(store_id);
CREATE INDEX IF NOT EXISTS ix_reports_store    ON reports(store_id, status);
CREATE INDEX IF NOT EXISTS ix_pimages_product  ON product_images(product_id, sort);
CREATE INDEX IF NOT EXISTS ix_pimages_store    ON product_images(store_id);
CREATE INDEX IF NOT EXISTS ix_invoices_status  ON invoices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_invoices_store   ON invoices(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_subs_status      ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS ix_audit_time       ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_slug_history     ON store_slug_history(store_id);
CREATE INDEX IF NOT EXISTS ix_stores_merchant  ON stores(merchant_id);
CREATE INDEX IF NOT EXISTS ix_sessions_exp     ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS ix_wa_sent          ON wa_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS ix_wa_status        ON wa_messages(status, sent_at DESC);


-- أعمدة أُضيفت بعد الإصدار الأول
ALTER TABLE stores ADD COLUMN IF NOT EXISTS showcase TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'signature';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_free_over INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_note TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cust_address TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS store_slots INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_store_id INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notified_stage TEXT;


-- ═══════════════════════════════════════════════════════════
--  خيارات المنتج (المقاسات والألوان)
--
--  محورا الخيارات يُسمّيان على المنتج نفسه (opt1_name/opt2_name)
--  لا على كل صفّ، فلا يمكن أن يكتب التاجر «المقاس» مرة و«مقاس»
--  مرة أخرى داخل المنتج الواحد. والصفوف في product_variants
--  تحمل القيم فقط.
--
--  products.qty يبقى مصدر الحقيقة حين has_variants = 0، ويصير
--  مجموعاً مخزَّناً لكميات الخيارات حين تساوي 1 — يُعاد حسابه
--  داخل المعاملة نفسها في server/variants.js فلا ينحرف.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS opt1_name TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS opt2_name TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  v1         TEXT NOT NULL DEFAULT '',
  v2         TEXT NOT NULL DEFAULT '',
  -- سعر خاص بالخيار؛ NULL يعني «يرث سعر المنتج»
  price      INTEGER,
  qty        INTEGER NOT NULL DEFAULT 0,
  sku        TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  live       INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0
);

-- تركيبة القيمتين فريدة داخل المنتج الواحد
CREATE UNIQUE INDEX IF NOT EXISTS ux_variant_combo
  ON product_variants(product_id, v1, v2);
CREATE INDEX IF NOT EXISTS ix_variants_product ON product_variants(product_id, sort);
CREATE INDEX IF NOT EXISTS ix_variants_store   ON product_variants(store_id);

-- الخيار المطلوب يُحفَظ في سطر الطلب: variant النصّي يبقى للسجل
-- التاريخي (لو حُذف الخيار لاحقاً)، وvariant_id لإعادة المخزون
-- عند الإلغاء.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER;


-- ═══════════════════════════════════════════════════════════
--  العملاء
--
--  الاسم والجوال كانا منسوخين في صفّ الطلب وحده، فلا سبيل إلى
--  معرفة أن عميلاً اشترى مرتين. هذا الجدول يمنح العميل هوية
--  داخل المتجر، وعليه يُبنى كل تحليل لاحق.
--
--  ★ لا عدّادات مخزَّنة هنا عمداً: «عدد الطلبات» و«إجمالي
--  المشتريات» تُحسب بالاستعلام من orders. العدّاد المخزَّن ينحرف
--  عند كل إلغاء أو تغيير حالة، وانحرافه **صامت** — التاجر يرى
--  رقماً خاطئاً ولا شيء يكسر لينبّهه.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  first_at   TEXT NOT NULL,
  last_at    TEXT NOT NULL
);

-- الجوال يعرّف العميل داخل متجره وحده — ورقم واحد قد يشتري من
-- متجرين، فهما عميلان مستقلّان لا واحد.
CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_phone ON customers(store_id, phone);
CREATE INDEX IF NOT EXISTS ix_customers_store ON customers(store_id, last_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;


-- ═══════════════════════════════════════════════════════════
--  مناطق التوصيل
--
--  رسم واحد لصنعاء وعدن وحضرموت غير قابل للاستخدام: التاجر
--  إمّا يخسر أو يبالغ، وفي الحالتين يترك المنصة.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS delivery_zones (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  fee        INTEGER NOT NULL DEFAULT 0,
  free_over  INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_zones_store ON delivery_zones(store_id, sort);

-- zone_name نصّ محفوظ لا مرجع: حذف المنطقة لاحقاً يجب ألّا يمحو
-- ما دفعه العميل فعلاً في طلب مضى.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_name TEXT NOT NULL DEFAULT '';


-- ═══════════════════════════════════════════════════════════
--  الدفع المحلي — شبه يدوي
--
--  لا بوابة دفع ولا عمولة: المنصة لا تلمس أموال المبيعات ولا
--  تضمنها، وتأكيد الدفع قرار التاجر وحده. النمط منقول عن
--  فوترة الاشتراك في server/billing.js لا مُخترع.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_note    TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pay_methods TEXT NOT NULL DEFAULT 'cod';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_method TEXT NOT NULL DEFAULT 'cod';
-- أربع حالات لا ثلاث، والفرق بين await وpending يهمّ التاجر:
--   none    = عند الاستلام، لا دفع مسبق أصلاً
--   await   = ينتظر أن يحوّل العميل ويرفع إيصاله
--   pending = رُفع الإيصال وينتظر مراجعة التاجر  ← هنا يعمل التاجر
--   paid    = أكّده التاجر
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_proof  TEXT NOT NULL DEFAULT '';


-- ═══════════════════════════════════════════════════════════
--  الدولة — رفع القفل اليمني
--
--  عمود واحد لا عمودان: **العملة تُشتقّ من الدولة** في
--  server/countries.js ولا تُخزَّن. تخزينها يسمح بمتجر في مصر
--  يحمل عملة يمنية، وهو انحراف صامت لا شيء يكشفه إلا فاتورة
--  عميل غاضب.
--
--  الافتراضي `YE` يبقي كل متجر قائم على حاله حرفياً.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'YE';


-- ═══════════════════════════════════════════════════════════
--  تقييمات المنتجات
--
--  §٣.٤ كانت قد اختارت «مؤشر توفّر صادق بدل نجوم تقييم غير
--  حقيقية». هذا الجدول لا ينقض ذلك المبدأ بل يحقّقه: النجوم
--  هنا يكتبها بشر لا مولِّد أرقام.
--
--  `store_id` رغم أن `product_id` يكفي تقنياً — بدونه لا تمرّ
--  الجداولُ فحصَ العزل في server/tenancy.js، ويصبح تسريب تقييمات
--  متجر إلى آخر مسألةَ نسيانِ شرطٍ في استعلام واحد.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS product_reviews (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id   INTEGER NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  name       TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  -- بصمة كاتب التقييم: تجزئة لا عنوان خام. تكفي لكشف التكرار
  -- ولا تسمح بتتبّع زائر عبر المتاجر لأن الملح يدخل فيها.
  author_key TEXT NOT NULL DEFAULT '',
  -- المشتري الموثَّق: رقمه عليه طلبٌ يحوي هذا المنتج. الشارة
  -- تُحسب لحظة الكتابة لا لحظة العرض — الطلب قد يُحذف لاحقاً
  -- ولا يصحّ أن تختفي شارةٌ استحقّها صاحبها.
  verified   INTEGER NOT NULL DEFAULT 0,
  -- إخفاء لا حذف: التاجر يُخفي المسيء ويبقى الصفّ للمراجعة
  hidden     INTEGER NOT NULL DEFAULT 0,
  reply      TEXT NOT NULL DEFAULT '',
  reply_at   TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(store_id, product_id, hidden);
CREATE INDEX IF NOT EXISTS idx_reviews_store   ON product_reviews(store_id, created_at DESC);
-- يمنع تكرار التقييم نفسه من الجهاز نفسه على المنتج نفسه.
-- جزئي: الصفوف بلا بصمة (بذرة أو استيراد) لا يقيّدها شيء.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_once
  ON product_reviews(product_id, author_key) WHERE author_key <> '';


-- ═══════════════════════════════════════════════════════════
--  بيانات التاجر والتحقق منها
--
--  الهاتف يُثبت أن الرقم بيده، والبريد يُثبت هويةً ثانية لا
--  تُشترى ببطاقة شريحة. الاثنان معاً يجعلان انتحال تاجرٍ
--  مكلفاً بما يكفي.
--
--  البريد على `merchants` لا `stores`: التاجر شخص واحد ولو
--  ملك خمسة متاجر، وتكرار بياناته في كل صفّ متجر يعني خمس
--  نسخ تتباعد عند أول تعديل.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email          TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0;
-- معرّف جوجل الثابت (`sub`): البريد قد يتغيّر، وهذا لا يتغيّر.
-- الربط به يمنع سرقة حساب بتغيير بريدٍ في مكان آخر.
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS google_sub     TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS full_name      TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS national_id    TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS city           TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS address        TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_type  TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS profile_at     TEXT;
-- حالة تدقيق الإدارة: none → pending → approved | rejected
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_status     TEXT NOT NULL DEFAULT 'none';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_note       TEXT NOT NULL DEFAULT '';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_at         TEXT;

-- بريدان لتاجرين مختلفين لا يجوز أن يتطابقا، والفراغ مستثنى
-- لأن التجار القدامى كلهم بلا بريد ولا يصحّ أن يتصادموا.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_email
  ON merchants(email) WHERE email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_google
  ON merchants(google_sub) WHERE google_sub <> '';


-- ═══════════════════════════════════════════════════════════
--  الماركة على المنتج
--
--  «العلامات التجارية» في مرشّحات المتجر كانت الحقل الوحيد في
--  الواجهة بلا مصدر في القاعدة — وكان البديل أن تُشتقّ من اسم
--  المنتج بالتخمين. حقلٌ صريح أصدق: ما لم يكتبه التاجر لا
--  يُعرض، والمرشّح يختفي في متجر لا ماركات فيه بدل أن يعرض
--  قائمةً مخترعة.
--
--  فارغ افتراضياً فلا يتغيّر شيء عند التجّار القائمين.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_brand
  ON products(store_id, brand) WHERE brand <> '';


-- ═══════════════════════════════════════════════════════════
--  قالب واجهة المتجر (برو)
--
--  «السكِن» طبقة لون ومزاج، وهذا **بنية صفحة أخرى**: هيرو بملء
--  الشاشة، شبكة طولية بصور على عارضات، ومقاسات وألوان في
--  الشبكة نفسها. ولذلك عمود منفصل لا قيمة رابعة في theme:
--  متجر عبايات يختار «أتولييه» ويبقى حراً في «منتصف الليل».
--
--  signature افتراضياً فلا يتغيّر شيء عند متاجر برو القائمة.
--  ولا فهرس: القيمة تُقرأ مع صفّ المتجر ولا يُستعلم بها.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE stores ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'signature';
