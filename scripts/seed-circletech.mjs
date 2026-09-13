/**
 * بذرة «سيركل تك للإلكترونيات» — متجرٌ حيّ على الباقة برو.
 *
 * يحلّ محلّ «أطلس للإلكترونيات» الذي كان يشغل هذا الدور في
 * البذرة القديمة: متجرُ الإلكترونيات الذي تُعرض عليه الطبقة
 * الفاخرة وسكِن «منتصف الليل». الفارق أن هذا كتالوجٌ بصور
 * حقيقية سلّمها التاجر، لا أسماء على صور عطور مستعارة.
 *
 * ولأنه بديلٌ لا إضافة، يتولّى السكربت إحالةَ «أطلس» إلى
 * التقاعد بنفسه — انظر التعليق عند حذفه أدناه.
 *
 * والتشغيل **مُتَمِّم (idempotent)**: يُحدِّث ما وُجد بالرابط ولا
 * يُنشئ نسخة ثانية، فيمكن إعادته بعد كل تعديل بلا تنظيف يدوي.
 *
 *   node scripts/seed-circletech.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/** يقرأ DATABASE_URL من البيئة أولاً ثم من .env.local */
function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const hit = /^DATABASE_URL=(.+)$/m.exec(fs.readFileSync(p, 'utf8'));
    if (hit) return hit[1].trim();
  }
  throw new Error('DATABASE_URL غير موجود — لا في البيئة ولا في .env.local');
}

const sql = postgres(dbUrl(), { prepare: false, max: 2 });
const now = () => new Date().toISOString();
const img = (f) => `/stores/circletech/${f}`;

/* ── التاجر والمتجر ─────────────────────────────────────── */

/**
 * الرقم هو رقم تاجر «أطلس» نفسه: المتجر بديلٌ عنه لا جارٌ له،
 * فيبقى صاحب الحساب واحداً ويبقى ما في `test/entry.mjs` من
 * دخولٍ بهذا الرقم عاملاً كما كان.
 */
const MERCHANT = { phone: '967712334455', name: 'سيركل تك' };

/**
 * الدولة تُحدِّد ثلاثة أشياء معاً ولا تُفصل عنها: رمز العملة
 * المعروض، ونمط رقم الجوال، ومناطق التوصيل. اليمن هنا لأن
 * الرقم يمنيّ والمدينة صنعاء — وباقي السوق يمثّله «نبراس».
 */
const STORE = {
  slug: 'circletech',
  name: 'سيركل تك للإلكترونيات',
  sector: 'electronics',
  tagline: 'أجهزة أصلية بضمان الوكيل',
  about:
    'سيركل تك وكيلٌ معتمد لأجهزة الحاسب والصوتيات والتصوير. لا '
    + 'نعرض جهازاً لا نصلحه: لكل قطعة هنا ضمان سنة وصيانة داخلية '
    + 'في المعرض، وقطع غيار أصلية. نفتح الصندوق أمامك قبل التسليم، '
    + 'ونجهّز الجهاز ونحوّل بياناتك إليه بلا أجر إضافي.',
  city: 'صنعاء',
  address: 'صنعاء — شارع الزبيري',
  whatsapp: '712334455',
  hours: 'السبت – الخميس · ٩:٠٠ ص – ١٠:٠٠ م',
  logo: img('logo.png'),
  banner: img('hero.png'),
  showcase: img('hero.png'),
  // سماويّ الشعار نفسه — اللوحة كلها تُشتقّ منه في derivePalette
  color: '#38C0D8',
  color_deep: '#12556E',
  plan: 'pro',
  // سكِن داكن: الدور الذي كان يؤدّيه «أطلس» في العرض، وأنسب
  // ما يكون لسماويٍّ ساطع ولقطعٍ مقصوصة أكثرها أسود ومعدني.
  theme: 'midnight',
  verified: 1,
  status: 'active',
  country: 'YE',
  delivery_fee: 2000,
  delivery_free_over: 80000,
  delivery_note: 'توصيل داخل صنعاء خلال ٢٤ ساعة، ومجاني للطلبات فوق ٨٠٬٠٠٠ ريال',
  pay_methods: 'cod,wallet,bank',
  pay_note: 'الدفع عند الاستلام متاح داخل صنعاء، والتحويل للمحافظات.',
};

