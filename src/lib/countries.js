// ═══════════════════════════════════════════════════════════
//  الدول والعملات
//
//  كان النظام يفترض اليمن في ثلاثة مواضع متفرّقة: نمط التحقق
//  من الجوال، ورمز الدولة المكتوب `967` بالقيمة، ورمز العملة
//  `ر.ي` في الواجهة. وكل موضع منها قفلٌ لا يظهر إلا حين يحاول
//  تاجر من خارج اليمن التسجيل — فيُرفض بلا سبب مفهوم.
//
//  هذا الملف هو المصدر الوحيد لتلك المعرفة. وإضافة دولة صارت
//  سطراً واحداً هنا، لا مطاردة عبر الملفات.
//
//  ★ القائمة **متعمَّدة الاختصار**: هذه أسواق تشبه اليمن في
//  شكل التجارة — الدفع عند الاستلام، والبيع عبر واتساب،
//  ومنصات محلية ضعيفة. أسواق الخليج تتوقّع بوابات بطاقات
//  وضريبة وسجلاً تجارياً، وهي منتج مختلف لا صفّ إضافي هنا.
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {object} Country
 * @property {string} code   رمز ISO المكوّن من حرفين
 * @property {string} name   الاسم بالعربية
 * @property {string} dial   رمز الاتصال بلا `+`
 * @property {RegExp} mobile نمط رقم الجوال **المحلي** (بلا رمز الدولة)
 * @property {string} currency  رمز العملة ISO
 * @property {string} symbol    ما يُعرض للعميل
 */

export const COUNTRIES = {
  YE: { code: 'YE', name: 'اليمن',    dial: '967', mobile: /^7[0137]\d{7}$/,  currency: 'YER', symbol: 'ر.ي' },
  SA: { code: 'SA', name: 'السعودية', dial: '966', mobile: /^5\d{8}$/,        currency: 'SAR', symbol: 'ر.س' },
  EG: { code: 'EG', name: 'مصر',      dial: '20',  mobile: /^1[0125]\d{8}$/,  currency: 'EGP', symbol: 'ج.م' },
  JO: { code: 'JO', name: 'الأردن',   dial: '962', mobile: /^7[789]\d{7}$/,   currency: 'JOD', symbol: 'د.أ' },
  IQ: { code: 'IQ', name: 'العراق',   dial: '964', mobile: /^7[3-9]\d{8}$/,   currency: 'IQD', symbol: 'د.ع' },
  SD: { code: 'SD', name: 'السودان',  dial: '249', mobile: /^9[0-9]\d{7}$/,   currency: 'SDG', symbol: 'ج.س' },
  SY: { code: 'SY', name: 'سوريا',    dial: '963', mobile: /^9[3-9]\d{7}$/,   currency: 'SYP', symbol: 'ل.س' },
  LY: { code: 'LY', name: 'ليبيا',    dial: '218', mobile: /^9[1-6]\d{7}$/,   currency: 'LYD', symbol: 'د.ل' },
  OM: { code: 'OM', name: 'عُمان',    dial: '968', mobile: /^[79]\d{7}$/,     currency: 'OMR', symbol: 'ر.ع' },
};

export const DEFAULT_COUNTRY = 'YE';

/** أطول رموز الاتصال أولاً — وإلا التقط `20` ما يبدأ بـ`218` */
const BY_DIAL = Object.values(COUNTRIES).sort((a, b) => b.dial.length - a.dial.length);

export const countryOf = (code) => COUNTRIES[String(code || '').toUpperCase()] ?? COUNTRIES[DEFAULT_COUNTRY];

/** رمز العملة كما يراه العميل */
export const symbolOf = (code) => countryOf(code).symbol;

/**
 * يحوّل أي صيغة يكتبها المستخدم إلى **E.164 بلا علامة زائد**.
 *
 * الصيغ المقبولة كلها تؤدّي إلى النتيجة نفسها:
 *   ٧٧٧١٢٣٤٥٦ · 777123456 · 0777123456 · +967777123456 · 00967777123456
 *
 * @param {string} input   ما كتبه المستخدم
 * @param {string} [fallback]  الدولة المفترضة حين لا يكتب رمزاً
 * @returns {string} رقم E.164 بلا `+`، أو '' إن تعذّر
 */
export function toE164(input, fallback = DEFAULT_COUNTRY) {
  // الأرقام العربية-الهندية تُحوَّل أولاً: التاجر يكتب بلوحته
  const latin = String(input ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let p = latin.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);

  // كتب رمز الدولة صراحةً؟ نتحقّق أن الباقي رقم جوال صالح فيها.
  // الشرط ضروري: رقم أردني محلي `770123456` يبدأ بـ`77` ولا
  // علاقة له برمز اتصال، فلا يجوز التقاطه كأنه دولي.
  for (const c of BY_DIAL) {
    if (p.startsWith(c.dial)) {
      const rest = p.slice(c.dial.length);
      if (c.mobile.test(rest)) return c.dial + rest;
    }
  }

  // محلي: نُسقط الصفر البادئ ونركّب رمز الدولة الافتراضية
  const local = p.replace(/^0+/, '');
  const home = countryOf(fallback);
  return home.mobile.test(local) ? home.dial + local : '';
}

/** هل هذا رقم E.164 صالح في إحدى الدول المدعومة؟ */
export function validE164(e164) {
  const p = String(e164 ?? '');
  return BY_DIAL.some((c) => p.startsWith(c.dial) && c.mobile.test(p.slice(c.dial.length)));
}

/** الدولة التي ينتمي إليها رقم E.164 */
export function countryOfPhone(e164) {
  const p = String(e164 ?? '');
  return BY_DIAL.find((c) => p.startsWith(c.dial) && c.mobile.test(p.slice(c.dial.length))) ?? null;
}

/** الصيغة المحلية للعرض — التاجر يعرف رقمه بها لا بالدولية */
export function localOf(e164) {
  const c = countryOfPhone(e164);
  return c ? String(e164).slice(c.dial.length) : String(e164 ?? '');
}
