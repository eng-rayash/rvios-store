// ═══════════════════════════════════════════════════════════
//  بيانات التاجر والتحقق منها
//
//  تسلسل التحقق عند الإنشاء:
//    ١) رقم الجوال برمز تحقق        ← يُثبت أن الشريحة بيده
//    ٢) بريد جوجل موقَّع من جوجل     ← هوية ثانية لا تُشترى
//    ٣) بياناته الشخصية والنشاط      ← ما تحتكم إليه عند النزاع
//
//  والمتجر يفتح فور اكتمالها — لا ينتظر بشراً. الإدارة تراجع
//  بعد ذلك وتمنح شارة «موثَّق». الحاجز البشري قبل أول بيع
//  يقتل التسجيل، والبيانات المطلوبة سلفاً تكفي لملاحقة
//  المخالف حين يظهر.
// ═══════════════════════════════════════════════════════════
import { db, now } from './db.js';
import { clean, bad } from './http.js';

/** أنواع النشاط — قائمة مغلقة كي تصلح للتصنيف والإحصاء */
export const BUSINESS_TYPES = {
  individual: 'بائع فرد',
  shop:       'محل تجاري',
  company:    'شركة مسجَّلة',
  handmade:   'حرفي / صناعة يدوية',
  home:       'مشروع منزلي',
};

/** حالات تدقيق الإدارة */
export const KYC_STATES = {
  none:     'لم تُقدَّم بيانات',
  pending:  'بانتظار المراجعة',
  approved: 'موثَّق',
  rejected: 'مرفوض',
};

/**
 * الحقول المطلوبة لاكتمال الملف.
 *
 * `national_id` ليس فيها عمداً: كثير من الباعة الأفراد بلا
 * هوية بيدهم لحظة التسجيل، واشتراطها يمنع تاجراً حقيقياً
 * ويُبقي المحتال — الذي يكتب رقماً مخترعاً بلا تردّد. تبقى
 * اختيارية هنا، وتطلبها الإدارة عند منح الشارة.
 */
export const REQUIRED = ['full_name', 'city', 'business_type'];

/** هل اكتملت بيانات هذا التاجر؟ */
export function profileComplete(m) {
  return REQUIRED.every((f) => String(m?.[f] ?? '').trim().length > 0);
}

/** الشكل الذي تراه الواجهة — لا نُخرج رقم الهوية كاملاً بلا داعٍ */
export function publicProfile(m) {
  return {
    id: m.id,
    phone: m.phone,
    name: m.name,
    email: m.email ?? '',
    emailVerified: !!m.email_verified,
    fullName: m.full_name ?? '',
    nationalId: m.national_id ?? '',
    city: m.city ?? '',
    address: m.address ?? '',
    businessType: m.business_type ?? '',
    businessTypeLabel: BUSINESS_TYPES[m.business_type] ?? '',
    complete: profileComplete(m),
    kyc: {
      status: m.kyc_status ?? 'none',
      label: KYC_STATES[m.kyc_status ?? 'none'],
      note: m.kyc_note ?? '',
      at: m.kyc_at ?? null,
    },
    profileAt: m.profile_at ?? null,
  };
}

/**
 * حفظ بيانات التاجر.
 *
 * `partial` يسمح بحفظٍ جزئي أثناء الإعداد؛ والتحقق الكامل
 * يجري عند الإرسال النهائي فقط، وإلا لَمَا استطاع التاجر
 * حفظ خطوة نصفها مكتمل.
 */
