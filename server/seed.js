// ═══════════════════════════════════════════════════════════
//  بيانات أولية — متجر سارة للعطور (من النماذج الأصلية)
//  + متجران إضافيان ليكون للوحة الإدارة والعرض ما تعرضه.
//
//  التشغيل:  npm run seed        (يضيف إن كانت القاعدة فارغة)
//            npm run reset       (يمسح كل شيء ويعيد البناء)
// ═══════════════════════════════════════════════════════════
import { db, now, migrate } from './db.js';
import { scope } from './tenancy.js';
import { makeRef } from './orders.js';
import { toE164 } from './countries.js';

const RESET = process.argv.includes('--reset');

// المخطّط أولاً: البذر على قاعدة فارغة تماماً أمر شائع
await migrate();

if (RESET) {
  // الترتيب يحترم المفاتيح الأجنبية: التوابع أولاً ثم الأصول
  // TRUNCATE ... RESTART IDENTITY يعيد ضبط عدّادات المعرّفات أيضاً،
  // فتبدأ البيانات الأولية من ١ في كل مرة كما كانت مع SQLite.
  await db.exec(`TRUNCATE order_items, orders, product_images, products, categories,
                        visits, visit_marks, reports, service_requests,
                        invoices, subscriptions, store_slug_history,
                        stores, sessions, otps, rate_limits, merchants,
                        platform_settings, audit_log
                 RESTART IDENTITY CASCADE`);
  console.log('  ✔ مُسحت البيانات السابقة');
}

if ((await db.prepare('SELECT COUNT(*)::int n FROM stores').get()).n > 0) {
  console.log('  • القاعدة تحتوي متاجر بالفعل — استخدم npm run reset لإعادة البناء');
  process.exit(0);
}

const ago = (days, hours = 0) =>
  new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();

/**
 * الأرقام مكتوبة أدناه بصيغتها المحلية لأنها أقرأ، وتُخزَّن
 * دولية لأن تسجيل الدخول يبحث بالصيغة الدولية منذ هجرة
 * `ops/migrate-phones.mjs`. البذر بلا توحيد يعني تاجراً مبذوراً
 * لا يستطيع الدخول إلى متجره.
 */
async function merchant(phone, name) {
  const res = await db.prepare('INSERT INTO merchants (phone, name, created_at) VALUES (?,?,?)')
    .run(toE164(phone), name, ago(60));
  return Number(res.lastInsertRowid);
}

async function store(merchantId, data) {
  if (data.whatsapp) data = { ...data, whatsapp: toE164(data.whatsapp) };
  const cols = Object.keys(data);
  const res = await db.prepare(
    `INSERT INTO stores (merchant_id, ${cols.join(',')}, created_at) VALUES (?, ${cols.map(() => '?').join(',')}, ?)`)
    .run(merchantId, ...cols.map((c) => data[c]), data.created_at ?? ago(45));
  return Number(res.lastInsertRowid);
}

// ═══ ١. متجر ذو يزن للعطور ═════════════════════════════════
const m1 = await merchant('777000000', 'ذو يزن');
const s1 = await store(m1, {
  slug: 'yazan',
  name: 'متجر ذو يزن للعطور',
  sector: 'perfumes',
  tagline: 'عطور شرقية وفرنسية أصلية',
  about: 'عطور شرقية وفرنسية أصلية، وبخور وعود مختار بعناية. نوصّل داخل صنعاء خلال ٢٤ ساعة، ولبقية المحافظات عبر شركات الشحن.',
  city: 'صنعاء',
  address: 'صنعاء — شارع حدة',
  whatsapp: '777000000',
  hours: 'السبت – الخميس: ٩ص – ٩م · الجمعة: ٤م – ٩م',
  color: '#9E2226',
  color_deep: '#6E1519',
  banner: '/assets/img/sectors/perfumes.jpg',
  // صورة العرض غير الغلاف — تظهر في قسم «قصة المتجر» (§٣.٤)
  showcase: '/assets/img/p3.jpg',
  plan: 'plus',
  verified: 1,
});

const S1 = scope(s1);
const cat = (name, sort) => S1.insert('categories', { name, sort });
const cMen   = await cat('عطور رجالية', 1);
const cWomen = await cat('عطور نسائية', 2);
const cOud   = await cat('بخور وعود', 3);
const cGift  = await cat('أطقم وهدايا', 4);

