// ═══════════════════════════════════════════════════════════
//  الباقات وحدودها (§٢.١)
//  السعر النقدي معلّق بقرار صريح في §١١ — price = null يعني
//  «لم يُحسم»، والواجهة تعرض «—» بدل رقم مخترع.
//
//  الحد المجاني ١٥ منتجاً: كافٍ ليبني التاجر متجراً حقيقياً
//  يستحق المشاركة، وغير كافٍ لمن يتوسّع فعلاً (§٢.٢).
// ═══════════════════════════════════════════════════════════

/**
 * الباقات تُفصل بالوظيفة لا بالكمية:
 *   مجانية «هل تنفع الفكرة معي؟» · بلس «كيف أدير متجراً ينمو؟»
 *   برو    «كيف أبني علامة تجارية مستقلة؟»
 *
 * لو كانت برو مجرد «بلس بعدد أكبر» لما رقّى إليها أحد.
 * لذلك كل ميزة في برو تخدم الاستقلال بالعلامة: الدومين،
 * إخفاء أثر المنصة، الموظفون، الثيمات، تصدير البيانات.
 *
 * الأسعار بالدولار داخلياً — انظر التعليق في src/billing.js.
 */
export const PLANS = {
  basic: {
    // المعرّف يبقى basic: قيمة مخزَّنة في stores.plan و subscriptions
    // و invoices — تغييرها يستلزم ترحيل بيانات بلا مكسب.
    id: 'basic',
    name: 'مجانية',
    nameEn: 'Free',
    desc: 'لتجربة فكرتك أولاً',
    priceUsd: 0,
    products: 15,
    imagesPerProduct: 1,
    // خيارات المنتج (مقاسات/ألوان) متاحة للجميع — متجر أزياء بلا
    // مقاسات ليس متجر أزياء، ومنعها في المجانية يطرد أكبر قطاع
    // في السوق قبل أن يجرّب. الحدّ كمّي لا وظيفي.
    variantsPerProduct: 5,
    subcategories: false,
    stats: 'none',
    canVerify: false,
    customDomain: false,
    extraThemes: false,
    staffSeats: 0,
    bulkImport: false,
    dataExport: false,
    canBuyExtraStores: false,
    platformBadge: 'full',        // شريط علوي + تذييل
    // §٣.٦ — درجة تصميم الواجهة، لا مجرد لون
    design: { id: 'clean', name: 'نقي', desc: 'واجهة صافية سريعة، لونك على كامل الصفحة' },
    features: ['حتى ١٥ منتجاً', 'رابط متجر خاص', 'تصميم «نقي» بلونك', 'طلبات عبر واتساب'],
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
    subcategories: true,
    stats: 'basic',
    canVerify: true,
    customDomain: false,
    extraThemes: false,
    staffSeats: 0,
    bulkImport: false,
    dataExport: false,
    canBuyExtraStores: false,
    platformBadge: 'full',
    design: { id: 'warm', name: 'دافئ', desc: 'هيرو متدرّج، شريط ثقة وتصنيفات، بطاقات ترتفع، قصة المتجر' },
    features: ['حتى ١٠٠ منتج', 'تصميم «دافئ» + قسم قصة المتجر', 'تصنيفات فرعية', 'إحصائيات المتجر', 'شارة توثيق', 'دعم أولوية'],
  },
  pro: {
    id: 'pro',
    name: 'برو',
    nameEn: 'Pro',
    desc: 'لمن يبني علامة تجارية مستقلة',
    priceUsd: 15,
    products: Infinity,
    imagesPerProduct: 10,
    variantsPerProduct: Infinity,
    subcategories: true,
    stats: 'detailed',
    canVerify: true,
    customDomain: true,
    extraThemes: true,
    staffSeats: 3,
    bulkImport: true,
    dataExport: true,
    // متاجر إضافية بسعر شهري مخفّض — لا تُمنح مجاناً
    canBuyExtraStores: true,
    platformBadge: 'footer',      // سطر صغير في التذييل فقط
    design: { id: 'signature', name: 'فاخر', desc: 'وهج محيط، هيدر زجاجي، عنوان متدرّج، بطاقات بضوء يتبع المؤشر' },
    features: [
      'منتجات غير محدودة',
      'تصميم «فاخر» + قالبان (التوقيع · أتولييه للأزياء) و٣ سكِنات',
      'دومين خاص بك',
      'حسابات موظفين (٣)',
      'رفع دفعة واحدة وتصدير البيانات',
      'إحصائيات مفصّلة',
    ],
  },
};

/**
 * ما لا يوضع في برو أبداً — قرار مبدئي لا تقني:
 * دعم أسرع (الدعم الجيد حق للجميع) · أمان أو نسخ احتياطي أفضل
 * (السلامة لا تُباع كترقية) · سرعة أعلى (الإبطاء المتعمد غش).
 */
export const NEVER_GATED = ['support', 'security', 'backups', 'speed'];

export const PLAN_ORDER = ['basic', 'plus', 'pro'];

export function planOf(store) {
  return PLANS[store?.plan] ?? PLANS.basic;
}

/** هل يسمح حدّ الباقة بإضافة منتج آخر؟ */
export function canAddProduct(store, currentCount) {
  const p = planOf(store);
  return currentCount < p.products;
}

/** نص الحد لعرضه في الواجهة — بالأرقام العربية-الهندية كبقية الواجهة (§٧.١) */
export function capacityLabel(store, currentCount) {
  const p = planOf(store);
  const ar = (n) => n.toLocaleString('ar-EG');
  if (p.products === Infinity) return `${ar(currentCount)} منتج · غير محدود`;
  return `${ar(currentCount)} من ${ar(p.products)}`;
}

/** الخدمات الإضافية (§٢.١ب) — منفصلة تماماً عن الاشتراك */
export const ADDONS = [
  { id: 'build',  name: 'نُنشئ متجرك بدلاً عنك', kind: 'رسوم مقطوعة', desc: 'يتولى الفريق رفع المنتجات وضبط الهوية البصرية كاملة.' },
  { id: 'domain', name: 'دومين مخصص',            kind: 'رسوم سنوية',  desc: 'اربط نطاقك الخاص بمتجرك — متاح مع برو أو كإضافة منفصلة.' },
  { id: 'store',  name: 'متجر إضافي',             kind: 'رسوم شهرية',  desc: 'لمن لديه أكثر من نشاط تجاري تحت الحساب نفسه.' },
];
