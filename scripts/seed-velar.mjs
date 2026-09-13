/**
 * بذرة «ڤِيلار» — متجر عبايات على الباقة برو بقالب «أتولييه».
 *
 * غايتها أن يُرى القالب على بيانات حقيقية لا على شبكة فارغة:
 * صور على عارضات بنسبة طولية، ومقاسات وألوان فعلية في
 * `product_variants` — فبدونها لا عيّنة لون تُعرض، ولا مرشّح
 * مقاس يُبنى، ولا صورة ثانية تظهر عند التمرير.
 *
 * والتشغيل **مُتَمِّم (idempotent)**: يُحدِّث ما وُجد بالرابط ولا
 * يُنشئ نسخة ثانية.
 *
 *   node scripts/seed-velar.mjs
 *
 * ملاحظة: `npm test` في المشروع القديم يبدأ بـ`npm run reset`
 * الذي يعيد بناء القاعدة — فأعِد تشغيل هذه البذرة بعده.
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
const img = (f) => `/stores/velar/${f}`;

/* ── تجهيز الأصول ─────────────────────────────────────────
   الصور وصلت في مجلّد اسمه عربي فيه مسافة وقوسان، وتمريره إلى
   next/image يعني ترميزاً على ثلاث طبقات يُخطئ فيه أول وسيط.
   تُنسخ إلى مسار لاتيني كبقية المتاجر، بأسماء تقول ما في الصورة.

   وصورة «عبايات.png» مستبعدة عمداً: عليها علامة بنك صور مائية،
   ومتجرٌ يعرض صورة موسومة بعلامة غيره ليس متجراً. */
// المواد الخام خارج `public/`: هي مصدرٌ للبذرة لا أصلٌ يُخدَم.
// بقاؤها تحت public كان ينشر ٣٣ م.ب مع كل إصدار لا يطلبها زائر.
const SOURCE = path.join(root, 'assets-src', 'ڤِيلار (Velar)');
const DEST = path.join(root, 'public', 'stores', 'velar');

const ASSETS = {
  'logo.png': 'logo.png',
  'صورة.png': 'campaign-silk.png',
  'صورة (2).png': 'campaign-aura.png',
  '11.png': 'silk-black.png',
  '9.png': 'satin-navy.png',
  '14.png': 'wrap-black.png',
  '17.jpg': 'crepe-black.jpg',
  '3.png': 'lace-black.png',
  'e84c8e0200cd297f6f655b6508ea8733.jpg': 'lace-collar-flat.jpg',
  '8.png': 'gold-embroidery.png',
  '10.png': 'velvet-navy.png',
  '2.png': 'velvet-burgundy.png',
  '1.png': 'floral-detail.png',
  'dd921e176ce9ee107b26a8c7866d8b7d.jpg': 'floral-black.jpg',
  'a3b6a0d80ececef892a3dd45d8fb1bd9.jpg': 'jacquard-flat.jpg',
};

function stageAssets() {
  if (!fs.existsSync(SOURCE)) {
    console.warn(`تنبيه: مجلّد الأصول غير موجود (${SOURCE}) — تُبذر البيانات بلا نسخ الصور.`);
    return 0;
  }
  fs.mkdirSync(DEST, { recursive: true });
  let n = 0;
  for (const [from, to] of Object.entries(ASSETS)) {
    const src = path.join(SOURCE, from);
    if (!fs.existsSync(src)) { console.warn(`  ناقص: ${from}`); continue; }
    fs.copyFileSync(src, path.join(DEST, to));
    n++;
  }
  return n;
}

/* ── التاجر والمتجر ─────────────────────────────────────── */

const MERCHANT = { phone: '966553311220', name: 'ڤِيلار' };

