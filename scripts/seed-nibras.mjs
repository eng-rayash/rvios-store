/**
 * بذرة «متجر نبراس» — متجرٌ حيّ على الباقة برو.
 *
 * غايته ليست التجربة وحدها: درجة التصميم «فاخر» لا تُقاس على
 * ثلاثة منتجات وهمية. الشبكة والمرشّحات والعروض وصفّ الماركات
 * كلّها تحتاج كتالوجاً بحجم متجر حقيقي كي يُرى ما اشترته
 * الباقة فعلاً.
 *
 * والتشغيل **مُتَمِّم (idempotent)**: يُحدِّث ما وُجد بالرابط ولا
 * يُنشئ نسخة ثانية، فيمكن إعادته بعد كل تعديل بلا تنظيف يدوي.
 *
 *   node scripts/seed-nibras.mjs
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
const img = (f) => `/stores/nibras/${f}`;

/* ── التاجر والمتجر ─────────────────────────────────────── */

/**
 * الدولة تُحدِّد ثلاثة أشياء معاً ولا تُفصل عنها: رمز العملة
 * المعروض، ونمط رقم الجوال، ومناطق التوصيل. متجرٌ عملته «ر.س»
 * ومدينته صنعاء ورقمه ٩٦٧ ليس متجراً بل ثلاثة متاجر في صفّ واحد.
 */
const MERCHANT = { phone: '966501234567', name: 'نبراس' };

const STORE = {
  slug: 'nibras',
  name: 'متجر نبراس',
  sector: 'electronics',
  tagline: 'منتجات مختارة لأسلوب حياة أفضل',
  about:
    'بدأ نبراس من فكرة واحدة: أن يجد المشتري القطعة الجيدة بلا أن '
    + 'يبحث عنها طويلاً. نختار كل صنف بأنفسنا، ونجرّبه قبل عرضه، '
    + 'ولا نضيف إلى الرفّ ما لا نستعمله نحن. ما تراه هنا قائمة قصيرة '
    + 'عن قصد — كل قطعة فيها اجتازت الاختيار.',
  city: 'الرياض',
  address: 'حي العليا — طريق الملك فهد',
  whatsapp: '966501234567',
  hours: 'السبت – الخميس · ٩:٠٠ ص – ٩:٠٠ م',
  logo: img('logo.png'),
  banner: img('hero.png'),
  showcase: img('hero.png'),
  // أحمر الشعار نفسه — اللوحة كلها تُشتقّ منه في derivePalette
  color: '#CE1126',
  color_deep: '#8E0A18',
  plan: 'pro',
  theme: 'signature',
  verified: 1,
  status: 'active',
  country: 'SA',
  delivery_fee: 25,
  delivery_free_over: 400,
  delivery_note: 'التوصيل خلال ١–٣ أيام عمل، ومجاني للطلبات فوق ٤٠٠ ر.س',
  pay_methods: 'cod,wallet,bank',
  pay_note: 'الدفع عند الاستلام متاح في كل المناطق.',
};

const ZONES = [
  { name: 'داخل الرياض', fee: 15, free_over: 300, sort: 1 },
  { name: 'جدة والدمام', fee: 30, free_over: 500, sort: 2 },
  { name: 'بقية المناطق', fee: 45, free_over: 700, sort: 3 },
];

const CATEGORIES = [
  { key: 'audio', name: 'سماعات', sort: 1 },
  { key: 'watches', name: 'ساعات', sort: 2 },
  { key: 'bags', name: 'حقائب', sort: 3 },
  { key: 'shoes', name: 'أحذية', sort: 4 },
  { key: 'perfumes', name: 'عطور', sort: 5 },
  { key: 'eyewear', name: 'نظارات', sort: 6 },
];

/**
 * الكتالوج.
 *
 * `old_price` موجود حيث يوجد خصمٌ فعلي فقط — قسم «عروض مميزة»
 * في الواجهة يقرأ منه، ولا يعرض خصماً لم يُسجَّل هنا.
 */
