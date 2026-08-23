-- ═══════════════════════════════════════════════════════════
--  مسار الانتقال إلى PostgreSQL مع عزل حقيقي (§٦.٤)
--
--  هذا الملف ليس مُشغَّلاً اليوم. هو الوجهة: حين يوجب النمو
--  الانتقال (تعدّد خوادم · كتابات متزامنة كثيفة · فريق أكبر)،
--  يصبح العزل ضمانة محرك قاعدة البيانات لا انضباط مطوّر.
--
--  التشغيل:  psql "$DATABASE_URL" -f ops/postgres-rls.sql
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ── ١. دور التطبيق ───────────────────────────────────────
-- التطبيق لا يتصل كمالك الجداول: مالك الجدول يتجاوز RLS
-- افتراضياً، فيبطل الغرض كله.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rvios_app') THEN
    CREATE ROLE rvios_app LOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO rvios_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rvios_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rvios_app;

-- ── ٢. سياسة العزل على كل جدول تابع ──────────────────────
-- تقابل TENANT_TABLES في src/tenancy.js حرفاً بحرف.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'categories', 'products', 'product_images', 'orders', 'order_items',
    'visits', 'reports', 'service_requests', 'invoices', 'subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- FORCE يجعل السياسة تسري على مالك الجدول أيضاً.
    -- بدونها يبقى باب خلفي مفتوح عند تشغيل صيانة بحساب المالك.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING      (store_id = current_setting('app.store_id', true)::uuid)
        WITH CHECK (store_id = current_setting('app.store_id', true)::uuid)
    $p$, t);
  END LOOP;
END $$;

-- ملاحظة على USING مقابل WITH CHECK:
--   USING      يحكم ما **يُقرأ** ويُحدَّث من صفوف قائمة
--   WITH CHECK يحكم ما **يُكتب** — بدونها يستطيع مستأجر
--              إدراج صف بـ store_id غيره، فيزرع بيانات في متجر آخر

-- ── ٣. الجداول غير التابعة ───────────────────────────────
-- stores · merchants · sessions · otps · platform_settings ·
-- audit_log · store_slug_history · rate_limits · visit_marks
-- تبقى بلا RLS: يصل إليها التطبيق عبر مسارات مصادقة صريحة
-- (requireStore / requireAdmin) لا عبر نطاق مستأجر.

COMMIT;

-- ═══════════════════════════════════════════════════════════
--  الاستخدام من التطبيق
-- ═══════════════════════════════════════════════════════════
--
--  في بداية كل معاملة، ويجب أن تكون LOCAL كي لا تتسرّب القيمة
--  إلى الاتصال التالي في مجمّع الاتصالات:
--
--    BEGIN;
--      SELECT set_config('app.store_id', $1, true);   -- true = LOCAL
--      SELECT * FROM products WHERE live = true;      -- مفلتر تلقائياً
--    COMMIT;
--
--  ⚠ خطر شائع: استخدام set_config(..., false) مع pgBouncer أو أي
--  مجمّع اتصالات يعني أن الطلب التالي قد يرث store_id السابق —
--  وهو بالضبط التسريب الذي جاءت RLS لمنعه.
--
-- ═══════════════════════════════════════════════════════════
--  فحص القبول قبل اعتماد الانتقال
-- ═══════════════════════════════════════════════════════════
--
--    SET ROLE rvios_app;
--    SELECT set_config('app.store_id', '<متجر-أ>', false);
--    SELECT count(*) FROM products;         -- منتجات متجر أ فقط
--    SELECT set_config('app.store_id', '<متجر-ب>', false);
--    SELECT count(*) FROM products;         -- منتجات متجر ب فقط
--    INSERT INTO products (store_id, name) VALUES ('<متجر-أ>', 'x');
--    -- يجب أن يفشل: new row violates row-level security policy