const STORE = {
  slug: 'velar',
  name: 'ڤِيلار',
  sector: 'fashion',
  tagline: 'عبايات مصمَّمة تُلبس كل يوم',
  about:
    'ڤِيلار بيت تصميم صغير في الرياض. نشتغل على القصّة الواحدة '
    + 'حتى تقع كما يجب، ثم نخيطها بأقمشة نختارها بأنفسنا: كريب '
    + 'ثقيل لا يشفّ، وساتان يسقط بلا كسر، ومخمل للمناسبات وحدها. '
    + 'المجموعة قصيرة عن قصد — قطعة لا نلبسها نحن لا تدخل الرفّ.',
  city: 'الرياض',
  address: 'حي حطين — طريق الأمير تركي الأول',
  whatsapp: '966553311220',
  hours: 'السبت – الخميس · ١١:٠٠ ص – ١٠:٠٠ م',
  logo: img('logo.png'),
  // الغلاف والواجهة حملتان مصوَّرتان عريضتان — والقالب يفرد
  // الواجهة بملء الشاشة، فتُقرأ صورةً لا شريطاً
  banner: img('campaign-aura.png'),
  showcase: img('campaign-silk.png'),
  // عنّابيّ مكسور بالبنّي — لا أحمر صريح.
  // اللوحة كلها تُشتقّ من هذا اللون، وأسطحها تأخذ منه درجةً
  // خفيفة: لونٌ مشبع يصبغ الورق ورديّاً ويزاحم الصور السوداء،
  // ودرجةٌ مكسورة تُبقي الأسطح شبه محايدة والأزرار عنّابية.
  color: '#4A2A32',
  color_deep: '#32161D',
  plan: 'pro',
  // السكِن الافتراضي مع قالب الأزياء: المحوران مستقلّان فعلاً
  theme: 'signature',
  layout: 'atelier',
  verified: 1,
  status: 'active',
  country: 'SA',
  delivery_fee: 25,
  delivery_free_over: 500,
  delivery_note: 'الشحن خلال ٢–٤ أيام عمل، ومجاني للطلبات فوق ٥٠٠ ر.س',
  pay_methods: 'cod,bank',
  pay_note: 'التحويل البنكي على حساب المتجر، أو الدفع عند الاستلام.',
};

const ZONES = [
  { name: 'داخل الرياض', fee: 20, free_over: 400, sort: 1 },
  { name: 'جدة والمنطقة الشرقية', fee: 30, free_over: 600, sort: 2 },
  { name: 'بقية المناطق', fee: 40, free_over: 800, sort: 3 },
];

const CATEGORIES = [
  { key: 'daily', name: 'عبايات يومية', sort: 1 },
  { key: 'evening', name: 'عبايات سهرة', sort: 2 },
  { key: 'embroidered', name: 'مطرّزات', sort: 3 },
  { key: 'kaftan', name: 'قفاطين', sort: 4 },
];

/**
 * المقاسات بترتيب التاجر لا أبجدياً — وهو ترتيب العرض نفسه.
 */
const SIZES = ['٥٢', '٥٤', '٥٦', '٥٨', '٦٠'];

/**
 * الكتالوج.
 *
 * `colors` قائمة [اسم، صورة، نفد] — و«نفد» مقاسات نفدت في هذا
 * اللون وحده، فيرى الزائر مقاساً مشطوباً من أول تحميل كما في
 * متجر حقيقي، لا شبكةً كلّها متوفّرة.
 *
 * والصورة تعيش مع اللون لا مع المنتج: منها تُبنى عيّنة اللون في
 * الشبكة وصورة التمرير الثانية — ولا يُترجم اسم عربي إلى لون
 * مخترَع.
 */
