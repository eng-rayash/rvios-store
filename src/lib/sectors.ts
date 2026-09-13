/**
 * قطاعات المتاجر — غلاف مُعرَّف الأنواع.
 *
 * الملف `sectors.js` المجاور **نسخة طبق الأصل** من
 * `public/assets/js/sectors.js`، ولم يُعد كتابته عمداً: القائمة
 * يقرأها اليوم أربعة أطراف (مُنتقي الإعداد، وواجهة المتجر،
 * وصفحات التسويق في النظامين)، وأي إعادة كتابة تعني نسختين
 * تتباعدان بصمت — فيختار التاجر نشاطاً في الإعداد ثم لا يجد
 * اسمه فوق واجهة متجره.
 *
 * والنسخ هنا اضطرار لا اختيار: Turbopack لا يستورد من خارج جذر
 * التطبيق. ولذلك يحرس `npm run check:theme` تطابق الملفّين
 * ويُفشل البناء عند أي انحراف.
 */
// وحدة JavaScript بلا أنواع؛ أنواعها معلنة أدناه
// @ts-ignore
import * as table from './sectors.js';

export interface Sector {
  /** ما يُحفظ في `stores.sector` */
  id: string;
  name: string;
  /** اسم الملف في `/assets/img/sectors/` بامتداده، أو `null` فتُعرض الأيقونة */
  img: string | null;
  /** مسار SVG خطّي على شبكة 24×24 */
  icon: string;
  /** سطر البطاقة في صفحة القطاعات */
  blurb: string;
  /** أمثلة تصنيفات — أمثلة لا قوالب */
  tags: string[];
}

/** القطاعات المعروضة، مرتّبةً بالأشيع أوّلاً */
export const SECTORS: Sector[] = table.SECTORS;

/** «أخرى» — في المُنتقي وحده، بلا بطاقة تسويقية */
export const OTHER: Sector = table.OTHER;

/** ما يعرضه المُنتقي: القطاعات ثم «أخرى» في آخرها */
export const PICKABLE: Sector[] = table.PICKABLE;

/** مُعرِّفات هُجرت ولا تزال في قاعدة البيانات — تُقرأ ولا تُقترح */
export const LEGACY: Record<string, string> = table.LEGACY;

export const DEFAULT_SECTOR: string = table.DEFAULT_SECTOR;

/** القطاع بمُعرِّفه بعد ردّ المهجور إلى خلفه، أو `null` */
export const sectorOf: (id?: string | null) => Sector | null = table.sectorOf;

/** الاسم المعروض، أو `''` لمُعرِّف لا نعرفه — فلا يُطبع خاماً */
export const labelOf: (id?: string | null) => string = table.labelOf;

/** هل هذا مُعرِّف نقبل حفظه؟ المهجور مقروء لا مقبول */
export const isSector: (id?: string | null) => boolean = table.isSector;