const ZONES = [
  { name: 'داخل صنعاء', fee: 1500, free_over: 60000, sort: 1 },
  { name: 'عدن وتعز والحديدة', fee: 4000, free_over: 150000, sort: 2 },
  { name: 'بقية المحافظات', fee: 6500, free_over: 250000, sort: 3 },
];

const CATEGORIES = [
  { key: 'phones', name: 'هواتف وأجهزة لوحية', sort: 1 },
  { key: 'computers', name: 'حواسب وشاشات', sort: 2 },
  { key: 'audio', name: 'صوتيات', sort: 3 },
  { key: 'accessories', name: 'ملحقات وتخزين', sort: 4 },
  { key: 'gaming', name: 'ألعاب وواقع افتراضي', sort: 5 },
  { key: 'imaging', name: 'ساعات وكاميرات', sort: 6 },
];

/**
 * الكتالوج — ستة عشر صنفاً، صورةُ كلٍّ منها من مجلّد المتجر.
 *
 * `old_price` موجود حيث يوجد خصمٌ فعلي فقط — قسم «عروض مميزة»
 * في الواجهة يقرأ منه، ولا يعرض خصماً لم يُسجَّل هنا. وصنفٌ
 * واحد بكمية صفر عن قصد: نفاد المخزون حالةٌ تُرى في الواجهة.
 */