const PRODUCTS = [
  {
    cat: 'daily', sort: 1, name: 'عباءة لومير الحريرية',
    summary: 'كريب حريري بقصّة كلوش وشيلة من القماش نفسه',
    description:
      'قصّة كلوش تتّسع من الكتف فتقع بلا شدّ على الوسط. الكريب '
      + 'الحريري ثقيل بما يكفي فلا يشفّ ولا يتجعّد في السيارة، '
      + 'ومعها شيلة من القماش نفسه بطول ٢٠٠ سم.',
    price: 690, image: 'silk-black.png', stock: 6,
    colors: [['أسود', 'silk-black.png', []], ['كحلي', 'satin-navy.png', ['٦٠']]],
  },
  {
    cat: 'daily', sort: 2, name: 'عباءة نسيم الملفوفة',
    summary: 'ساتان مطفي بلفّة أمامية وأكمام واسعة',
    description:
      'تُلفّ من الأمام وتُثبَّت بحزام مخفيّ، فلا أزرار تفتح مع '
      + 'الحركة. والساتان مطفي لا لامع — تُلبس نهاراً بلا أن تبدو سهرة.',
    price: 540, old_price: 640, image: 'wrap-black.png', stock: 4,
    colors: [['أسود', 'wrap-black.png', []]],
  },
  {
    cat: 'daily', sort: 3, name: 'عباءة الجاكار السادة',
    summary: 'جاكار بنقشة غائرة بلا تطريز',
    description:
      'النقشة في نسيج القماش نفسه لا مضافةً عليه، فلا شيء يعلق '
      + 'ولا خيط ينسلّ مع الغسل. أخفّ ما في المجموعة وأنسبها للصيف.',
    price: 460, image: 'jacquard-flat.jpg', stock: 9,
    colors: [['أسود', 'jacquard-flat.jpg', []]],
  },
  {
    cat: 'daily', sort: 4, name: 'عباءة الياقة الدانتيل',
    summary: 'ياقة دانتيل وأطراف أكمام منه',
    description:
      'ياقة مبطّنة بالدانتيل وأطراف أكمام منه، والباقي كريب سادة '
      + '— تفصيلة واحدة تكفي القطعة.',
    price: 495, image: 'lace-collar-flat.jpg', stock: 5,
    colors: [['أسود', 'lace-collar-flat.jpg', ['٥٢']]],
  },
  {
    cat: 'embroidered', sort: 5, name: 'عباءة سُهى المطرّزة',
    summary: 'كريب مطرّز بخيط حريري على الصدر والأكمام',
    description:
      'التطريز مشغول باليد على الصدر وأطراف الأكمام بخيط حريري '
      + 'أسود على أسود — يُرى في الضوء ولا يُرى في الظلّ.',
    price: 620, image: 'crepe-black.jpg', stock: 3,
    colors: [['أسود', 'crepe-black.jpg', []]],
  },
  {
    cat: 'embroidered', sort: 6, name: 'عباءة الزهر',
    summary: 'تطريز زهري على أطراف الأكمام وحدها',
    description:
      'زهور مطرّزة على أطراف الأكمام، والقصّة واسعة سادة — '
      + 'القطعة كلها تقول شيئاً واحداً.',
    price: 730, image: 'floral-black.jpg', stock: 4,
    colors: [
      ['أسود بتطريز ليلكي', 'floral-black.jpg', []],
      ['أسود بتطريز وردي', 'floral-detail.png', ['٥٨', '٦٠']],
    ],
  },
  {
    cat: 'embroidered', sort: 7, name: 'عباءة دانتيل الليل',
    summary: 'شرائط دانتيل على الفتحة الأمامية والأطراف',
    description:
      'دانتيل مركّب على طول الفتحة وأسفل العباءة وأطراف الأكمام، '
      + 'على كريب مطفي — الفرق بين اللمعتين هو ما يُظهر الشغل.',
    price: 780, image: 'lace-black.png', stock: 5,
    colors: [['أسود', 'lace-black.png', []], ['أسود بياقة', 'lace-collar-flat.jpg', []]],
  },
  {
    cat: 'evening', sort: 8, name: 'عباءة أورا المخملية',
    summary: 'مخمل مطرّز بالخرز على الفتحة والأكمام',
    description:
      'مخمل ثقيل يسقط مستقيماً، وتطريز خرز على الفتحة وأطراف '
      + 'الأكمام. للمناسبات المسائية، ولا تُغسل إلا جافّاً.',
    price: 1690, image: 'velvet-navy.png', stock: 2,
    colors: [['كحلي', 'velvet-navy.png', []], ['عنّابي', 'velvet-burgundy.png', ['٥٢', '٦٠']]],
  },
  {
    cat: 'evening', sort: 9, name: 'عباءة ساتان البحر',
    summary: 'ساتان لامع بقصّة منسدلة وشيلة مطابقة',
    description:
      'ساتان يعكس الضوء مع الحركة، بقصّة تنسدل من الكتف إلى '
      + 'الأرض بلا خصر. ومعها شيلة من القماش نفسه.',
    price: 850, old_price: 980, image: 'satin-navy.png', stock: 6,
    colors: [['كحلي', 'satin-navy.png', []], ['أسود', 'silk-black.png', []]],
  },
  {
    cat: 'evening', sort: 10, name: 'فرملة الشجر الذهبي',
    summary: 'تطريز ذهبي بنقشة نخيل على الأطراف',
    description:
      'نقشة نخيل مطرّزة بخيط ذهبي على أطراف الأكمام والذيل، '
      + 'مشغولة يدوياً. عددها محدود لأن التطريز يدويّ لا آليّ.',
    price: 1450, old_price: 1690, image: 'gold-embroidery.png', stock: 0,
    colors: [['أسود بذهبي', 'gold-embroidery.png', []]],
  },
  {
    cat: 'kaftan', sort: 11, name: 'قفطان العنّاب المخملي',
    summary: 'مخمل عنّابي بشريط مطرّز على الفتحة',
    description:
      'قفطان مخمل بلون العنّاب، بشريط مطرّز يمتدّ على الفتحة '
      + 'كاملة وأطراف الأكمام، ومعه شيلة من القماش نفسه.',
    price: 1890, image: 'velvet-burgundy.png', stock: 3,
    colors: [['عنّابي', 'velvet-burgundy.png', ['٦٠']]],
  },
];

