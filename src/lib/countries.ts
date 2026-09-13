/**
 * جدول الدول والعملات — غلاف مُعرَّف الأنواع.
 *
 * الملف `countries.js` المجاور **نسخة طبق الأصل** من
 * `public/assets/js/countries.js`، ولم يُعد كتابته عمداً: نمط
 * تحقّق الجوال وتوحيده إلى E.164 يستخدمه اليوم ثلاثة أطراف
 * (خادم التصيير القديم، وواجهة المتجر، ولوحة التاجر)، وأي
 * إعادة كتابة تعني نسختين تتباعدان بصمت — فيُقبل رقم في صفحة
 * ويُرفض في أخرى بلا سبب مفهوم للتاجر.
 *
 * والنسخ هنا اضطرار لا اختيار: Turbopack لا يستورد من خارج جذر
 * التطبيق. ولذلك يحرس `npm run check:theme` تطابق الملفّين
 * ويُفشل البناء عند أي انحراف.
 */
// وحدة JavaScript بلا أنواع؛ أنواعها معلنة أدناه
// @ts-ignore
import * as table from './countries.js';

export interface Country {
  /** رمز ISO المكوّن من حرفين */
  code: string;
  name: string;
  /** رمز الاتصال بلا `+` */
  dial: string;
  /** نمط رقم الجوال المحلي، بلا رمز الدولة */
  mobile: RegExp;
  currency: string;
  /** ما يُعرض للعميل */
  symbol: string;
}

export const COUNTRIES: Record<string, Country> = table.COUNTRIES;
export const DEFAULT_COUNTRY: string = table.DEFAULT_COUNTRY;

export const countryOf: (code?: string | null) => Country = table.countryOf;
export const symbolOf: (code?: string | null) => string = table.symbolOf;

/** يوحّد أي صيغة يكتبها المستخدم إلى E.164 بلا `+`، أو '' إن تعذّر */
export const toE164: (input: string, fallback?: string) => string = table.toE164;
export const validE164: (e164: string) => boolean = table.validE164;
export const countryOfPhone: (e164: string) => Country | null = table.countryOfPhone;

/** الصيغة المحلية للعرض — التاجر يعرف رقمه بها لا بالدولية */
export const localOf: (e164: string) => string = table.localOf;