const PRODUCTS = [
  {
    cat: 'phones', brand: 'NEXA', name: 'هاتف ذكي بهيكل تيتانيوم',
    summary: 'شاشة ٦.٧ بوصة · ٢٥٦ جيجا',
    description:
      'إطار تيتانيوم مصقول يخفّ في اليد ويقاوم الالتواء، وخلفه '
      + 'شاشة أموليد ٦.٧ بوصة بمعدل ١٢٠ هرتز تُقرأ تحت شمس الظهيرة. '
      + 'ثلاث كاميرات خلفية بتثبيت بصري، وبطارية تكفي يوماً كاملاً '
      + 'من الاستعمال الثقيل مع شحن سريع يملأ نصفها في نصف ساعة.',
    variant: 'تيتانيوم طبيعي · ٢٥٦ جيجا', price: 620000, old_price: 720000, qty: 7,
    image: 'phone-titanium.png', sort: 1,
  },
  {
    cat: 'phones', brand: 'NEXA', name: 'جهاز لوحي مع قلم',
    summary: 'شاشة ١١ بوصة · قلم مغناطيسي',
    description:
      'لوحيّ ١١ بوصة بحوافّ رفيعة وهيكل ألمنيوم، يأتي معه قلم '
      + 'يلتصق بجانبه مغناطيسياً ويشحن منه. القلم يقرأ ضغط اليد '
      + 'فيرقّ الخط ويغلظ كالقلم الحقيقي — للرسم والتوقيع وتصحيح '
      + 'المستندات. أربع سمّاعات موزّعة على الجوانب.',
    variant: 'رمادي فلكي · ١٢٨ جيجا', price: 340000, old_price: 395000, qty: 11,
    image: 'tablet-stylus.png', sort: 2,
  },
  {
    cat: 'phones', brand: 'PAGE', name: 'قارئ كتب إلكتروني',
    summary: 'حبر إلكتروني ٧ بوصات · إضاءة دافئة',
    description:
      'شاشة حبر إلكتروني لا تُتعب العين ولا تنعكس عليها الشمس، '
      + 'فتقرأ عليها في الخارج كما تقرأ على الورق. إضاءة أمامية '
      + 'تتدرّج إلى الأصفر الدافئ ليلاً، وبطارية تدوم أسابيع لا '
      + 'ساعات. يسع آلاف الكتب في ٢٠٠ غرام.',
    variant: '٧ بوصات · ٣٢ جيجا', price: 96000, qty: 18,
    image: 'ereader-eink.png', sort: 3,
  },
  {
    cat: 'computers', brand: 'ORBIT', name: 'حاسب محمول خفيف',
    summary: 'معالج ثماني النوى · ١٦ جيجا',
    description:
      'حاسب عمل يومي بهيكل ألمنيوم موحّد لا يتجاوز ١.٢ كجم، فيُحمل '
      + 'في الحقيبة بلا أن يُحسّ. معالج ثماني النوى و١٦ جيجا ذاكرة '
      + 'يكفيان التحرير والبرمجة ومئات الألسنة المفتوحة، وبطارية '
      + 'تصمد يوم عمل كامل. لوحة مفاتيح مضاءة وقارئ بصمة.',
    variant: 'ذهبي رملي · ٥١٢ جيجا', price: 780000, old_price: 890000, qty: 4,
    image: 'laptop-ultrabook.png', sort: 4,
  },
  {
    cat: 'computers', brand: 'VERTEX', name: 'شاشة منحنية فائقة العرض',
    summary: '٤٩ بوصة · ١٢٠ هرتز',
    description:
      'تسع وأربعون بوصة بانحناءة تلفّ مجال النظر، تُغني عن شاشتين '
      + 'وعن الفاصل بينهما. معدل تحديث ١٢٠ هرتز وزمن استجابة منخفض '
      + 'للألعاب، وتغطية لونية واسعة للتصميم والمونتاج. حامل يرتفع '
      + 'وينخفض ويميل، ومنفذ USB‑C يشحن الحاسب بكابل واحد.',
    variant: '٤٩ بوصة · DQHD', price: 560000, qty: 3,
    image: 'monitor-ultrawide-curved.png', sort: 5,
  },
  {
    cat: 'audio', brand: 'SONARA', name: 'سماعة رأس بعزل ضوضاء',
    summary: 'عزل نشط · ٤٥ ساعة تشغيل',
    description:
      'سماعة فوق الأذن بعزل نشط يخفض ضجيج الشارع والمولّد إلى '
      + 'همس. وسائد جلدية لينة تتحمّل ساعات متواصلة، وبطارية تكفي '
      + 'أسبوع عمل بشحنة واحدة. تتصل بجهازين معاً وتنتقل بينهما '
      + 'تلقائياً حين يرنّ هاتفك، وتُطوى في جراب مرافق.',
    variant: 'أسود', price: 138000, old_price: 175000, qty: 16,
    image: 'headphones-anc-black.png', sort: 6,
  },
  {
    cat: 'audio', brand: 'SONARA', name: 'سماعات لاسلكية داخل الأذن',
    summary: 'علبة شحن · مقاومة للعرق',
    description:
      'سمّاعتان بوزن أربعة غرامات لكلٍّ منهما، تجلسان في الأذن بلا '
      + 'ضغط وتبقيان في مكانهما أثناء المشي والتمرين. عزل ضوضاء '
      + 'ووضع شفافية يمرّر صوت من يكلّمك بضغطة. خمس ساعات تشغيل '
      + 'وأربع شحنات إضافية في العلبة.',
    variant: 'أبيض', price: 92000, qty: 25,
    image: 'earbuds-wireless-white.png', sort: 7,
  },
  {
    cat: 'audio', brand: 'SONARA', name: 'مكبر صوت بلوتوث',
    summary: 'قماش مقاوم للرذاذ · ١٢ ساعة',
    description:
      'أسطوانة مكسوّة بقماش متين مقاوم للرذاذ، تُحمل إلى السطح '
      + 'والرحلة والمكتب. صوت يخرج في كل الاتجاهات لا في اتجاه '
      + 'واحد، وباصّ محكوم لا يطغى على الكلام. اثنتا عشرة ساعة '
      + 'تشغيل، ويمكن ربط اثنتين لصوت مجسّم.',
    variant: 'رمادي فحمي', price: 54000, old_price: 68000, qty: 21,
    image: 'speaker-bluetooth-fabric.png', sort: 8,
  },
  {
    cat: 'audio', brand: 'SONARA', name: 'ميكروفون استوديو بحامل',
    summary: 'مكثّف · وصلة USB',
    description:
      'ميكروفون مكثّف يوصَل بمنفذ USB مباشرة بلا واجهة صوتية، '
      + 'فيجهز للتسجيل في دقيقة. نمط التقاط أمامي يعزل صوتك عن '
      + 'المروحة وعن الغرفة، ومقبس سمّاعة للاستماع الفوري بلا '
      + 'تأخير. حامل مكتبي بقاعدة ثقيلة لا تنزلق.',
    variant: 'أسود · حامل مكتبي', price: 78000, qty: 9,
    image: 'microphone-studio.png', sort: 9,
  },
  {
    cat: 'accessories', brand: 'VOLT', name: 'لوحة مفاتيح ميكانيكية',
    summary: 'مفاتيح قابلة للتبديل · إضاءة RGB',
    description:
      'لوحة بحجم ٧٥٪ توفّر مساحة المكتب وتبقي مفاتيح الأسهم في '
      + 'مكانها. المفاتيح تُنزع باليد وتُبدّل بلا لحام، وطبقات '
      + 'العزل الداخلية تعطي صوتاً ممتلئاً لا رنيناً أجوف. مقبض '
      + 'جانبي للصوت، وإضاءة لكل مفتاح.',
    variant: 'أسود · مفاتيح خطّية', price: 86000, old_price: 105000, qty: 14,
    image: 'keyboard-mechanical-rgb.png', sort: 10,
  },
  {
    cat: 'accessories', brand: 'VOLT', name: 'ماوس عمودي مريح',
    summary: 'لاسلكي · يقلّل إجهاد الرسغ',
    description:
      'يمسك باليد كما تمسك المصافحة، فيبقى الساعد في وضعه '
      + 'الطبيعي بدل الالتواء الذي يسبّب ألم الرسغ بعد ساعات '
      + 'العمل. ستة أزرار قابلة للبرمجة، ودقّة تُضبط على أربع '
      + 'درجات. يعمل باللاسلكي أو بالبلوتوث على ثلاثة أجهزة.',
    variant: 'أسود', price: 34000, qty: 27,
    image: 'mouse-vertical-black.png', sort: 11,
  },
  {
    cat: 'accessories', brand: 'VOLT', name: 'قرص SSD محمول — ١ تيرا',
    summary: 'USB‑C · ١٠٥٠ ميجابايت/ث',
    description:
      'قرص بحجم بطاقة وبوزن أقلّ من ٦٠ غراماً، ينقل الجيجابايت '
      + 'في ثانية تقريباً — نسخة مشروع كامل قبل أن تُغلق الحقيبة. '
      + 'هيكل ألمنيوم يبدّد الحرارة فلا تهبط السرعة في منتصف النقل، '
      + 'وبلا أجزاء متحرّكة تُكسر إن سقط.',
    variant: '١ تيرابايت', price: 68000, qty: 0,
    image: 'ssd-portable-grey.png', sort: 12,
  },
  {
    cat: 'gaming', brand: 'AETHER', name: 'يد تحكم لاسلكية',
    summary: 'ردود لمسية · ٤٠ ساعة',
    description:
      'محرّكات لمسية تنقل ملمس ما يجري في اللعبة إلى راحتيك: '
      + 'خشونة الطريق، وشدّ الوتر، وارتداد الطلقة. زنادان '
      + 'يقاومان الضغط بتدرّج، ولوحة لمس أمامية، وأربعون ساعة '
      + 'تشغيل بشحنة. تعمل على الحاسب والمنصّة معاً.',
    variant: 'أبيض', price: 62000, qty: 19,
    image: 'controller-wireless-white.png', sort: 13,
  },
  {
    cat: 'gaming', brand: 'AETHER', name: 'نظارة واقع افتراضي',
    summary: 'شاشتان ٤K · تتبّع داخلي',
    description:
      'شاشتان بدقّة ٤K لكل عين تمحوان شبكة البكسلات التي كانت '
      + 'تفسد الإيهام. التتبّع داخل النظارة نفسها بلا حسّاسات '
      + 'تُركَّب على الجدران، فتُلبس وتُشغَّل في أي غرفة. توزيع وزن '
      + 'خلفي يريح الرقبة في الجلسات الطويلة.',
    variant: 'أسود', price: 425000, old_price: 480000, qty: 5,
    image: 'vr-headset-black.png', sort: 14,
  },
  {
    cat: 'imaging', brand: 'CHRONO', name: 'ساعة ذكية بسوار جلد',
    summary: 'AMOLED دائرية · ٧ أيام',
    description:
      'ساعة ذكية بمظهر ساعة كلاسيكية: إطار فولاذي مصقول وسوار '
      + 'جلد طبيعي، وخلفهما شاشة AMOLED دائرية تُقرأ تحت الشمس. '
      + 'تتابع النبض والنوم والأكسجين، وتصمد سبعة أيام بشحنة. '
      + 'السوار يُفكّ بزرّ ويُبدّل بسوار رياضي في ثوانٍ.',
    variant: 'فضي · سوار بني', price: 165000, old_price: 198000, qty: 12,
    image: 'watch-classic-leather.png', sort: 15,
  },
  {
    cat: 'imaging', brand: 'LUMEN', name: 'كاميرا بلا مرآة مع عدسة',
    summary: 'مستشعر APS‑C · تثبيت داخلي',
    description:
      'جسم معدني بأقراص علوية للسرعة والفتحة، تُضبط الكاميرا بها '
      + 'بالنظر لا بالقوائم. مستشعر APS‑C بتثبيت داخلي يعوّض '
      + 'ارتجاف اليد فتُصوَّر بسرعات بطيئة بلا حامل. تأتي بعدسة '
      + 'ثابتة ٣٥ ملم، وتصوّر فيديو ٤K.',
    variant: 'فضي · عدسة ٣٥ ملم', price: 890000, qty: 2,
    image: 'camera-mirrorless-silver.png', sort: 16,
  },
];

