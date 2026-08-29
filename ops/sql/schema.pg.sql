
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
--  داخل المعاملة نفسها في src/variants.js فلا ينحرف.
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