const PRODUCTS = [
  {
    cat: 'audio', brand: 'AURA', name: 'سماعة رأس لاسلكية',
    summary: 'عزل ضوضاء نشط · ٤٠ ساعة تشغيل',
    description:
      'سماعة فوق الأذن بعزل ضوضاء نشط يخفض ضجيج الطائرة والمكتب '
      + 'إلى همس. وسائد بروتين لينة تتحمّل ساعات متواصلة، وبطارية '
      + 'تكفي أسبوع عمل بشحنة واحدة. تتصل بجهازين معاً وتنتقل بينهما '
      + 'تلقائياً حين يرنّ هاتفك.',
    variant: 'أسود', price: 489, old_price: 649, qty: 24,
    image: 'headphones-black.png', sort: 1,
  },
  {
    cat: 'audio', brand: 'AURA', name: 'سماعة رأس بلوتوث',
    summary: 'تصميم رملي · صوت واسع',
    description:
      'النسخة الرملية من سماعة نبراس الأكثر مبيعاً: هيكل معدني '
      + 'خفيف وجلد ناعم بلون الصحراء. المشغّل نفسه بمدى صوتي واسع '
      + 'وباص محكوم لا يطغى على الصوت البشري.',
    variant: 'رملي', price: 449, qty: 12,
    image: 'headphones-aura-sand.png', sort: 2,
  },
  {
    cat: 'watches', brand: 'AURA', name: 'ساعة ذكية بسوار جلد',
    summary: 'شاشة AMOLED · قياس نبض متواصل',
    description:
      'ساعة ذكية بمظهر ساعة كلاسيكية: إطار فولاذي مصقول وسوار جلد '
      + 'طبيعي، وخلفهما شاشة AMOLED دائرية تقرأ تحت الشمس. تتابع '
      + 'النبض والنوم والخطوات، وتعمل خمسة أيام بشحنة.',
    variant: 'فضي · سوار بني', price: 699, old_price: 899, qty: 8,
    image: 'watch-aura-leather.png', sort: 3,
  },
  {
    cat: 'watches', brand: 'AURA', name: 'ساعة ذكية رياضية',
    summary: 'مقاومة للماء · تتبّع ٤٠ نشاطاً',
    description:
      'هيكل ألمنيوم خفيف وسوار سيليكون رياضي مقاوم للعرق. تتبّع '
      + 'أربعين نشاطاً، وقياس أكسجين الدم، ومقاومة ماء حتى ٥٠ متراً '
      + 'فتبقى في معصمك في المسبح.',
    variant: 'أسود', price: 379, qty: 31,
    image: 'watch-aura-sport.png', sort: 4,
  },
  {
    cat: 'watches', brand: 'AETHEL', name: 'ساعة كلاسيكية أوتوماتيك',
    summary: 'حركة ميكانيكية · سوار جلد إيطالي',
    description:
      'حركة أوتوماتيكية تُشحن من حركة يدك بلا بطارية، خلف زجاج '
      + 'ياقوتي مقاوم للخدش. مينا بيضاء بمؤشرات ذهبية وردية وثانية '
      + 'صغيرة عند الرقم ستة، وسوار جلد إيطالي مخيط يدوياً.',
    variant: 'فضي · جلد بني', price: 1290, qty: 5,
    image: 'watch-aethel-classic.png', sort: 5,
  },
  {
    cat: 'bags', brand: 'BAHOL', name: 'حقيبة ظهر عملية',
    summary: 'جيب لابتوب ١٦ بوصة · قماش مقاوم للماء',
    description:
      'حقيبة يوم كاملة: جيب مبطّن للابتوب حتى ١٦ بوصة، وجيب أمامي '
      + 'منظّم للشاحن والكابلات، وجيب جانبي شبكي للقارورة. قماش '
      + 'باليستيّ مقاوم للماء وسحّابات معدنية تتحمّل الاستعمال اليومي.',
    variant: 'أسود', price: 329, old_price: 429, qty: 18,
    image: 'backpack-black.png', sort: 6,
  },
  {
    cat: 'bags', brand: 'ATHLETIC', name: 'حقيبة سفر رياضية',
    summary: 'سعة ٤٥ لتراً · جيب حذاء منفصل',
    description:
      'حقيبة النادي والسفر القصير: سعة ٤٥ لتراً، وجيب جانبي منفصل '
      + 'للحذاء يعزل ما فيه عن بقية المتاع، وحزام كتف مبطّن قابل '
      + 'للفكّ. القاعدة مقوّاة فتقف الحقيبة بلا أن تميل.',
    variant: 'أسود', price: 279, qty: 22,
    image: 'duffel-athletic.png', sort: 7,
  },
  {
    cat: 'shoes', brand: 'VELOCE', name: 'حذاء رياضي للجري',
    summary: 'نعل EVA مرتد · شبك متنفّس',
    description:
      'حذاء جري بنعل EVA مزدوج الكثافة يعيد جزءاً من طاقة كل خطوة، '
      + 'ووجه شبكيّ متنفّس يبقي القدم جافة في الطقس الحار. النعل '
      + 'الخارجي مطاطي محزّز يمسك الأسفلت المبتلّ.',
    variant: 'أسود · ٤٠–٤٥', price: 359, old_price: 459, qty: 27,
    image: 'shoe-veloce-black.png', sort: 8,
  },
  {
    cat: 'shoes', brand: 'VELOCE', name: 'حذاء رياضي أبيض',
    summary: 'خفيف · للاستعمال اليومي',
    description:
      'حذاء يومي خفيف يمشي معك من الصباح إلى المساء. وجه شبكي أبيض '
      + 'سهل التنظيف، وبطانة داخلية مبطّنة عند الكعب تمنع الاحتكاك '
      + 'في المشي الطويل.',
    variant: 'أبيض · ٣٩–٤٤', price: 299, qty: 15,
    image: 'shoe-runner-white.png', sort: 9,
  },
  {
    cat: 'perfumes', brand: 'AURÉLIA', name: 'عطر نوكتيرن للرجال',
    summary: 'أو دو تواليت · ٧٥ مل',
    description:
      'عطر مسائي يفتح بالبرغموت والفلفل الأسود، ثم يهدأ إلى قلب من '
      + 'اللافندر والجلد، ويستقرّ على قاعدة من العنبر وخشب الأرز. '
      + 'ثباته من ست إلى ثماني ساعات، وأثره قريب لا يسبق صاحبه.',
    variant: '٧٥ مل', price: 399, qty: 20,
    image: 'perfume-nocturne.png', sort: 10,
  },
  {
    cat: 'perfumes', brand: 'AURÉLIA', name: 'عطر أوروم نوار',
    summary: 'بارفان إنتنس · ١٠٠ مل',
    description:
      'تركيز بارفان إنتنس: زعفران وعود في القلب، وفانيليا وباتشولي '
      + 'في القاعدة. رشّتان تكفيان ليومٍ كامل، وأثره يبقى على القماش '
      + 'إلى اليوم التالي.',
    variant: '١٠٠ مل', price: 549, old_price: 749, qty: 9,
    image: 'perfume-aurum-noir.png', sort: 11,
  },
  {
    cat: 'eyewear', brand: 'OAKLEY', name: 'نظارة شمسية أفياتور',
    summary: 'عدسات مستقطبة · حماية ١٠٠٪ من UV',
    description:
      'إطار أفياتور بجسر معدني رفيع وعدسات مستقطبة تقطع وهج الأسفلت '
      + 'والماء. حماية كاملة من الأشعة فوق البنفسجية، ووسادات أنف '
      + 'سيليكون قابلة للتعديل. تأتي بجراب صلب وقطعة تنظيف.',
    variant: 'أسود', price: 259, qty: 3,
    image: 'sunglasses-aviator.png', sort: 12,
  },
];