/**
 * تقييمات حقيقية الشكل — يكتبها في الإنتاج زوّارٌ لا هذا الملف.
 * وُضعت هنا لأن نجوم الواجهة تُحسب من الجدول لا من رقم مخترع:
 * منتج بلا صفوف هنا يظهر بلا نجوم، وهو ما ينبغي أن يحدث.
 */
const REVIEWS = {
  'هاتف ذكي بهيكل تيتانيوم': [
    [5, 'عبدالرحمن', 'الهيكل خفيف فعلاً مقارنة بحجمه. الشاشة تُقرأ في الشمس بلا عناء.', 1],
    [5, 'أمل', 'الشحن السريع صحيح — نصف ساعة وأنا خارج البيت.', 1],
    [4, 'وضّاح', 'الكاميرا ممتازة نهاراً، وفي الليل جيدة لا أكثر.', 1],
    [5, 'سمية', 'وصل مختوماً وفتحوه أمامي في المعرض ونقلوا بياناتي.', 0],
  ],
  'سماعة رأس بعزل ضوضاء': [
    [5, 'هاني', 'العزل أنقذني من صوت المولّد. أعمل الآن بلا انقطاع.', 1],
    [5, 'ريم', 'البطارية تصمد أسبوعاً معي. لم أشحنها منذ اشتريتها.', 1],
    [4, 'فؤاد', 'الصوت رائع، لكن الوسائد تدفئ الأذن بعد ساعتين.', 1],
    [4, 'نجلاء', 'الاتصال بجهازين معاً ميزة لم أعرف أنني أحتاجها.', 0],
  ],
  'حاسب محمول خفيف': [
    [5, 'مروان', 'أحمله يومياً ولا أشعر به في الحقيبة. البطارية تكفي دوامي كاملاً.', 1],
    [4, 'إيمان', 'سريع وهادئ. المروحة لا تُسمع إلا في التصدير.', 1],
    [5, 'طه', 'لوحة المفاتيح مريحة، وقارئ البصمة يعمل من أول مرة.', 1],
  ],
  'لوحة مفاتيح ميكانيكية': [
    [5, 'زياد', 'الصوت ممتلئ لا مزعج. بدّلت المفاتيح بلا لحام كما وُصف.', 1],
    [4, 'دعاء', 'المقبض الجانبي للصوت أفضل مما توقّعت.', 1],
    [5, 'أنور', 'حجم ٧٥٪ وفّر لي نصف المكتب وأبقى الأسهم.', 0],
  ],
  'ساعة ذكية بسوار جلد': [
    [5, 'خالد', 'تبدو كساعة كلاسيكية لا كجهاز. هذا بالضبط ما أردته.', 1],
    [4, 'لطيفة', 'الشاشة واضحة تحت الشمس. الشحن يكفي خمسة أيام لا سبعة.', 1],
    [5, 'بشير', 'قياس النوم دقيق مقارنة بما جرّبت قبلها.', 0],
  ],
  'شاشة منحنية فائقة العرض': [
    [5, 'صالح', 'استغنيت عن شاشتين والفاصل بينهما. فرق كبير في العمل.', 1],
    [4, 'هبة', 'ضخمة — قِس مكتبك قبل الطلب. الجودة ممتازة.', 1],
  ],
  'سماعات لاسلكية داخل الأذن': [
    [5, 'ياسر', 'تثبت في الأذن أثناء الجري ولا تسقط.', 1],
    [4, 'رنا', 'وضع الشفافية عملي جداً في الشارع.', 1],
    [5, 'معاذ', 'العلبة صغيرة تدخل جيب القميص.', 0],
  ],
  'نظارة واقع افتراضي': [
    [5, 'باسل', 'الوضوح نقلة عمّا جرّبته قبل سنتين. لا شبكة بكسلات إطلاقاً.', 1],
    [4, 'شيماء', 'مريحة نسبياً، لكن ساعة متواصلة كافية لأول مرة.', 1],
  ],
  'كاميرا بلا مرآة مع عدسة': [
    [5, 'إبراهيم', 'الأقراص العلوية غيّرت طريقتي في التصوير — أضبط بالنظر لا بالقوائم.', 1],
    [5, 'وفاء', 'التثبيت الداخلي حقيقي، صوّرت في الغروب بلا حامل.', 0],
  ],
  'مكبر صوت بلوتوث': [
    [4, 'عمّار', 'الصوت أوسع مما يوحي حجمه. أخذته للسطح ولا مشكلة.', 1],
    [5, 'ندى', 'ربطت اثنتين وصار الصوت يملأ الصالة.', 1],
  ],
  'ماوس عمودي مريح': [
    [5, 'جمال', 'ألم الرسغ اختفى بعد أسبوع. احتجت يومين للاعتياد عليه.', 1],
    [4, 'سلوى', 'الأزرار القابلة للبرمجة وفّرت عليّ وقتاً في العمل.', 1],
  ],
  'ميكروفون استوديو بحامل': [
    [5, 'أيمن', 'وصّلته بـUSB وسجّلت في دقيقة. لا يلتقط المروحة خلفي.', 1],
    [4, 'غادة', 'القاعدة ثقيلة ولا تنزلق. جودة الصوت تفوق سعرها.', 0],
  ],
  'جهاز لوحي مع قلم': [
    [5, 'رائد', 'القلم يقرأ الضغط فعلاً — أرسم عليه كما أرسم على الورق.', 1],
    [4, 'منى', 'السمّاعات الأربع مفاجأة سارّة.', 1],
  ],
  'قارئ كتب إلكتروني': [
    [5, 'حسن', 'أقرأ عليه في الشمس بلا انعكاس. لم أشحنه منذ ثلاثة أسابيع.', 1],
    [5, 'أروى', 'الإضاءة الدافئة ليلاً أراحت عيني كثيراً.', 1],
  ],
  'يد تحكم لاسلكية': [
    [4, 'فيصل', 'الردود اللمسية تفرق فعلاً في السباقات.', 1],
  ],
};

