// تدقيق جاهزية الرفع — يفحص الكود لا الذاكرة
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const has = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };
const srcAll = ['src', 'src/routes'].flatMap((d) =>
  fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.js')).map((f) => read(`${d}/${f}`))).join('\n');

const row = (label, ok, note = '') =>
  console.log(`  ${ok ? '✔' : '✖'} ${label.padEnd(42)} ${note}`);

console.log('\n═══ البنية التحتية ═══');
row('طبقة إعدادات مُتحقَّقة', has('src/config.js'));
row('  ← مربوطة بالخادم', srcAll.includes('assertConfig(') && read('src/server.js').includes('assertConfig'), 'مكتوبة وغير مستدعاة');
row('تسجيل منظّم', has('src/logger.js'));
row('  ← مربوط بالخادم', read('src/server.js').includes('logger.js'), 'مكتوب وغير مستخدم');
row('ترحيلات مرقّمة', has('src/migrations'), 'DDL في db.js مباشرة');
row('طابور مهام بإعادة محاولة', has('src/jobs.js'), 'الإشعار fire-and-forget');
// نفحص أن النقطة تستعلم القاعدة فعلاً: خادم يردّ «حيّ» بينما
// قاعدته مقفلة أسوأ من خادم متوقّف — الوكيل يظل يرسل إليه.
row('نقطة صحة /health', read('src/server.js').includes("pathname === '/health'"));
row('  ← تستعلم القاعدة', /function health[\s\S]{0,400}db\.prepare/.test(read('src/server.js')), 'ترد نصاً ثابتاً');
row('إيقاف رشيد', read('src/server.js').includes('SIGTERM') && read('src/server.js').includes('server.close('));
row('نسخ احتياطي تلقائي', has('src/backup.js'));
row('  ← مربوط بالخادم', read('src/server.js').includes('startBackups'), 'مكتوب وغير مستدعى');
row('  ← لقطة متّسقة (VACUUM INTO)', read('src/backup.js').includes('VACUUM INTO'), 'نسخ ملف قد يُنتج قاعدة ممزّقة');
row('  ← تحقّق من سلامة النسخة', read('src/backup.js').includes('integrity_check'), 'نسخة لم تُفتح ليست نسخة');
row('  ← استعادة مُختبَرة', has('ops/restore.mjs'));
row('ضغط brotli/gzip', read('src/server.js').includes('brotliCompress') || read('src/server.js').includes('createBrotliCompress'));
row('  ← ترويسة Vary', read('src/server.js').includes("vary: 'Accept-Encoding'"), 'الوسيط قد يخدم نسخة خاطئة');
row('Dockerfile', has('ops/Dockerfile') || has('Dockerfile'));
row('إعداد وكيل عكسي', has('ops/Caddyfile') || has('ops/nginx.conf'));
row('وحدة خدمة systemd', has('ops/rvios.service'));
row('CI', has('.github/workflows'));
row('DDL لـPostgres RLS', has('ops/postgres-rls.sql'));

console.log('\n═══ الأمان ═══');
row('تجزئة رمز التحقق', read('src/auth.js').includes('createHmac'));
row('مقارنة ثابتة الزمن', read('src/auth.js').includes('timingSafeEqual'));
row('منع تعداد الأرقام', !read('src/routes/auth.js').includes('returning:'));
row('مهلة إعادة الإرسال', read('src/auth.js').includes('assertResendAllowed'));
row('ترويسات أمان', read('src/http.js').includes('SECURITY_HEADERS'));
row('كوكي Secure في الإنتاج', read('src/http.js').includes("bits.push('Secure')"));
row('منع كلمة مرور افتراضية بالإنتاج', read('src/server.js').includes('assertConfig'), 'الفحص مكتوب وغير مفعَّل');
row('الأسرار خارج الكود', has('.env.example') && read('.gitignore').includes('.env'));
row('لا مفتاح مكتوب في المصدر', !/EAA[A-Za-z0-9]{20}/.test(srcAll));
row('حسابات إدارة متعددة', srcAll.includes('admin_users'), 'كلمة مرور واحدة مشتركة');
row('سجل تدقيق', has('src/billing.js') && read('src/billing.js').includes('audit_log'));

console.log('\n═══ المنتج ═══');
row('SSR + Open Graph', has('src/render.js'));
row('sitemap + robots', read('src/server.js').includes('sitemap.xml'));
row('حجز المخزون وقت الطلب', read('src/orders.js').includes('BEGIN IMMEDIATE'));
row('رسوم التوصيل', read('src/orders.js').includes('deliveryFor'));
row('صور متعددة للمنتج', read('src/uploads.js').includes('syncGallery'));
row('تتبّع الطلب للعميل', has('public/track.html'));
row('سجل الروابط القديمة + 301', read('src/server.js').includes('store_slug_history'));
row('نظام الفوترة', has('src/billing.js'));
row('إخفاء لا حذف عند الانتهاء', read('src/routes/public.js').includes('§٥.٥'));
row('حذف الحساب', read('src/routes/merchant.js').includes("'/api/me/account'"));
row('زوّار فريدون', read('src/routes/public.js').includes('visit_marks'));
row('إشعار التاجر بالطلب', read('src/notify.js').includes('notifyNewOrder'));

console.log('\n═══ ما لم يُبنَ ═══');
row('توثيق KYC برفع وثائق', srcAll.includes('verification_requests'));
row('تسلسل قنوات إرسال بديلة', read('src/notify.js').includes('OTP_CHAIN'));
// القياس الحقيقي يأتي من Meta عبر Webhook: نجاح نداء الإرسال
// يعني أن Meta قبِلت الطلب، لا أن التاجر رأى الرمز.
row('قياس نجاح كل قناة', read('src/db.js').includes('wa_messages')
  && read('src/routes/webhook.js').includes('handleStatuses'));
row('  ← توقيع Webhook مُتحقَّق', read('src/routes/webhook.js').includes('timingSafeEqual'));
row('تذكيرات الاشتراك D-7 / D-1', read('src/billing.js').includes('runReminderSweep')
  && read('src/server.js').includes('runReminderSweep'));
// المرحلة لا الوقت وحده: بدونها يصل التذكير نفسه كل ٦ ساعات
row('  ← لا تكرار (notified_stage)', read('src/db.js').includes('notified_stage'));
row('ترقيم الطلبات في اللوحة', read('src/routes/merchant.js').includes('ORDERS_PER_PAGE'));
row('تجميد ٢٤ ساعة عند تغيير الرقم', srcAll.includes('phone_change'));
row('PWA (manifest + service worker)', has('public/manifest.json'));
row('متجر إضافي لباقة برو', !read('src/routes/auth.js').includes('لديك متجر بالفعل'));
row('تحويل WebP على الخادم', srcAll.includes('webp') && srcAll.includes('sharp'));
// نفحص الاستدعاء الفعلي للمسار لا وجود كلمة في HTML:
// الترميز قد يوجد بلا منطق يشغّله، وهذا بالضبط ما كان ينقص.
row('واجهة الفوترة للتاجر',
  read('public/assets/js/dashboard.js').includes('/api/me/billing/invoices'));
row('واجهة مراجعة المدفوعات',
  read('public/assets/js/admin.js').includes('/api/admin/invoices'));
row('شاشة ضبط الأسعار',
  read('public/assets/js/admin.js').includes('/api/admin/settings'));

console.log('\n═══ أرقام ═══');
const tables = (read('src/db.js').match(/CREATE TABLE IF NOT EXISTS (\w+)/g) ?? []).length;
const routes = (srcAll.match(/^\s*r\.(get|post|patch|put|delete)\(/gm) ?? []).length;
console.log(`  جداول: ${tables} · مسارات API: ${routes}`);