const PRODUCTS = [
  { c: cMen,   name: 'سوفاج او فورت',        img: 'p1', price: 38500, old: 44000, qty: 12, variant: '١٠٠ مل', summary: 'عطري منعش',
    desc: 'افتتاحية حمضية قوية على قاعدة من العنبر الرمادي والخشب. ثبات ممتاز وانتشار واسع، مناسب للنهار والمساء.' },
  { c: cMen,   name: 'ليرز — عنبر ذهبي',      img: 'p2', price: 26000, qty: 7,  variant: '٧٥ مل',  summary: 'شرقي دافئ',
    desc: 'عنبر دافئ ممزوج بالفانيليا والتوابل الخفيفة، برائحة عميقة تدوم طوال اليوم.' },
  { c: cMen,   name: 'مووست وانتد',           img: 'p5', price: 32000, qty: 4,  variant: '١٢٥ مل', summary: 'خشبي فاخر',
    desc: 'قنينة زجاجية غامقة بتصميم كلاسيكي، مزيج خشبي راقٍ يناسب المناسبات الرسمية.' },
  { c: cWomen, name: 'ضوء الحجر',             img: 'p4', price: 19500, qty: 15, variant: '٥٠ مل',  summary: 'زهري ناعم',
    desc: 'عطر نسائي هادئ بلمسة مسكية نظيفة، خفيف على البشرة ومناسب للاستخدام اليومي والعمل.' },
  { c: cWomen, name: 'توباكو فانيل',          img: 'p8', price: 29000, old: 34000, qty: 9, variant: '٥٠ مل', summary: 'فانيليا وتوابل',
    desc: 'فانيليا كريمية مع أوراق التبغ والزهور البيضاء، دافئ وجذاب خصوصاً في الأجواء الباردة.' },
  { c: cWomen, name: 'لوناي الأحمر',          img: 'p9', price: 41000, qty: 3,  variant: '٧٥ مل',  summary: 'شرقي فاخر',
    desc: 'قنينة حمراء بغطاء ذهبي، تركيبة شرقية غنية بالورد والعود، اختيار مميّز للمناسبات.' },
  { c: cOud,   name: 'عود رويال',             img: 'p7', price: 56000, qty: 6,  variant: '١٠٠ مل', summary: 'عود خالص',
    desc: 'عود طبيعي معتّق مع لمسة من الزهور البيضاء، كثافة عالية ورائحة تدوم على الملابس لأيام.' },
  { c: cOud,   name: 'طواق — خشب الصندل',     img: 'p6', price: 34000, qty: 11, variant: '١٠٠ مل', summary: 'خشبي شرقي',
    desc: 'خشب الصندل والعود مع راتنجات دافئة، عطر رجالي شرقي بامتياز.' },
  { c: cGift,  name: 'طقم الهدايا الشرقي',    img: 'p3', price: 62000, qty: 0,  variant: '٣ قطع',  summary: 'علبة فاخرة',
    desc: 'ثلاث عطرات مختارة في علبة هدايا مبطّنة مع بطاقة إهداء، مناسب للمناسبات والأعياد.' },
];

const productIds = [];
for (const [i, p] of PRODUCTS.entries()) {
  productIds.push(await S1.insert('products', {
  category_id: p.c,
  name: p.name,
  summary: p.summary,
  description: p.desc,
  variant: p.variant,
  price: p.price,
  old_price: p.old ?? null,
  qty: p.qty,
  image: `/assets/img/${p.img}.jpg`,
  live: 1,
  sort: i + 1,
    created_at: ago(40 - i),
  }));
}

// ── معرض صور لأول منتجين (باقة بلس تسمح بأربع) ──────────
for (const [idx, extras] of [[0, ['p2', 'p5']], [6, ['p6', 'p3']]]) {
  for (const [i, img] of extras.entries()) {
    await S1.insert('product_images', {
      product_id: productIds[idx], url: `/assets/img/${img}.jpg`, sort: i + 1,
    });
  }
}

