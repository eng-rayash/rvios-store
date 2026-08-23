// ═══════════════════════════════════════════════════════════
//  توليد HTML من الخادم لصفحات المتاجر
//
//  السبب الأول ليس محركات البحث بل **واتساب**: هو قناة
//  المشاركة الأساسية في المنصة، ولا يُنفّذ JavaScript. رابط
//  بلا وسوم Open Graph يظهر كنص أعرج بلا صورة ولا اسم متجر،
//  وهذا يُفقد الرابط نصف قيمته وهو جوهر المنتج (§١.٢).
//
//  الصفحة تبقى تفاعلية بالكامل بعد ذلك: JS يعيد بناء الشبكة
//  من الـ API. ما نحقنه هنا هو المحتوى الأولي والوسوم فقط.
// ═══════════════════════════════════════════════════════════
import { scope } from './tenancy.js';
import { derivePalette, paletteCss, tierOf, skinOf } from '../public/assets/js/theme-core.js';
import { effectiveTheme } from './routes/merchant.js';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const AR = (n) => Number(n ?? 0).toLocaleString('ar-EG');

/** يبني وسوم <head> ومحتوى أولياً لمتجر */
export function renderStore(html, store, origin) {
  const s = scope(store.id);
  const products = s.all('products', { live: 1 }, { order: 'sort, id DESC', limit: 12 });
  const count = s.count('products', { live: 1 });

  const title = `${store.name} — RVIOS Store`;
  const desc = store.tagline || store.about
    || `تسوّق من ${store.name}${store.city ? ` في ${store.city}` : ''} — ${AR(count)} منتجاً، والطلب عبر واتساب.`;

  const url = `${origin}/${store.slug}`;
  const image = store.banner || store.showcase || store.logo
    || products.find((p) => p.image)?.image || '/assets/img/logo.png';
  const absImage = image.startsWith('http') ? image : origin + image;

  // ── الهوية البصرية ──
  //  اللوحة كاملة تُحسب هنا وتُحقن في <style>: الصفحة تفتح
  //  بألوان التاجر من أول إطار، فلا تومض بألوان المنصة ثم
  //  تتبدّل حين يصل JS — والوميض على إنترنت بطيء يدوم ثوانٍ.
  const theme = effectiveTheme(store);
  const skin = skinOf(theme);
  const palette = derivePalette(store.color, { deep: store.color_deep, dark: skin.dark });

  // ── وسوم المشاركة والفهرسة ──
  const head = `
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RVIOS Store">
<meta property="og:locale" content="ar_YE">
<meta property="og:title" content="${esc(store.name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(absImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(store.name)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(absImage)}">
<meta property="og:image:alt" content="${esc(store.name)}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: store.name,
    description: desc,
    url,
    image: absImage,
    ...(store.city ? { address: { '@type': 'PostalAddress', addressLocality: store.city, addressCountry: 'YE' } } : {}),
    ...(store.whatsapp ? { telephone: `+967${store.whatsapp}` } : {}),
  })}</script>`;

  // ── محتوى أولي يقرأه الزاحف قبل تنفيذ JS ──
  //  يُستبدل بالكامل حين تعمل الواجهة، فلا ازدواج في العرض.
  const items = products.map((p) => `
    <article>
      <h3>${esc(p.name)}</h3>
      ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
      <p>${AR(p.price)} ريال يمني${p.qty > 0 ? '' : ' — نفد المخزون'}</p>
    </article>`).join('');

  const noscript = `
<div id="ssr">
  <h1>${esc(store.name)}</h1>
  <p>${esc(desc)}</p>
  ${store.city ? `<p>${esc(store.city)}</p>` : ''}
  <h2>المنتجات (${AR(count)})</h2>
  ${items}
</div>`;

  return html
    .replace('<title>جارٍ التحميل… | RVIOS Store</title>', `<title>${esc(title)}</title>`)
    .replace(
      '<meta name="description" content="متجر إلكتروني على منصة RVIOS Store">',
      `<meta name="description" content="${esc(desc)}">${head}`,
    )
    .replace('<meta name="theme-color" content="#9E2226">',
      `<meta name="theme-color" content="${esc(palette['--shop'])}">`)
    // الطبقة والسكِن على <html> قبل أي رسم: CSS وحده يعرف
    // كيف يبدو متجر برو بلا انتظار JavaScript
    .replace('<html lang="ar" dir="rtl" data-tier="clean" data-skin="signature">',
      `<html lang="ar" dir="rtl" data-tier="${esc(tierOf(store.plan))}" data-skin="${esc(skin.id)}">`)
    .replace('<div class="grid" id="grid"></div>', `<div class="grid" id="grid">${noscript}</div>`)
    // اللوحة الكاملة مبكراً فلا تومض الصفحة بألوان المنصة
    .replace('<body>', `<body><style>${paletteCss(palette)}</style>`);
}

/** خريطة الموقع — المتاجر النشطة فقط */
export function renderSitemap(stores, origin) {
  const urls = [
    { loc: `${origin}/`, pri: '1.0' },
    { loc: `${origin}/pricing`, pri: '0.8' },
    { loc: `${origin}/sectors`, pri: '0.7' },
    { loc: `${origin}/about`, pri: '0.6' },
    { loc: `${origin}/contact`, pri: '0.5' },
    { loc: `${origin}/legal`, pri: '0.3' },
    ...stores.map((s) => ({ loc: `${origin}/${s.slug}`, pri: '0.9', mod: s.created_at?.slice(0, 10) })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
}

export function renderRobots(origin) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /dashboard
Disallow: /onboarding
Disallow: /login

Sitemap: ${origin}/sitemap.xml
`;
}
