// تدقيق جاهزية الرفع — يفحص الكود لا الذاكرة
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const has = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };
// المخطّط غادر server/db.js إلى ملف SQL عند الهجرة إلى Postgres —
// وهذا التدقيق يقرأ الكود لا الذاكرة، فليقرأ حيث صار.
const schema = read('ops/sql/schema.pg.sql');
const srcAll = ['server', 'server/routes'].flatMap((d) =>
  fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.js')).map((f) => read(`${d}/${f}`))).join('\n');

const row = (label, ok, note = '') =>
  console.log(`  ${ok ? '✔' : '✖'} ${label.padEnd(42)} ${note}`);

console.log('\n═══ البنية التحتية ═══');
row('طبقة إعدادات مُتحقَّقة', has('server/config.js'));
row('  ← مربوطة بالخادم', srcAll.includes('assertConfig(') && read('server/server.js').includes('assertConfig'), 'مكتوبة وغير مستدعاة');
row('تسجيل منظّم', has('server/logger.js'));
row('  ← مربوط بالخادم', read('server/server.js').includes('logger.js'), 'مكتوب وغير مستخدم');
row('مخطّط في ملف واحد', has('ops/sql/schema.pg.sql'), 'DDL مبعثر في الكود');
row('طابور مهام بإعادة محاولة', has('server/jobs.js'), 'الإشعار fire-and-forget');
// نفحص أن النقطة تستعلم القاعدة فعلاً: خادم يردّ «حيّ» بينما
// قاعدته مقفلة أسوأ من خادم متوقّف — الوكيل يظل يرسل إليه.
row('نقطة صحة /health', read('server/server.js').includes("pathname === '/health'"));
row('  ← تستعلم القاعدة', /function health[\s\S]{0,400}db\.prepare/.test(read('server/server.js')), 'ترد نصاً ثابتاً');
row('إيقاف رشيد', read('server/server.js').includes('SIGTERM') && read('server/server.js').includes('server.close('));
row('نسخ احتياطي تلقائي', has('server/backup.js'));
row('  ← مربوط بالخادم', read('server/server.js').includes('startBackups'), 'مكتوب وغير مستدعى');
row('  ← لقطة منطقية (pg_dump)', read('server/backup.js').includes('pg_dump'), 'نسخة تُستعاد على أي خادم Postgres');
row('  ← تحقّق من سلامة النسخة', read('server/backup.js').includes('dump complete'), 'نسخة لم تُفحص ليست نسخة');
row('  ← استعادة مُختبَرة', has('ops/restore.mjs'));
row('ضغط brotli/gzip', read('server/server.js').includes('brotliCompress') || read('server/server.js').includes('createBrotliCompress'));
row('  ← ترويسة Vary', read('server/server.js').includes("vary: 'Accept-Encoding'"), 'الوسيط قد يخدم نسخة خاطئة');
row('Dockerfile', has('ops/Dockerfile') || has('Dockerfile'));
row('إعداد وكيل عكسي', has('ops/Caddyfile') || has('ops/nginx.conf'));
row('وحدة خدمة systemd', has('ops/rvios.service'));
row('CI', has('.github/workflows'));
row('DDL لـPostgres RLS', has('ops/postgres-rls.sql'));

console.log('\n═══ الأمان ═══');
row('تجزئة رمز التحقق', read('server/auth.js').includes('createHmac'));
row('مقارنة ثابتة الزمن', read('server/auth.js').includes('timingSafeEqual'));
row('منع تعداد الأرقام', !read('server/routes/auth.js').includes('returning:'));
row('مهلة إعادة الإرسال', read('server/auth.js').includes('assertResendAllowed'));
row('ترويسات أمان', read('server/http.js').includes('SECURITY_HEADERS'));
row('كوكي Secure في الإنتاج', read('server/http.js').includes("bits.push('Secure')"));
row('منع كلمة مرور افتراضية بالإنتاج', read('server/server.js').includes('assertConfig'), 'الفحص مكتوب وغير مفعَّل');
row('الأسرار خارج الكود', has('.env.example') && read('.gitignore').includes('.env'));
row('لا مفتاح مكتوب في المصدر', !/EAA[A-Za-z0-9]{20}/.test(srcAll));
row('حسابات إدارة متعددة', srcAll.includes('admin_users'), 'كلمة مرور واحدة مشتركة');
row('سجل تدقيق', has('server/billing.js') && read('server/billing.js').includes('audit_log'));

console.log('\n═══ المنتج ═══');
row('SSR + Open Graph', has('server/render.js'));
row('sitemap + robots', read('server/server.js').includes('sitemap.xml'));
row('حجز المخزون وقت الطلب', read('server/orders.js').includes('forUpdate: true'));
row('رسوم التوصيل', read('server/orders.js').includes('deliveryFor'));
row('صور متعددة للمنتج', read('server/uploads.js').includes('syncGallery'));
row('تتبّع الطلب للعميل', has('public/track.html'));
row('سجل الروابط القديمة + 301', read('server/server.js').includes('store_slug_history'));
row('نظام الفوترة', has('server/billing.js'));
row('إخفاء لا حذف عند الانتهاء', read('server/routes/public.js').includes('§٥.٥'));
row('حذف الحساب', read('server/routes/merchant.js').includes("'/api/me/account'"));
row('زوّار فريدون', read('server/routes/public.js').includes('visit_marks'));
row('إشعار التاجر بالطلب', read('server/notify.js').includes('notifyNewOrder'));

console.log('\n═══ ما لم يُبنَ ═══');
row('توثيق KYC برفع وثائق', srcAll.includes('verification_requests'));
row('تسلسل قنوات إرسال بديلة', read('server/notify.js').includes('OTP_CHAIN'));
// القياس الحقيقي يأتي من Meta عبر Webhook: نجاح نداء الإرسال
// يعني أن Meta قبِلت الطلب، لا أن التاجر رأى الرمز.
row('قياس نجاح كل قناة', read('server/db.js').includes('wa_messages')
  && read('server/routes/webhook.js').includes('handleStatuses'));
row('  ← توقيع Webhook مُتحقَّق', read('server/routes/webhook.js').includes('timingSafeEqual'));
row('تذكيرات الاشتراك D-7 / D-1', read('server/billing.js').includes('runReminderSweep')
  && read('server/server.js').includes('runReminderSweep'));
// المرحلة لا الوقت وحده: بدونها يصل التذكير نفسه كل ٦ ساعات
row('  ← لا تكرار (notified_stage)', schema.includes('notified_stage'));
row('ترقيم الطلبات في اللوحة', read('server/routes/merchant.js').includes('ORDERS_PER_PAGE'));
row('تجميد ٢٤ ساعة عند تغيير الرقم', srcAll.includes('phone_change'));
row('PWA (manifest + service worker)', has('public/manifest.json'));
row('متجر إضافي لباقة برو', !read('server/routes/auth.js').includes('لديك متجر بالفعل'));
row('تحويل WebP على الخادم', srcAll.includes('webp') && srcAll.includes('sharp'));
// نفحص الاستدعاء الفعلي للمسار لا وجود كلمة في HTML:
// الترميز قد يوجد بلا منطق يشغّله، وهذا بالضبط ما كان ينقص.
row('واجهة الفوترة للتاجر',
  read('src/components/dash/plan-screen.tsx').includes('/api/me/billing/invoices'));
row('واجهة مراجعة المدفوعات',
  read('public/assets/js/admin.js').includes('/api/admin/invoices'));
row('شاشة ضبط الأسعار',
  read('public/assets/js/admin.js').includes('/api/admin/settings'));

console.log('\n═══ أرقام ═══');
const tables = (schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/g) ?? []).length;
const routes = (srcAll.match(/^\s*r\.(get|post|patch|put|delete)\(/gm) ?? []).length;
console.log(`  جداول: ${tables} · مسارات API: ${routes}`);