// ── طلبات واقعية عبر الحالات الأربع ──────────────────────
const ORDERS = [
  { name: 'أحمد الشرعبي',  phone: '771234567', status: 'wait', when: ago(0, 0.2), lines: [[0, 1], [3, 1]] },
  { name: 'هدى العزي',     phone: '733222111', status: 'wait', when: ago(0, 2),   lines: [[5, 1]] },
  { name: 'محمد الحداد',   phone: '777889900', status: 'wait', when: ago(0, 6),   lines: [[6, 1], [1, 1], [3, 1]] },
  { name: 'سمية القباطي',  phone: '712345678', status: 'ok',   when: ago(1),      lines: [[4, 1]] },
  { name: 'خالد المقطري',  phone: '770112233', status: 'done', when: ago(2),      lines: [[0, 1], [7, 1]] },
  { name: 'أروى الشامي',   phone: '735556677', status: 'done', when: ago(3),      lines: [[3, 1]] },
  { name: 'ياسر النهاري',  phone: '778001122', status: 'off',  when: ago(4),      lines: [[6, 1]] },
];

for (const o of ORDERS) {
  const items = o.lines.map(([idx, qty]) => {
    const p = PRODUCTS[idx];
    return { product_id: productIds[idx], name: p.name, variant: p.variant, price: p.price, qty };
  });
  const total = items.reduce((a, l) => a + l.price * l.qty, 0);
  const orderId = await S1.insert('orders', {
    ref: makeRef(), cust_name: o.name, cust_phone: o.phone,
    note: '', total, status: o.status, created_at: o.when,
  });
  for (const it of items) await S1.insert('order_items', { order_id: orderId, ...it });
}

// ── زيارات آخر ٧ أيام ────────────────────────────────────
const VISITS = [41, 58, 47, 72, 66, 89, 103];
for (const [i, count] of VISITS.entries()) {
  const day = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
  await db.prepare('INSERT INTO visits (store_id, day, count) VALUES (?,?,?)').run(s1, day, count);
}

// ═══ ٢. متجر ملابس (باقة مجانية، غير موثّق) ═══════════════
const m2 = await merchant('733445566', 'نورا');
const s2 = await store(m2, {
  slug: 'nura-boutique',
  name: 'نورا بوتيك',
  sector: 'fashion',
  tagline: 'أزياء نسائية عصرية',
  about: 'فساتين وعبايات بتصاميم حديثة، تفصيل وجاهز.',
  city: 'عدن',
  whatsapp: '733445566',
  hours: 'يومياً ١٠ص – ١٠م',
  color: '#2F5D50', color_deep: '#1E3E35',
  banner: '/assets/img/sectors/fashion.jpg',
  plan: 'basic', verified: 0,
});
const S2 = scope(s2);
const n1 = await S2.insert('categories', { name: 'فساتين', sort: 1 });
const n2 = await S2.insert('categories', { name: 'عبايات', sort: 2 });
for (const [i, [name, c, price, qty]] of [
  ['فستان سهرة مطرّز', n1, 45000, 5],
  ['فستان صيفي قطن',   n1, 18000, 12],
  ['عباية كلاسيك',     n2, 27000, 8],
].entries()) {
  await S2.insert('products', {
    category_id: c, name, price, qty, summary: '', description: '',
    variant: '', image: '', live: 1, sort: i + 1, created_at: ago(20 - i),
  });
}

