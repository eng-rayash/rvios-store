/**
 * الباقات وحدودها.
 *
 * منقولة عن `src/plans.js` — والقرار المبدئي فيها لم يتغيّر:
 * **الباقات تُفصل بالوظيفة لا بالكمية.** لو كانت «برو» مجرد
 * «بلس بعدد أكبر» لما رقّى إليها أحد. ولذلك كل ميزة في برو
 * تخدم الاستقلال بالعلامة: الدومين، إخفاء أثر المنصة،
 * الموظفون، الثيمات، تصدير البيانات.
 *
 * والباقة تشتري **درجة تصميم** لا رقماً أكبر — وهي الحجّة التي
 * يجب أن تُرى في الصفحة لا أن تُقرأ.
 */
import { ar } from '@/lib/utils';

export type PlanId = 'basic' | 'plus' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  nameEn: string;
  desc: string;
  priceUsd: number;
  products: number | null;      // null = بلا حدّ
  imagesPerProduct: number;
  variantsPerProduct: number | null;
  staffSeats: number;
  customDomain: boolean;
  extraThemes: boolean;
  bulkImport: boolean;
  dataExport: boolean;
  canVerify: boolean;
  design: { id: string; name: string; desc: string };
  features: string[];
  /** ما لا تشمله الباقة — الصمت عنه يجعل الترقية تبدو بلا سبب */
  missing?: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'مجانية',
    nameEn: 'Free',
    desc: 'لتجربة فكرتك أولاً',
    priceUsd: 0,
    products: 15,
    imagesPerProduct: 1,
    variantsPerProduct: 5,
    staffSeats: 0,
    customDomain: false,
    extraThemes: false,
    bulkImport: false,
    dataExport: false,
    canVerify: false,
    design: { id: 'clean', name: 'نقي', desc: 'واجهة صافية سريعة، لونك على كامل الصفحة' },
    features: [
      'حتى ١٥ منتجاً',
      'رابط متجر خاص بك',
      'تصميم «نقي» بلونك',
      'طلبات عبر واتساب',
      'خيارات المنتج (٥ لكل منتج)',
      'صورة واحدة لكل منتج',
    ],
    missing: ['إحصائيات المتجر', 'شارة التوثيق', 'دومين خاص'],
  },
  plus: {
    id: 'plus',
    name: 'بلس',
    nameEn: 'Plus',
    desc: 'للمتاجر الصغيرة والمتوسطة',
    priceUsd: 5,
    products: 100,
    imagesPerProduct: 4,
    variantsPerProduct: 30,
    staffSeats: 0,
    customDomain: false,
    extraThemes: false,
    bulkImport: false,
    dataExport: false,
    canVerify: true,
    design: { id: 'warm', name: 'دافئ', desc: 'هيرو متدرّج، شريط ثقة وتصنيفات، بطاقات ترتفع، قصة المتجر' },
    features: [
      'حتى ١٠٠ منتج',
      'تصميم «دافئ» + قسم قصة المتجر',
      'تصنيفات فرعية',
      'إحصائيات المتجر',
      'شارة توثيق',
      'خيارات المنتج (٣٠ لكل منتج)',
      '٤ صور لكل منتج',
    ],
    missing: ['دومين خاص', 'حسابات موظفين'],
  },
  pro: {
    id: 'pro',
    name: 'برو',
    nameEn: 'Pro',
    desc: 'لمن يبني علامة تجارية مستقلة',
    priceUsd: 15,
    products: null,
    imagesPerProduct: 10,
    variantsPerProduct: null,
    staffSeats: 3,
    customDomain: true,
    extraThemes: true,
    bulkImport: true,
    dataExport: true,
    canVerify: true,
    design: { id: 'signature', name: 'فاخر', desc: 'وهج محيط، هيدر زجاجي، عنوان متدرّج، بطاقات بضوء يتبع المؤشر' },
    features: [
      'منتجات غير محدودة',
      'تصميم «فاخر» + قالبان و٣ سكِنات',
      'دومين خاص بك',
      'حسابات موظفين (٣)',
      'خيارات المنتج بلا حدّ',
      '١٠ صور لكل منتج',
      'إحصائيات مفصّلة',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['basic', 'plus', 'pro'];

/**
 * صفوف جدول المقارنة.
 *
 * ★ هنا لا في الصفحات — وكانتا نسختين متطابقتين حرفاً بحرف في
 * `sections.tsx` و`pricing/page.tsx`. والتكرار لم يبقَ متطابقاً:
 * نسخة صفحة الباقات فقدت `<caption>` و`scope` ونصّ «مشمول/غير
 * مشمول» لقارئ الشاشة، وفقدت معها سطر `relative` الذي يمنع
 * تجاوزاً أفقياً يهزّ الصفحة كلها على الجوّال — وهو سطرٌ يحمل
 * في النسخة الأخرى تعليقاً من عشرة أسطر يشرح ضرورته. هكذا
 * يتحلّل التكرار: لا دفعةً واحدة بل بندٍ يسقط في كل نقل.
 *
 * الترتيب مقصود: عدد المنتجات أولاً لأنه ما يهمّ التاجر، ثم
 * **درجة التصميم** لأنها أول فرق يراه عميله، ثم البقية.
 * و`false` تُعرض شرطةً لا فراغاً: الفراغ يُقرأ سهواً، والشرطة
 * تقول «غير مشمول» صراحةً.
 */
export const COMPARISON_ROWS: [string, (p: Plan) => string | boolean][] = [
  ['عدد المنتجات', (p) => (p.products === null ? 'غير محدود' : ar(p.products))],
  ['درجة تصميم المتجر', (p) => p.design.name],
  ['رابط متجر خاص', () => true],
  ['طلبات عبر واتساب', () => true],
  ['تقييمات المنتجات والردّ عليها', () => true],
  ['لونك على الموقع كله', () => true],
  ['خيارات المنتج (مقاسات وألوان)', (p) => (p.variantsPerProduct === null ? 'بلا حدّ' : ar(p.variantsPerProduct))],
  ['صور لكل منتج', (p) => ar(p.imagesPerProduct)],
  ['شريط ثقة وشريط تصنيفات', (p) => p.design.id !== 'clean'],
  ['قسم «قصة المتجر»', (p) => p.design.id !== 'clean'],
  ['وهج محيط وتأثيرات متقدمة', (p) => p.design.id === 'signature'],
  ['قوالب الواجهة', (p) => (p.extraThemes ? 'قالبان' : 'قالب واحد')],
  ['سكِنات إضافية', (p) => (p.extraThemes ? '٣ سكِنات' : false)],
  ['إحصائيات المتجر', (p) => p.id !== 'basic'],
  ['شارة التوثيق', (p) => p.canVerify],
  ['دومين مخصص', (p) => p.customDomain],
  ['حسابات موظفين', (p) => (p.staffSeats ? ar(p.staffSeats) : false)],
  ['رفع دفعة وتصدير البيانات', (p) => p.bulkImport],
  ['الدعم والأمان والنسخ الاحتياطي', () => true],
];

/**
 * الخدمات الإضافية — خارج الاشتراك.
 *
 * ★ نسخة الواجهة التسويقية. و`server/plans.js` يحمل نسخته لأن
 * اللوحة تقرؤها من الـAPI وقت التشغيل — ولا يحرسها فحص آلي،
 * فتغيير نصٍّ هنا يجب أن يُنقل هناك يدوياً.
 */
export const ADDONS = [
  {
    id: 'build',
    name: 'نُنشئ متجرك بدلاً عنك',
    kind: 'رسوم مقطوعة',
    desc: 'يتولى فريقنا رفع منتجاتك وضبط هويتك البصرية كاملة، وتستلم متجراً جاهزاً للمشاركة.',
  },
  {
    id: 'domain',
    name: 'دومين مخصص',
    kind: 'رسوم سنوية',
    desc: 'اربط نطاقك الخاص بمتجرك بدل الرابط الفرعي — متاح مع برو أو كإضافة منفصلة.',
  },
  {
    id: 'store',
    name: 'متجر إضافي',
    kind: 'رسوم شهرية',
    desc: 'لمن لديه أكثر من نشاط تجاري ويريد فصلها تحت الحساب نفسه.',
  },
];

/**
 * ما لا يوضع في أي باقة أبداً — قرار مبدئي لا تقني:
 * دعم أسرع (الدعم الجيد حق للجميع) · أمان أو نسخ احتياطي أفضل
 * (السلامة لا تُباع كترقية) · سرعة أعلى (الإبطاء المتعمد غش).
 */
export const NEVER_GATED = ['support', 'security', 'backups', 'speed'] as const;
