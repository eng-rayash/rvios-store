import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * الأرقام عربية-هندية في كل الواجهة (§٧.١).
 * الاستثناء الوحيد رسالة واتساب: التاجر ينسخها ويحسب عليها،
 * واللاتينية أسلم في النسخ واللصق عبر التطبيقات.
 */
export const ar = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('ar-EG');

/** الحرف الأول من اسم المتجر، بلا بادئة «متجر» أو «محل» */
export const initial = (name: string) =>
  name.replace(/^(متجر|محل)\s+/, '').charAt(0) || 'م';

/**
 * تمييز العدد في العربية.
 *
 * «٤ منتج» و«٢ منتج» خطأ يقرؤه كل زائر عربي، و«منتج(ات)»
 * اعترافٌ بأن الواجهة لم تُكتب بلغته. القاعدة أربع حالات:
 * مفرد، ومثنّى، وجمع قلّة (٣–١٠)، وتمييز مفرد منصوب (١١+).
 * والصفر يأخذ جمع القلّة: «٠ منتجات» لا «٠ منتجاً».
 */
export function plural(n: number, [one, two, few, many]: [string, string, string, string]) {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (abs === 0) return few;
  if (abs === 1) return one;
  if (abs === 2) return two;
  if (mod100 >= 3 && mod100 <= 10) return few;
  return many;
}

/** «٥ منتجات» — العدد بأرقام عربية والتمييز مضبوط */
export const items = (n: number) =>
  `${ar(n)} ${plural(n, ['منتج', 'منتجان', 'منتجات', 'منتجاً'])}`;