/**
 * تقييمات حقيقية الشكل — يكتبها في الإنتاج زوّارٌ لا هذا الملف.
 * وُضعت هنا لأن نجوم الواجهة تُحسب من الجدول لا من رقم مخترع:
 * منتج بلا صفوف هنا يظهر بلا نجوم، وهو ما ينبغي أن يحدث.
 */
const REVIEWS = {
  'سماعة رأس لاسلكية': [
    [5, 'أحمد', 'العزل ممتاز فعلاً، استخدمتها في رحلة طويلة ولم أسمع محرّك الطائرة.', 1],
    [5, 'سارة', 'البطارية تصمد أسبوعاً كاملاً معي. أفضل شراء هذه السنة.', 1],
    [4, 'خالد', 'الصوت رائع، لكن الوسائد تدفئ الأذن بعد ساعتين.', 1],
    [5, 'منى', 'وصلت في يومين والتغليف ممتاز.', 0],
    [4, 'ياسر', 'الاتصال بجهازين معاً ميزة لم أعرف أنني أحتاجها.', 1],
  ],
  'ساعة ذكية بسوار جلد': [
    [5, 'عبدالله', 'تبدو كساعة كلاسيكية لا كجهاز. هذا بالضبط ما أردته.', 1],
    [4, 'ريم', 'الشاشة واضحة تحت الشمس. الشحن يكفي أربعة أيام لا خمسة.', 1],
    [5, 'طارق', 'قياس النوم دقيق مقارنة بما جرّبت قبلها.', 0],
  ],
  'حقيبة ظهر عملية': [
    [5, 'فهد', 'حملت فيها لابتوب ١٦ بوصة وكتباً ولم يظهر عليها شيء.', 1],
    [4, 'لمى', 'الجيوب منظّمة جيداً. أتمنّى لو كان الجيب الجانبي أوسع.', 1],
    [5, 'سلمان', 'أمطرت عليّ ولم يبتلّ ما بداخلها.', 1],
    [4, 'هدى', 'جودة السحّابات ملحوظة.', 0],
  ],
  'حذاء رياضي للجري': [
    [5, 'ماجد', 'أجري به ١٠ كم يومياً منذ شهرين والنعل كما هو.', 1],
    [4, 'نورة', 'مريح جداً، لكن المقاس يأتي أصغر قليلاً — خذ رقماً أكبر.', 1],
    [5, 'وليد', 'ممسك ممتاز على الأرض المبتلّة.', 1],
  ],
  'عطر أوروم نوار': [
    [5, 'إبراهيم', 'الثبات حقيقي، أشمّه على قميصي في اليوم التالي.', 1],
    [5, 'دانة', 'رشّتان تكفيان. عطر مسائي بامتياز.', 1],
    [4, 'عمّار', 'ثقيل قليلاً على الصيف، ممتاز للشتاء.', 0],
  ],
  'ساعة كلاسيكية أوتوماتيك': [
    [5, 'مصطفى', 'حركة أوتوماتيك بهذا السعر شيء نادر. الزجاج الياقوتي بلا خدش بعد أشهر.', 1],
    [5, 'ليان', 'اشتريتها هدية وكان وقعها ممتازاً.', 0],
  ],
  'نظارة شمسية أفياتور': [
    [4, 'بدر', 'العدسات المستقطبة تفرق فعلاً في القيادة.', 1],
    [5, 'جواهر', 'خفيفة ولا تترك أثراً على الأنف.', 1],
  ],
  'حقيبة سفر رياضية': [
    [4, 'سعد', 'جيب الحذاء فكرة ممتازة. السعة أكبر مما توقّعت.', 1],
    [5, 'أروى', 'استعملتها في سفرة ثلاثة أيام وكفت.', 0],
  ],
  'سماعة رأس بلوتوث': [
    [5, 'يوسف', 'اللون أجمل في الواقع من الصورة.', 1],
    [4, 'شهد', 'الصوت نظيف، والباص غير مبالغ فيه.', 1],
  ],
  'حذاء رياضي أبيض': [
    [4, 'راكان', 'خفيف جداً. ينظّف بسهولة كما وُصف.', 1],
  ],
  'ساعة ذكية رياضية': [
    [5, 'تركي', 'أخذتها للمسبح ولا مشكلة إطلاقاً.', 1],
    [4, 'غادة', 'التطبيق بسيط وواضح.', 0],
  ],
  'عطر نوكتيرن للرجال': [
    [5, 'زياد', 'أثره قريب وأنيق، مناسب للعمل.', 1],
    [4, 'ندى', 'الثبات ست ساعات تقريباً كما ذُكر تماماً.', 1],
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

  // البذرة تُعيد بناء الكتالوج كاملاً كي لا تتراكم نسخ عند
  // إعادة التشغيل. الطلبات والتقييمات المرتبطة تسقط بالتتالي —
  // وهذا مقبول هنا وحده لأن المتجر بذرةٌ لا متجرُ تاجرٍ حقيقي.
  await sql`DELETE FROM products      WHERE store_id = ${storeId}`;
  await sql`DELETE FROM categories    WHERE store_id = ${storeId}`;
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
    + `افتحه على /${STORE.slug}`,
  );
}

main()
  .catch((e) => { console.error('فشل البذر:', e); process.exitCode = 1; })
  .finally(() => sql.end());