/* ── التنفيذ ────────────────────────────────────────────── */

async function main() {
  const stamp = now();

  const [merchant] = await sql`
    INSERT INTO merchants (phone, name, created_at, store_slots)
    VALUES (${MERCHANT.phone}, ${MERCHANT.name}, ${stamp}, 2)
    ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id`;

  const S = STORE;
  const [store] = await sql`
    INSERT INTO stores
      (merchant_id, slug, name, sector, tagline, about, city, address, whatsapp,
       hours, logo, banner, showcase, color, color_deep, plan, theme, verified,
       status, created_at, country, delivery_fee, delivery_free_over,
       delivery_note, pay_methods, pay_note)
    VALUES
      (${merchant.id}, ${S.slug}, ${S.name}, ${S.sector}, ${S.tagline}, ${S.about},
       ${S.city}, ${S.address}, ${S.whatsapp}, ${S.hours}, ${S.logo}, ${S.banner},
       ${S.showcase}, ${S.color}, ${S.color_deep}, ${S.plan}, ${S.theme},
       ${S.verified}, ${S.status}, ${stamp}, ${S.country}, ${S.delivery_fee},
       ${S.delivery_free_over}, ${S.delivery_note}, ${S.pay_methods}, ${S.pay_note})
    ON CONFLICT (slug) DO UPDATE SET
      merchant_id = EXCLUDED.merchant_id,
      name = EXCLUDED.name, sector = EXCLUDED.sector, tagline = EXCLUDED.tagline,
      about = EXCLUDED.about, city = EXCLUDED.city, address = EXCLUDED.address,
      whatsapp = EXCLUDED.whatsapp, hours = EXCLUDED.hours, logo = EXCLUDED.logo,
      banner = EXCLUDED.banner, showcase = EXCLUDED.showcase, color = EXCLUDED.color,
      color_deep = EXCLUDED.color_deep, plan = EXCLUDED.plan, theme = EXCLUDED.theme,
      verified = EXCLUDED.verified, status = EXCLUDED.status,
      country = EXCLUDED.country, delivery_fee = EXCLUDED.delivery_fee,
      delivery_free_over = EXCLUDED.delivery_free_over,
      delivery_note = EXCLUDED.delivery_note, pay_methods = EXCLUDED.pay_methods,
      pay_note = EXCLUDED.pay_note
    RETURNING id`;

  const storeId = store.id;

  /**
   * إحالة «أطلس» إلى التقاعد.
   *
   * هذا المتجر بديلٌ عنه لا جارٌ له: لو بقي الاثنان لظهر في
   * لوحة الإدارة وفي واجهة العرض متجرا إلكترونيات لتاجرٍ واحد،
   * أحدهما بصور عطور. البذرة القديمة في `src/seed.js` لم تعد
   * تُنشئه، فهذا السطر لِما بقي منه في قواعد قائمة — وهو بلا
   * أثر على قاعدة نظيفة.
   */
  const gone = await sql`DELETE FROM stores WHERE slug = 'atlas' RETURNING id`;

  // البذرة تُعيد بناء الكتالوج كاملاً كي لا تتراكم نسخ عند
  // إعادة التشغيل. الطلبات والتقييمات المرتبطة تسقط بالتتالي —
  // وهذا مقبول هنا وحده لأن المتجر بذرةٌ لا متجرُ تاجرٍ حقيقي.
  await sql`DELETE FROM products       WHERE store_id = ${storeId}`;
  await sql`DELETE FROM categories     WHERE store_id = ${storeId}`;
  await sql`DELETE FROM delivery_zones WHERE store_id = ${storeId}`;

  for (const z of ZONES) {
    await sql`INSERT INTO delivery_zones (store_id, name, fee, free_over, sort)
              VALUES (${storeId}, ${z.name}, ${z.fee}, ${z.free_over}, ${z.sort})`;
  }

  const catId = {};
  for (const c of CATEGORIES) {
    const [row] = await sql`
      INSERT INTO categories (store_id, name, sort)
      VALUES (${storeId}, ${c.name}, ${c.sort}) RETURNING id`;
    catId[c.key] = row.id;
  }

  let products = 0;
  let reviews = 0;

  for (const p of PRODUCTS) {
    const [row] = await sql`
      INSERT INTO products
        (store_id, category_id, name, summary, description, variant, brand,
         price, old_price, qty, image, live, sort, created_at)
      VALUES
        (${storeId}, ${catId[p.cat]}, ${p.name}, ${p.summary}, ${p.description},
         ${p.variant}, ${p.brand}, ${p.price}, ${p.old_price ?? null}, ${p.qty},
         ${img(p.image)}, 1, ${p.sort}, ${stamp})
      RETURNING id`;
    products++;

    for (const [rating, name, body, verified] of REVIEWS[p.name] ?? []) {
      await sql`
        INSERT INTO product_reviews
          (store_id, product_id, rating, name, body, author_key, verified, created_at)
        VALUES
          (${storeId}, ${row.id}, ${rating}, ${name}, ${body}, '', ${verified}, ${stamp})`;
      reviews++;
    }
  }

  console.log(
    `تمّ: متجر «${STORE.name}» (#${storeId}) — `
    + `${CATEGORIES.length} تصنيفاً · ${products} منتجاً · ${reviews} تقييماً\n`
    + (gone.length ? `أُحيل «أطلس» إلى التقاعد (#${gone[0].id})\n` : '')
    + `افتحه على /${STORE.slug}`,
  );
}

main()
  .catch((e) => { console.error('فشل البذر:', e); process.exitCode = 1; })
  .finally(() => sql.end());