/**
 * التقييمات — على نصف الكتالوج فقط.
 *
 * القطعة التي لم يقيّمها أحد تصمت في الواجهة، وهذا ما يجعل
 * النجمة تعني شيئاً حين تظهر. وفيها ملاحظات عن المقاس لأن هذا
 * ما يُكتب فعلاً في متاجر الأزياء.
 */
const REVIEWS = {
  'عباءة لومير الحريرية': [
    [5, 'رهف', 'القماش ثقيل ومريح، والشيلة من نفس القماش وفّرت عليّ البحث.', 1],
    [4, 'أم عبدالله', 'حلوة جداً، بس المقاس يجي أوسع شوي — أخذت ٥٤ بدل ٥٦.', 1],
    [5, 'نورة', 'لبستها في الدوام وفي مناسبة، وما تجعّدت.', 0],
  ],
  'عباءة نسيم الملفوفة': [
    [5, 'سارة', 'اللفّة ثابتة ما تفتح مع المشي، وهذا اللي كنت أدوّر عليه.', 1],
    [4, 'هيا', 'الساتان مطفي فعلاً كما في الوصف.', 0],
  ],
  'عباءة أورا المخملية': [
    [5, 'لمياء', 'التطريز نظيف من الداخل والخارج، تستاهل سعرها.', 1],
    [5, 'دانة', 'لبستها في عرس وسألوني عنها ثلاث مرات.', 1],
    [4, 'منيرة', 'ثقيلة شوي — طبيعي للمخمل بس أحببت أنبّه.', 1],
  ],
  'عباءة ساتان البحر': [
    [4, 'أروى', 'الكحلي أغمق من الصورة بدرجة، وطلع أحلى.', 1],
    [5, 'شهد', 'وصلت قبل الموعد بيومين ومغلّفة بعناية.', 1],
  ],
  'عباءة دانتيل الليل': [
    [5, 'جواهر', 'الدانتيل مخيّط لا ملصوق، وهذا يبان من أول لبسة.', 1],
  ],
  'عباءة الزهر': [
    [5, 'مها', 'التطريز دقيق وهادئ، لا صارخ.', 0],
    [4, 'ريم', 'كنت أتمنى مقاس ٦٠ في اللون الوردي.', 1],
  ],
};

/* ── التنفيذ ────────────────────────────────────────────── */