// ═══ ٣. متجر برو — لعرض الطبقة الفاخرة وسكِن منتصف الليل ══
//
// كان هذا الموضع لـ«أطلس للإلكترونيات»، وحلّ محلّه «سيركل تك»
// بمواد التاجر الحقيقية. وما هنا هيكلٌ مختصر يكفي فحوص الخادم
// القديم: الكتالوج الكامل بصوره في `scripts/seed-circletech.mjs`،
// ويُشغَّل بعد هذه البذرة فيُحدِّث المتجر نفسه بالرابط.
const m4 = await merchant('712334455', 'سيركل تك');
const s4 = await store(m4, {
  slug: 'circletech',
  name: 'سيركل تك للإلكترونيات',
  sector: 'electronics',
  tagline: 'أجهزة أصلية بضمان الوكيل',
  about: 'وكلاء معتمدون لأجهزة الهاتف والحاسب والصوتيات. كل جهاز مختوم بضمان سنة، وصيانة داخلية في المعرض.',
  city: 'صنعاء',
  address: 'صنعاء — شارع الزبيري',
  whatsapp: '712334455',
  hours: 'السبت – الخميس: ٩ص – ١٠م',
  color: '#38C0D8', color_deep: '#12556E',
  banner: '/assets/img/sectors/electronics.jpg',
  showcase: '/assets/img/sectors/accessories.jpg',
  theme: 'midnight',
  plan: 'pro', verified: 1,
  delivery_fee: 2000, delivery_free_over: 80000,
  delivery_note: 'توصيل داخل صنعاء خلال ٢٤ ساعة',
});
const S4 = scope(s4);
const a1 = await S4.insert('categories', { name: 'هواتف', sort: 1 });
const a2 = await S4.insert('categories', { name: 'سماعات', sort: 2 });
const a3 = await S4.insert('categories', { name: 'إكسسوارات', sort: 3 });
for (const [i, [name, c, price, old, qty, variant, desc]] of [
  ['هاتف ذكي — ١٢٨ جيجا', a1, 285000, 320000, 6,  'شاشة ٦.٧ بوصة', 'شاشة أموليد ١٢٠ هرتز، بطارية ٥٠٠٠ ملي أمبير، وشحن سريع. مختوم بضمان الوكيل سنة كاملة.'],
  ['هاتف اقتصادي — ٦٤ جيجا', a1, 98000, 0, 14, 'بطارية ٦٠٠٠', 'بطارية ضخمة تكفي يومين استخداماً عادياً، مناسب للعمل الميداني.'],
  ['سماعة لاسلكية', a2, 42000, 52000, 9, 'عزل ضوضاء', 'عزل نشط للضوضاء مع ٣٠ ساعة تشغيل وعلبة شحن مغناطيسية.'],
  ['سماعة رأس استوديو', a2, 76000, 0, 3, 'سلكية', 'استجابة ترددية متوازنة للمونتاج والتسجيل، وسادات جلدية قابلة للاستبدال.'],
  ['شاحن سريع ٦٥ واط', a3, 15500, 19000, 22, 'ثلاثة منافذ', 'يشحن الحاسب والهاتف معاً، حماية من الحرارة الزائدة.'],
  ['حقيبة حاسب مقاومة للماء', a3, 21000, 0, 0, '١٥ بوصة', 'بطانة إسفنجية مزدوجة وجيب داخلي مبطّن للشاحن.'],
].entries()) {
  await S4.insert('products', {
    category_id: c, name, price, old_price: old || null, qty, variant,
    summary: variant, description: desc,
    image: `/assets/img/p${(i % 9) + 1}.jpg`,
    live: 1, sort: i + 1, created_at: ago(30 - i),
  });
}

// ═══ ٤. متجر موقوف + بلاغ (للوحة الإدارة) ════════════════
const m3 = await merchant('770998877', 'تاجر تجريبي');
const s3 = await store(m3, {
  slug: 'under-review',
  name: 'متجر تحت المراجعة',
  sector: 'other',
  city: 'تعز',
  whatsapp: '770998877',
  plan: 'basic', verified: 0, status: 'suspended',
});
await scope(s3).insert('reports', {
  reason: 'منتجات مضللة',
  detail: 'الصور المعروضة لا تطابق ما يُسلَّم فعلياً.',
  status: 'open', created_at: ago(1),
});

// ── طلبات خدمات مفتوحة ───────────────────────────────────
await S2.insert('service_requests', {
  kind: 'verify', contact: toE164('733445566'),
  detail: 'أرغب بتوثيق المتجر — لدي سجل تجاري.',
  status: 'open', created_at: ago(2),
});
await db.prepare('INSERT INTO service_requests (store_id, kind, contact, detail, status, created_at) VALUES (NULL,?,?,?,?,?)')
  .run('build', toE164('739112233'), 'أريد أن تنشئوا متجري — لدي ٤٠ منتجاً.', 'open', ago(1));

console.log(`
  ✔ تم بناء البيانات الأولية

    متجر ذو يزن للعطور  →  http://localhost:3001/yazan          (بلس · تصميم دافئ · موثّق · ٩ منتجات)
    نورا بوتيك           →  http://localhost:3001/nura-boutique  (مجانية · تصميم نقي · ٣ منتجات)
    سيركل تك             →  http://localhost:3001/circletech     (برو · تصميم فاخر · سكِن منتصف الليل)
    متجر تحت المراجعة    →  موقوف — يظهر في لوحة الإدارة مع بلاغ

    قارن الثلاثة جنباً إلى جنب: نفس المحرّك، وثلاث درجات تصميم.

    للدخول كتاجر: /login
      ٧٧٧٠٠٠٠٠٠  →  ذو يزن
      ٧٣٣٤٤٥٥٦٦  →  نورا
      ٧١٢٣٣٤٤٥٥  →  سيركل تك
    رمز التحقق يظهر في الصفحة وفي سجل الخادم (وضع التطوير).
`);
await db.close();