export async function saveProfile(merchantId, body, { partial = false } = {}) {
  const patch = {};

  if (body.fullName !== undefined) {
    const v = clean(body.fullName, 80);
    // اسم من كلمة واحدة لا يُعرِّف أحداً في نزاع
    if (!partial && v.split(/\s+/).filter(Boolean).length < 2) {
      bad('اكتب اسمك الثنائي على الأقل');
    }
    patch.full_name = v;
  }

  if (body.city !== undefined) {
    const v = clean(body.city, 40);
    if (!partial && v.length < 2) bad('المدينة مطلوبة');
    patch.city = v;
  }

  if (body.address !== undefined) patch.address = clean(body.address, 160);
  if (body.nationalId !== undefined) {
    // أرقام وحروف لاتينية فقط: الهويات في المنطقة كلها كذلك،
    // والعربية هنا تعني لصقاً خاطئاً لا رقماً
    const v = clean(body.nationalId, 30).replace(/[^0-9A-Za-z-]/g, '');
    patch.national_id = v;
  }

  if (body.businessType !== undefined) {
    const v = clean(body.businessType, 20);
    if (v && !BUSINESS_TYPES[v]) bad('نوع نشاط غير معروف');
    if (!partial && !v) bad('اختر نوع نشاطك');
    patch.business_type = v;
  }

  if (!Object.keys(patch).length) bad('لا يوجد تغيير');

  await db.prepare(
    `UPDATE merchants SET ${Object.keys(patch).map((k) => `${k}=?`).join(',')} WHERE id = ?`,
  ).run(...Object.values(patch), merchantId);

  const m = await db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);

  // اكتمال الملف يفتح باب المراجعة تلقائياً — لا نطلب من
  // التاجر ضغطة زر إضافية ليقول «راجعوني»
  if (profileComplete(m) && (m.kyc_status ?? 'none') === 'none') {
    await db.prepare(`UPDATE merchants SET kyc_status='pending', profile_at=? WHERE id=?`)
      .run(m.profile_at ?? now(), merchantId);
    return await db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
  }
  return m;
}

/**
 * ربط بريد جوجل بحساب التاجر.
 *
 * يرفض بريداً مرتبطاً بتاجر آخر: لو سمحنا به لأمكن لتاجرين
 * أن يتقاسما هوية واحدة، فتضيع المسؤولية عند أول نزاع.
 */
export async function linkGoogle(merchantId, { sub, email, name }) {
  const clash = await db.prepare(
    `SELECT id FROM merchants WHERE (email = ? OR google_sub = ?) AND id <> ?`,
  ).get(email, sub, merchantId);
  if (clash) bad('هذا البريد مرتبط بحساب تاجر آخر', 'EMAIL_TAKEN');

  const m = await db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);

  await db.prepare(
    `UPDATE merchants SET email = ?, google_sub = ?, email_verified = 1,
            full_name = CASE WHEN full_name = '' THEN ? ELSE full_name END
      WHERE id = ?`,
  ).run(email, sub, clean(name, 80), merchantId);

  // اسم الحساب يُملأ من جوجل إن كان فارغاً — التاجر لا يعيد
  // كتابة ما تعرفه جوجل عنه
  if (!m.name && name) {
    await db.prepare('UPDATE merchants SET name = ? WHERE id = ?').run(clean(name, 60), merchantId);
  }
  return await db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
}

/** قرار الإدارة في ملف تاجر */
export async function decideKyc(merchantId, status, note = '') {
  if (!['pending', 'approved', 'rejected'].includes(status)) bad('حالة غير معروفة');
  await db.prepare('UPDATE merchants SET kyc_status = ?, kyc_note = ?, kyc_at = ? WHERE id = ?')
    .run(status, clean(note, 300), now(), merchantId);

  /**
   * الاعتماد يمنح الشارة لكل متاجر التاجر: الشارة تقول «هذا
   * الشخص معروف لنا»، وهي صفة فيه لا في واجهة متجرٍ بعينه.
   * والرفض لا يسحبها — سحبها قرار منفصل من صفحة المتجر، كي
   * لا يمحو خطأٌ في مراجعةٍ واحدة ثقةً بُنيت على مدى شهور.
   */
  if (status === 'approved') {
    await db.prepare('UPDATE stores SET verified = 1 WHERE merchant_id = ?').run(merchantId);
  }
  return await db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
}
