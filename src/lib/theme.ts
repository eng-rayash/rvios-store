/**
 * محرّك الهوية اللونية — غلاف مُعرَّف الأنواع.
 *
 * الملف `theme-core.js` المجاور **نسخة طبق الأصل** من
 * `public/assets/js/theme-core.js`، ولم يُعد كتابته عمداً:
 * معادلات OKLab يستخدمها اليوم ثلاثة أطراف (خادم التصيير
 * القديم، وواجهة المتجر، ولوحة التاجر)، وأي إعادة كتابة تعني
 * نسختين تتباعدان بصمت — فيبدو متجر التاجر بلونين مختلفين
 * حسب الصفحة التي فتحها.
 *
 * والنسخ هنا اضطرار لا اختيار: Turbopack لا يستورد من خارج
 * جذر التطبيق. ولذلك يحرس `npm run check:theme` تطابق
 * الملفّين ويُفشل البناء عند أي انحراف.
 *
 * وحين يُطفأ الخادم القديم تبقى هذه النسخة وحدها وتتحوّل إلى
 * TypeScript دفعة واحدة.
 */
// وحدة JavaScript بلا أنواع؛ أنواعها معلنة أدناه
// @ts-ignore
import * as engine from './theme-core.js';

export interface Lch { L: number; C: number; h: number }

/** أسماء متغيّرات CSS التي تولّدها اللوحة وقيمها */
export type Palette = Record<string, string>;

export interface StoreTheme {
  color?: string | null;
  colorDeep?: string | null;
  color_deep?: string | null;
  plan?: string | null;
  theme?: string | null;
  layout?: string | null;
}

export interface Skin { id: string; name: string; dark: boolean }
/** قالب الواجهة — بنية الصفحة لا لونها */
export interface Layout { id: string; name: string; desc: string }

export const hexToLch: (hex: string) => Lch = engine.hexToLch;
export const lch: (L: number, C: number, h: number) => string = engine.lch;
export const contrast: (a: string, b: string) => number = engine.contrast;
export const onColor: (hex: string, dark: string) => string = engine.onColor;
export const readable: (hex: string, bg: string, target?: number) => string = engine.readable;

/** يشتق لوحة CSS كاملة من لون واحد */
export const derivePalette: (
  color: string,
  opts?: { deep?: string; dark?: boolean },
) => Palette = engine.derivePalette;

/** اللوحة الخاصة بمتجر، مع احترام سكِنه ودرجته */
export const paletteFor: (store: StoreTheme) => Palette = engine.paletteFor;

/** درجة التصميم المستحقّة بالباقة: clean · warm · signature */
export const tierOf: (plan: string) => string = engine.tierOf;
export const skinOf: (theme: string) => Skin = engine.skinOf;
export const SKINS: Record<string, Skin> = engine.SKINS;

/** القالب المستحقّ — لا يؤثّر في اللوحة إطلاقاً، بنيةٌ فقط */
export const layoutOf: (layout: string) => Layout = engine.layoutOf;
export const LAYOUTS: Record<string, Layout> = engine.LAYOUTS;

/**
 * يحوّل اللوحة إلى كائن أنماط جاهز للحقن على عنصر React.
 *
 * نحقنها كـ`style` على العنصر لا في وسم <style> عام: صفحة
 * تعرض عدة متاجر (شريط «متاجر على المنصة») تحتاج لوحةً لكل
 * بطاقة، ولوحة عامة واحدة تجعلها كلها بلون واحد.
 */
/**
 * لون المتجر وحده، بلا أسطحه.
 *
 * `paletteFor` تُعيد لوحةً كاملة تُعيد تعريف `--cream` و`--line`
 * و`--ink` و`--soft` — وهذا هو المطلوب داخل متجر التاجر، حيث
 * يصبغ لونُه الموقع كله. أمّا في صفحات المنصة، حيث تجاور عشرةَ
 * متاجر على سطح أبيض واحد (شريط «متاجر تعمل على المنصة»)، فحقن
 * الأسطح يكسر السطح: بطاقة متجرٍ داكن السكِن ترث `--soft` فاتحاً
 * فيُكتب رابطها بلونٍ نسبة تباينه ٢٫١ فوق الأبيض — أي لا يُقرأ.
 *
 * فتُقتطع اللوحة إلى ما يخصّ اللون وحده، ويُعاد حساب `--shop-text`
 * فوق السطح الفعلي لا فوق ورق المتجر. والأسطح تبقى للمنصة.
 */
export function accentOn(store: StoreTheme, surface = '#FFFFFF'): Palette {
  const p = paletteFor(store);
  return {
    '--shop': p['--shop'],
    '--shop-deep': p['--shop-deep'],
    '--shop-lift': p['--shop-lift'],
    '--shop-rgb': p['--shop-rgb'],
    '--on-shop': p['--on-shop'],
    '--on-shop-deep': p['--on-shop-deep'],
    '--shop-text': readable(p['--shop'], surface),
  };
}

export function paletteStyle(palette: Palette): React.CSSProperties {
  return palette as unknown as React.CSSProperties;
}