async function main() {
  const copied = stageAssets();
  const stamp = now();

  const [merchant] = await sql`
    INSERT INTO merchants (phone, name, created_at, store_slots)
    VALUES (${MERCHANT.phone}, ${MERCHANT.name}, ${stamp}, 1)
    ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
    RETURNING id`;

  const S = STORE;
  const [store] = await sql`
    INSERT INTO stores
      (merchant_id, slug, name, sector, tagline, about, city, address, whatsapp,
       hours, logo, banner, showcase, color, color_deep, plan, theme, layout,
       verified, status, created_at, country, delivery_fee, delivery_free_over,
       delivery_note, pay_methods, pay_note)
    VALUES
      (${merchant.id}, ${S.slug}, ${S.name}, ${S.sector}, ${S.tagline}, ${S.about},
       ${S.city}, ${S.address}, ${S.whatsapp}, ${S.hours}, ${S.logo}, ${S.banner},
       ${S.showcase}, ${S.color}, ${S.color_deep}, ${S.plan}, ${S.theme}, ${S.layout},
       ${S.verified}, ${S.status}, ${stamp}, ${S.country}, ${S.delivery_fee},
       ${S.delivery_free_over}, ${S.delivery_note}, ${S.pay_methods}, ${S.pay_note})
    ON CONFLICT (slug) DO UPDATE SET
      merchant_id = EXCLUDED.merchant_id,
      name = EXCLUDED.name, sector = EXCLUDED.sector, tagline = EXCLUDED.tagline,
      about = EXCLUDED.about, city = EXCLUDED.city, address = EXCLUDED.address,
      whatsapp = EXCLUDED.whatsapp, hours = EXCLUDED.hours, logo = EXCLUDED.logo,
      banner = EXCLUDED.banner, showcase = EXCLUDED.showcase, color = EXCLUDED.color,
      color_deep = EXCLUDED.color_deep, plan = EXCLUDED.plan, theme = EXCLUDED.theme,
      layout = EXCLUDED.layout, verified = EXCLUDED.verified, status = EXCLUDED.status,
      country = EXCLUDED.country, delivery_fee = EXCLUDED.delivery_fee,
      delivery_free_over = EXCLUDED.delivery_free_over,
      delivery_note = EXCLUDED.delivery_note, pay_methods = EXCLUDED.pay_methods,
      pay_note = EXCLUDED.pay_note
    RETURNING id`;

  const storeId = store.id;

  // يُعاد بناء الكتالوج كاملاً كي لا تتراكم نسخ عند إعادة
  // التشغيل. الخيارات والتقييمات تسقط بالتتالي مع المنتجات.
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

  let products = 0, variants = 0, reviews = 0;

  for (const p of PRODUCTS) {
    const [row] = await sql`
      INSERT INTO products
        (store_id, category_id, name, summary, description, variant, brand,
         price, old_price, qty, image, live, sort, created_at,
         has_variants, opt1_name, opt2_name, low_stock)
      VALUES
        (${storeId}, ${catId[p.cat]}, ${p.name}, ${p.summary}, ${p.description},
         '', 'ڤِيلار', ${p.price}, ${p.old_price ?? null}, 0,
         ${img(p.image)}, 1, ${p.sort}, ${stamp}, 1, 'المقاس', 'اللون', 3)
      RETURNING id`;
    products++;

    // شبكة المقاس × اللون. الصورة تُكتب على كل صفوف اللون فمنها
    // تُبنى العيّنة وصورة التمرير مهما كان المقاس المختار.
    let sort = 0, total = 0;
    for (const [color, file, gone] of p.colors) {
      for (const size of SIZES) {
        const qty = gone.includes(size) ? 0 : p.stock;
        total += qty;
        await sql`
          INSERT INTO product_variants
            (store_id, product_id, v1, v2, price, qty, sku, image, live, sort)
          VALUES
            (${storeId}, ${row.id}, ${size}, ${color}, NULL, ${qty}, '',
             ${img(file)}, 1, ${sort})`;
        sort++;
        variants++;
      }
    }

    // products.qty مجموعٌ مخزَّن حين has_variants = 1 (انظر كتلة
    // «الخيارات» في المخطّط). البذرة تتجاوز التطبيق فتحسبه
    // بنفسها، وإلا كذبت تسمية التوفّر على كل بطاقة.
    await sql`UPDATE products SET qty = ${total} WHERE id = ${row.id}`;

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
    `تمّ: متجر «${STORE.name}» (#${storeId}) — ${copied} صورة · `
    + `${CATEGORIES.length} تصنيفات · ${products} منتجاً · ${variants} خياراً · ${reviews} تقييماً\n`
    + `القالب: ${STORE.layout} · السكِن: ${STORE.theme}\n`
    + `افتحه على /${STORE.slug}`,
  );
}

main()
  .catch((e) => { console.error('فشل البذر:', e); process.exitCode = 1; })
  .finally(() => sql.end());
