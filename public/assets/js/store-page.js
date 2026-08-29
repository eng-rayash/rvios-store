// ═══════════════════════════════════════════════════════════
//  واجهة المتجر — منطق الصفحة (§٣.٤)
//  البحث والفلترة والترقيم كلها في الخادم (§٥.٣): لا نُنزل
//  كتالوجاً كاملاً على إنترنت بطيء.
// ═══════════════════════════════════════════════════════════
import { $, $$, api, AR, money, escapeHtml, toast, withBusy, trapFocus, applyTheme, tierOf, store as ls, when } from './app.js';

const SLUG = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] ?? '');
const CART_KEY = `rvios.cart.${SLUG}`;
const FAV_KEY  = `rvios.favs.${SLUG}`;

let SHOP = null, DELIVERY = { fee: 0, freeOver: 0, note: '' }, CATS = [], TIER = 'clean';
let PRODUCTS = [], PAGE = 1, PAGES = 1, TOTAL = 0;
let cart = ls.get(CART_KEY, []);          // يبقى بعد العودة من واتساب
let favs = new Set(ls.get(FAV_KEY, []));
let closeOverlay = null, searchTimer = null;

const state = { cat: 0, q: '', sort: 'new', min: 0, max: 0, stock: false, sale: false };

const PRICE_BANDS = [
  { id: 'a', label: 'أقل من ٢٠ ألف', min: 0,     max: 20000 },
  { id: 'b', label: '٢٠ – ٤٠ ألف',   min: 20000, max: 40000 },
  { id: 'c', label: 'أكثر من ٤٠ ألف', min: 40000, max: 0 },
];

// ═══ تحميل ═══════════════════════════════════════════════
init();

async function init() {
  let data;
  try {
    data = await api.get(`/api/shop/${encodeURIComponent(SLUG)}`);
  } catch (e) {
    document.body.innerHTML = `<div class="empty" style="padding-top:22vh">
      <h1 style="font-family:var(--display);font-size:38px">${escapeHtml(e.message)}</h1>
      <p>تأكد من الرابط، أو <a href="/" style="color:var(--shop);font-weight:700">تصفّح المنصة</a>.</p></div>`;
    return;
  }

  SHOP = data.store;
  DELIVERY = data.delivery ?? DELIVERY;
  CATS = data.categories;
  absorb(data);

  // الهوية كاملة: أسطح وحدود ونصوص وظلال — لا لون الأزرار وحده
  applyTheme(SHOP, { full: true });
  TIER = tierOf(SHOP.plan);

  paintIdentity();
  paintTrust();
  paintStory();
  paintFilters();
  paintRail();
  render();
  drawCart();
  wire();
  wireChrome();

  api.post(`/api/shop/${encodeURIComponent(SLUG)}/visit`).catch(() => {});
  restoreTrackLink();

  const pid = new URLSearchParams(location.search).get('p');
  if (pid) openProduct(Number(pid));
}

function absorb(data) {
  PRODUCTS = data.products;
  PAGE = data.page; PAGES = data.pages; TOTAL = data.total;
}

const SECTORS = {
  perfumes: 'عطور وبخور', fashion: 'أزياء وملابس', beauty: 'تجميل وعناية',
  food: 'أطعمة وحلويات', electronics: 'إلكترونيات', home: 'مستلزمات منزل',
  accessories: 'إكسسوارات', kids: 'أطفال',
};

function paintIdentity() {
  document.title = `${SHOP.name} — RVIOS Store`;
  $('#shopName').textContent = SHOP.name;
  $('#heroTitle').textContent = SHOP.name;
  $('#heroTag').textContent = SHOP.tagline || '';
  $('#fName').textContent = SHOP.name;
  $('#fAbout').textContent = SHOP.about || SHOP.tagline || '';
  $('#hours').textContent = SHOP.hours || 'تواصل معنا في أي وقت';
  $('#verified').hidden = !SHOP.verified;

  // §٢.١ — برو يخفي شريط المنصة العلوي ويبقي سطر التذييل
  $('#plat').hidden = SHOP.plan === 'pro';

  const kicker = SECTORS[SHOP.sector] || (SHOP.city ? `متجر في ${SHOP.city}` : '');
  if (kicker) { $('#heroKicker').textContent = kicker; $('#heroKicker').hidden = false; }

  $('#logo').innerHTML = SHOP.logo
    ? `<img src="${escapeHtml(SHOP.logo)}" alt="">`
    : escapeHtml(SHOP.name.replace(/^(متجر|محل)\s+/, '').charAt(0) || '؟');

  // .shot تعني «للهيرو صورة»: النص يقلب إلى الفاتح فوق التعتيم
  if (SHOP.banner) { $('#heroImg').src = SHOP.banner; $('#heroBg').hidden = false; $('#hero').classList.add('shot'); }

  const meta = [];
  if (SHOP.verified) meta.push('✓ متجر موثّق');
  if (SHOP.city) meta.push(SHOP.city);
  if (DELIVERY.fee === 0) meta.push('توصيل مجاني');
  else if (DELIVERY.freeOver) meta.push(`توصيل مجاني فوق ${AR(DELIVERY.freeOver)} ر.ي`);
  $('#heroMeta').innerHTML = meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('');

  const wa = `https://wa.me/967${SHOP.whatsapp}`;
  $('#waDirect').href = wa;
  $('#fWa').href = wa;
  $('#heroWa').href = wa;
  $('#storyWa').href = wa;
  // نداء الفعل في الهيرو من الطبقة الدافئة فصاعداً
  $('#heroCta').hidden = TIER === 'clean';

  $('#fContact').innerHTML = [
    SHOP.whatsapp ? `<li>${escapeHtml(SHOP.whatsapp.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'))}</li>` : '',
    SHOP.address ? `<li>${escapeHtml(SHOP.address)}</li>` : (SHOP.city ? `<li>${escapeHtml(SHOP.city)}</li>` : ''),
    SHOP.hours ? `<li>${escapeHtml(SHOP.hours)}</li>` : '',
    DELIVERY.note ? `<li>${escapeHtml(DELIVERY.note)}</li>` : '',
  ].join('');

  $('#fSince').textContent = `انضم ${when(SHOP.createdAt)}`;
  $('#fTrack').href = `/track?s=${encodeURIComponent(SLUG)}`;
  $('#fCats').innerHTML = CATS.map((c) =>
    `<li><a href="#" data-c="${c.id}">${escapeHtml(c.name)}</a></li>`).join('');
}

function paintFilters() {
  $('#cats').innerHTML = [
    `<button class="fitem on" data-c="0">جميع المنتجات <span class="n">${AR(TOTAL)}</span></button>`,
    ...CATS.filter((c) => c.count > 0).map((c) =>
      `<button class="fitem" data-c="${c.id}">${escapeHtml(c.name)} <span class="n">${AR(c.count)}</span></button>`),
  ].join('');

  $('#prices').innerHTML = PRICE_BANDS.map((b) =>
    `<label class="chk"><input type="radio" name="band" data-band="${b.id}">${b.label}</label>`).join('')
    + `<label class="chk"><input type="radio" name="band" data-band="" checked>كل الأسعار</label>`;
}

/** شريط تصنيفات أفقي — أقصر طريق للتصفح على الجوال */
function paintRail() {
  if (TIER === 'clean' || !CATS.some((c) => c.count > 0)) return;
  $('#railIn').innerHTML = [
    `<button class="rpill on" data-c="0">كل المنتجات <span class="n">${AR(TOTAL)}</span></button>`,
    ...CATS.filter((c) => c.count > 0).map((c) =>
      `<button class="rpill" data-c="${c.id}">${escapeHtml(c.name)} <span class="n">${AR(c.count)}</span></button>`),
  ].join('');
  $('#rail').hidden = false;
}

const ICONS = {
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
  chat:  '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  box:   '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
};

const cell = (icon, title, sub) => `
  <div class="tcell">
    <span class="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS[icon]}</svg></span>
    <span><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></span>
  </div>`;

/**
 * شريط الثقة — حقائق المتجر لا وعوده.
 * كله مشتق من إعدادات التاجر الفعلية؛ لا نكتب «شحن سريع»
 * لمتجر لم يقل ذلك (§٣.٤ — مؤشرات صادقة لا زينة).
 */
function paintTrust() {
  if (TIER === 'clean') return;
  const cells = [
    DELIVERY.fee === 0
      ? cell('truck', 'توصيل مجاني', DELIVERY.note || 'يُتفق عليه مع التاجر')
      : cell('truck', `التوصيل ${AR(DELIVERY.fee)} ر.ي`,
             DELIVERY.freeOver ? `مجاني فوق ${AR(DELIVERY.freeOver)} ر.ي` : (DELIVERY.note || 'داخل المدينة')),
    cell('chat', 'الطلب عبر واتساب', 'تأكيد مباشر مع التاجر'),
    SHOP.verified
      ? cell('check', 'متجر موثّق', 'راجعت RVIOS هوية التاجر')
      : cell('box', `${AR(TOTAL)} منتجاً`, 'محدَّثة من التاجر مباشرة'),
    SHOP.hours ? cell('clock', 'أوقات العمل', SHOP.hours) : '',
  ].filter(Boolean);

  $('#trustIn').innerHTML = cells.join('');
  $('#trust').hidden = false;
}

/**
 * قسم «قصة المتجر» — هنا تعيش **صورة العرض** (showcase):
 * صورة ثانية غير الغلاف، تُظهر المحل أو الحرفة أو المنتجات
 * في سياقها. الغلاف يزيّن أعلى الصفحة، وهذه تحكي من التاجر.
 */
function paintStory() {
  const text = SHOP.about || SHOP.tagline || '';
  // القسم متاح لكل الباقات — الصورة هوية لا زينة. الطبقة
  // تغيّر شكله (إطار، ظل، ظهور تدريجي) لا وجوده.
  if (!SHOP.showcase && !text) {
    $('#navAbout').setAttribute('href', '#contact');
    return;
  }

  $('#storyTitle').textContent = SHOP.name;
  $('#storyText').textContent = text;

  if (SHOP.showcase) {
    $('#storyImg').src = SHOP.showcase;
    $('#storyImg').alt = `من داخل ${SHOP.name}`;
  } else {
    // بلا صورة عرض: القسم يبقى نصياً بعمود واحد بدل إطار فارغ
    $('.story-shot').remove();
    $('.story-in').style.gridTemplateColumns = '1fr';
  }

  if (SHOP.city) { $('#storyTag').textContent = SHOP.city; $('#storyTag').hidden = false; }

  const pts = [
    SHOP.address ? ['العنوان', SHOP.address] : null,
    SHOP.hours ? ['أوقات العمل', SHOP.hours] : null,
    DELIVERY.note ? ['التوصيل', DELIVERY.note] : null,
    ['على المنصة', `انضم ${when(SHOP.createdAt)}`],
  ].filter(Boolean);

  $('#storyPts').innerHTML = pts.map(([k, v]) => `
    <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>
      <span><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span></li>`).join('');

  $('.story').hidden = false;
}

// ═══ جلب من الخادم ═══════════════════════════════════════
function queryString(page = 1) {
  const p = new URLSearchParams();
  if (state.cat)   p.set('cat', state.cat);
  if (state.q)     p.set('q', state.q);
  if (state.sort)  p.set('sort', state.sort);
  if (state.min)   p.set('min', state.min);
  if (state.max)   p.set('max', state.max);
  if (state.stock) p.set('stock', '1');
  if (state.sale)  p.set('sale', '1');
  p.set('page', page);
  return p.toString();
}

async function load(page = 1, append = false) {
  const grid = $('#grid');
  if (!append) grid.setAttribute('aria-busy', 'true');
  try {
    const data = await api.get(`/api/shop/${encodeURIComponent(SLUG)}/products?${queryString(page)}`);
    if (append) { PRODUCTS = PRODUCTS.concat(data.products); PAGE = data.page; PAGES = data.pages; TOTAL = data.total; }
    else absorb(data);
    render(append);
  } catch (e) {
    toast(e.message, 'bad');
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

// ═══ عرض ═════════════════════════════════════════════════
function cardHtml(p) {
  const catName = CATS.find((c) => c.id === p.categoryId)?.name;
  const chip = p.qty <= 0 ? '<span class="chip gone">نفد</span>'
             : p.oldPrice ? '<span class="chip sale">خصم</span>'
             : catName ? `<span class="chip">${escapeHtml(catName)}</span>` : '';

  return `<article class="pcard">
    <div class="shot" data-open="${p.id}" role="button" tabindex="0" aria-label="عرض ${escapeHtml(p.name)}">
      ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">`
                : `<div class="ph"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
      ${chip}
      <button class="fav ${favs.has(p.id) ? 'on' : ''}" data-fav="${p.id}" aria-label="أضف للمفضلة" aria-pressed="${favs.has(p.id)}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#241F1B" stroke-width="1.9"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z"/></svg>
      </button>
      <div class="peek">عرض سريع</div>
    </div>
    <div class="info">
      <h3 data-open="${p.id}">${escapeHtml(p.name)}</h3>
      <div class="sub">${escapeHtml(p.summary || '')}${p.summary && p.variant ? '<span class="dot"></span>' : ''}${escapeHtml(p.variant || '')}</div>
      <div class="prow">
        <span class="p">${AR(p.price)}</span><span class="cur">ر.ي</span>
        ${p.oldPrice ? `<s>${AR(p.oldPrice)}</s>` : ''}
      </div>
      <div class="stock ${p.stock === 'ok' ? '' : p.stock}"><i></i>${escapeHtml(p.stockLabel)}</div>
      <div class="buy">
        <button class="add" data-add="${p.id}" ${p.qty <= 0 ? 'disabled' : ''}>
          ${p.qty <= 0 ? 'غير متوفر'
            : p.hasVariants ? 'اختر الخيار'
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 2H2"/></svg>أضف للسلة`}
        </button>
        <a class="wain" href="${escapeHtml(p.wa)}" target="_blank" rel="noopener" aria-label="اسأل عن ${escapeHtml(p.name)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5Z"/></svg>
        </a>
      </div>
    </div>
  </article>`;
}

function render() {
  const grid = $('#grid');
  $('#res').innerHTML = TOTAL
    ? `عرض <b>${AR(PRODUCTS.length)}</b> من ${AR(TOTAL)} منتج`
    : '';

  // يستبدل أيضاً المحتوى المولّد من الخادم عند أول رسم
  grid.innerHTML = PRODUCTS.length
    ? PRODUCTS.map(cardHtml).join('')
    : `<div class="empty" style="grid-column:1/-1">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#DFD1B5" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <p>لا توجد منتجات مطابقة.<br>جرّب تصنيفاً آخر أو أزل بعض الفلاتر.</p></div>`;

  reveal($$('#grid > .pcard'));

  const more = $('#more');
  if (more) more.remove();
  if (PAGE < PAGES) {
    grid.insertAdjacentHTML('afterend',
      `<div id="more" style="text-align:center;margin-top:28px">
        <button class="btn btn-line" id="loadMore">عرض المزيد (${AR(TOTAL - PRODUCTS.length)} متبقٍ)</button>
      </div>`);
  }
}

// ═══ السلة ═══════════════════════════════════════════════
const saveCart = () => ls.set(CART_KEY, cart);

/**
 * السلة تحفظ لقطة من المنتج، لأن المنتج قد لا يكون في الصفحة الحالية.
 * حين يكون للمنتج خيارات فالسطر يخصّ الخيار: مقاسان مختلفان من
 * القميص نفسه سطران بسعرَين ومخزونَين مستقلَّين.
 */
function addToCart(id, variantId = 0) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;

  // منتج بخيارات لا يُضاف من الشبكة — لا بدّ من اختيار أولاً
  if (p.hasVariants && !variantId) return openProduct(id);

  const v = variantId ? p.variants?.find((x) => x.id === variantId) : null;
  if (p.hasVariants && !v) return toast('اختر أحد الخيارات المتاحة', 'bad');

  const max = v ? v.qty : p.qty;
  if (max <= 0) return toast('نفد من المخزون', 'bad');

  const line = cart.find((l) => l.id === id && (l.variantId ?? 0) === variantId);
  if (line) {
    if (line.qty >= max) return toast(`لا يتوفر أكثر من ${AR(max)} من هذا الخيار`, 'bad');
    line.qty++;
  } else {
    cart.push({
      id, variantId, qty: 1, name: p.name,
      price: v ? v.price : p.price,
      image: p.image,
      variant: v ? v.label : p.variant,
      max,
    });
  }
  saveCart(); drawCart(); toast('أُضيف إلى السلة');
}

function cartTotals() {
  const subtotal = cart.reduce((a, l) => a + l.price * l.qty, 0);
  let delivery = DELIVERY.fee || 0;
  if (delivery && DELIVERY.freeOver && subtotal >= DELIVERY.freeOver) delivery = 0;
  return { subtotal, delivery, total: subtotal + delivery };
}

function drawCart() {
  const n = cart.reduce((s, l) => s + l.qty, 0);
  $('#badge').hidden = !n;
  $('#badge').textContent = AR(n);

  if (!cart.length) {
    $('#df').hidden = true;
    $('#db').innerHTML = `<div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#DFD1B5" stroke-width="1.4"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 2H2"/></svg>
      <p>سلتك فارغة.<br>تصفّح المنتجات وأضف ما يعجبك.</p></div>`;
    return;
  }

  $('#df').hidden = false;
  $('#db').innerHTML = cart.map((l) => `
    <div class="li">
      <div class="t">${l.image ? `<img src="${escapeHtml(l.image)}" alt="">` : ''}</div>
      <div class="b">
        <h4>${escapeHtml(l.name)}</h4>
        <div class="lp">${money(l.price * l.qty)}</div>
        <div class="qty">
          <button data-q="${l.id}" data-d="-1" aria-label="إنقاص الكمية">−</button>
          <span>${AR(l.qty)}</span>
          <button data-q="${l.id}" data-d="1" aria-label="زيادة الكمية">+</button>
        </div>
        <button class="rm" data-rm="${l.id}">إزالة</button>
      </div></div>`).join('');

  const t = cartTotals();
  $('#sub').innerHTML = money(t.subtotal);
  $('#tot').innerHTML = money(t.total);

  // سطر التوصيل يظهر فقط حين يكون له معنى
  const row = $('#delRow');
  if (row) row.remove();
  if (DELIVERY.fee > 0) {
    const label = t.delivery === 0
      ? '<span style="color:var(--ok);font-weight:700">مجاني</span>'
      : money(t.delivery);
    $('#sub').closest('.tr').insertAdjacentHTML('afterend',
      `<div class="tr" id="delRow"><span>التوصيل</span><span>${label}</span></div>`);
  }
}

/** شريط ثابت يعرض آخر طلب ورابط تتبّعه */
function showTrackLink(ref) {
  $('#trackBar')?.remove();
  const url = `/track?s=${encodeURIComponent(SLUG)}&ref=${encodeURIComponent(ref)}`;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="trackbar" id="trackBar">
      <span>طلبك <b>${escapeHtml(ref)}</b> مسجّل</span>
      <a href="${url}">تتبّع الطلب ←</a>
      <button aria-label="إخفاء" data-closetrack>×</button>
    </div>`);
}

/** يستعيد آخر طلب خلال ٧ أيام */
function restoreTrackLink() {
  const last = ls.get(`rvios.lastorder.${SLUG}`);
  if (last?.ref && Date.now() - last.at < 7 * 86400000) showTrackLink(last.ref);
  else if (last) ls.del(`rvios.lastorder.${SLUG}`);
}

// ═══ نافذة المنتج ════════════════════════════════════════
async function openProduct(id) {
  let p = PRODUCTS.find((x) => x.id === id);
  // المعرض لا يأتي مع الشبكة — نجلبه عند فتح المنتج
  if (!p || !p.images) {
    try {
      p = (await api.get(`/api/shop/${encodeURIComponent(SLUG)}/products/${id}`)).product;
      const i = PRODUCTS.findIndex((x) => x.id === id);
      if (i >= 0) PRODUCTS[i] = p;
    } catch { return toast('المنتج غير موجود', 'bad'); }
  }

  const gallery = p.images?.length ? p.images : (p.image ? [p.image] : []);
  const catName = CATS.find((c) => c.id === p.categoryId)?.name ?? '';
  $('#mg').innerHTML = `
    <div class="mv">
      ${gallery.length ? `<img src="${escapeHtml(gallery[0])}" alt="${escapeHtml(p.name)}" id="mainShot">` : ''}
      ${gallery.length > 1 ? `<div class="thumbs">${gallery.map((u, i) => `
        <button class="thumb ${i === 0 ? 'on' : ''}" data-shot="${escapeHtml(u)}" aria-label="صورة ${i + 1}">
          <img src="${escapeHtml(u)}" alt="" loading="lazy">
        </button>`).join('')}</div>` : ''}
    </div>
    <div class="mi">
      <div class="k">${escapeHtml(catName)}</div>
      <h2 id="mTitle">${escapeHtml(p.name)}</h2>
      <div class="mp">${AR(p.price)} <em>ر.ي</em>${p.oldPrice ? ` <s style="font-size:16px;color:var(--soft);font-family:var(--body);font-weight:400">${AR(p.oldPrice)}</s>` : ''}</div>
      <p>${escapeHtml(p.description || p.summary || '')}</p>
      <div class="spec">
        ${p.variant ? `<div><span>الحجم</span><b>${escapeHtml(p.variant)}</b></div>` : ''}
        ${p.summary ? `<div><span>الوصف</span><b>${escapeHtml(p.summary)}</b></div>` : ''}
        <div><span>التوفر</span><b style="color:${p.stock === 'ok' ? 'var(--ok)' : p.stock === 'low' ? 'var(--brass-deep)' : 'var(--soft)'}">${escapeHtml(p.stockLabel)}</b></div>
        ${DELIVERY.fee ? `<div><span>التوصيل</span><b>${AR(DELIVERY.fee)} ر.ي${DELIVERY.freeOver ? ` · مجاني فوق ${AR(DELIVERY.freeOver)}` : ''}</b></div>`
                       : '<div><span>التوصيل</span><b style="color:var(--ok)">مجاني</b></div>'}
      </div>
      ${p.hasVariants ? variantPicker(p) : ''}
      <div class="mact">
        <button class="add" data-add="${p.id}" ${p.qty <= 0 ? 'disabled' : ''}>${p.qty > 0 ? 'أضف للسلة' : 'غير متوفر'}</button>
        <a class="wain" href="${escapeHtml(p.wa)}" target="_blank" rel="noopener" aria-label="اسأل عن المنتج">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5Z"/></svg>
        </a>
        <button class="btn btn-line btn-sm" id="copyP">نسخ الرابط</button>
      </div>
    </div>`;

  if (!PRODUCTS.find((x) => x.id === id)) PRODUCTS.push(p);
  if (p.hasVariants) bindPicker(p);
  history.replaceState(null, '', `?p=${p.id}`);
  show($('#modal'));
}

// ═══ منتقي الخيارات ══════════════════════════════════════
//  محورا الخيارات يُعرضان كأزرار لا كقائمة منسدلة: العميل
//  يرى المتاح والنافد معاً في نظرة واحدة، والقائمة تُخفيه.

/** الخيار المطابق للاختيار الحالي على المحورين */
function matchVariant(p, sel) {
  return p.variants.find((v) =>
    (!p.axes.some((a) => a.key === 'v1') || v.v1 === sel.v1) &&
    (!p.axes.some((a) => a.key === 'v2') || v.v2 === sel.v2));
}

/** هل توجد قطعة متاحة واحدة على الأقل بهذه القيمة على هذا المحور؟ */
function valueAvailable(p, key, value, sel) {
  return p.variants.some((v) => {
    if (v[key] !== value) return false;
    const other = key === 'v1' ? 'v2' : 'v1';
    if (p.axes.some((a) => a.key === other) && sel[other] && v[other] !== sel[other]) return false;
    return v.qty > 0;
  });
}

function variantPicker(p) {
  return `<div class="vpick" id="vPick">
    ${p.axes.map((axis) => `
      <div class="vaxis" data-key="${axis.key}">
        <span class="vlab">${escapeHtml(axis.name || 'اختر')}</span>
        <div class="vopts">
          ${axis.values.map((val) => `
            <button type="button" class="vopt" data-key="${axis.key}" data-val="${escapeHtml(val)}">
              ${escapeHtml(val)}
            </button>`).join('')}
        </div>
      </div>`).join('')}
    <div class="vstate" id="vState" role="status" aria-live="polite"></div>
  </div>`;
}

function bindPicker(p) {
  const sel = { v1: '', v2: '' };
  const addBtn = $('#mg .mact .add');

  const paint = () => {
    $$('#vPick .vopt').forEach((b) => {
      const key = b.dataset.key, val = b.dataset.val;
      b.classList.toggle('on', sel[key] === val);
      const gone = !valueAvailable(p, key, val, sel);
      b.classList.toggle('out', gone);
      b.disabled = gone && sel[key] !== val;
    });

    const need = p.axes.filter((a) => !sel[a.key]);
    if (need.length) {
      $('#vState').textContent = `اختر ${need.map((a) => a.name || 'الخيار').join(' و')}`;
      addBtn.disabled = true;
      addBtn.textContent = 'أضف للسلة';
      addBtn.dataset.variant = '';
      return;
    }

    const v = matchVariant(p, sel);
    if (!v || v.qty <= 0) {
      $('#vState').textContent = 'هذا الخيار غير متوفر حالياً';
      addBtn.disabled = true;
      addBtn.textContent = 'غير متوفر';
      addBtn.dataset.variant = '';
      return;
    }

    // السعر قد يختلف بين الخيارات، فيتحدّث العنوان مع الاختيار
    $('#mg .mp').innerHTML = `${AR(v.price)} <em>ر.ي</em>`;
    $('#vState').textContent = v.qty <= 5
      ? `بقي ${AR(v.qty)} فقط من هذا الخيار`
      : 'متوفر';
    addBtn.disabled = false;
    addBtn.textContent = 'أضف للسلة';
    addBtn.dataset.variant = v.id;
  };

  $('#vPick').addEventListener('click', (e) => {
    const b = e.target.closest('.vopt');
    if (!b) return;
    // النقر على المحدَّد يلغيه، فيستطيع العميل التراجع
    sel[b.dataset.key] = sel[b.dataset.key] === b.dataset.val ? '' : b.dataset.val;
    paint();
  });

  paint();
}

function show(panel) {
  closeOverlay?.();
  panel.classList.add('on');
  $('#veil').classList.add('on');
  closeOverlay = trapFocus(panel, () => {
    panel.classList.remove('on');
    $('#veil').classList.remove('on');
    closeOverlay = null;
    if (panel.id === 'modal') history.replaceState(null, '', location.pathname);
  });
}

// ═══ صقل الواجهة (الطبقتان الأعلى) ═══════════════════════
//  كل ما هنا **تحسين**: لو لم يعمل JS أو فضّل المستخدم
//  تقليل الحركة، تبقى الصفحة كاملة ومقروءة بلا نقص.
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let revealObserver = null;
let observerAlive = false;   // هل ردّ المراقب ولو مرة؟
let revealDead = false;      // تخلّينا عن التأثير — نعرض كل شيء

/**
 * شبكة أمان: `.rv` تبدأ بشفافية صفر، فلو لم يعمل المراقب
 * لأي سبب (تبويب لا يُرسم، متصفح غريب، خطأ في طرف ثالث)
 * لبقيت المنتجات **خفية تماماً** — وهذا يعني متجراً بلا
 * بضاعة. بعد ثانية ونصف نتحقق: إن لم يردّ المراقب أسقطنا
 * التأثير كله وأظهرنا كل شيء. تصميم لطيف لا يستحق مخاطرة
 * إخفاء الكتالوج.
 */
function revealFallback() {
  if (observerAlive) return;
  revealDead = true;
  revealObserver?.disconnect();
  // نزع `rv` لا إضافة `in`: لا انتقال يُنتظر ولا شفافية تُحسب —
  // العناصر تعود إلى حالتها الطبيعية فوراً
  $$('.rv').forEach((el) => el.classList.remove('rv', 'in'));
}

/** ظهور تدريجي عند دخول العنصر إطار الشاشة */
function reveal(nodes) {
  if (TIER === 'clean' || CALM || revealDead || !('IntersectionObserver' in window)) return;
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries, obs) => {
      observerAlive = true;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    setTimeout(revealFallback, 1500);
  }

  [nodes].flat().forEach((el, i) => {
    if (!el || el.classList.contains('rv')) return;
    el.classList.add('rv');
    el.dataset.d = String((i % 4) + 1);
    revealObserver.observe(el);
  });
}

/** يوحّد اختيار التصنيف بين الشريط الجانبي والشريط الأفقي */
function selectCat(id) {
  state.cat = Number(id);
  $$('.fitem').forEach((b) => b.classList.toggle('on', Number(b.dataset.c) === state.cat));
  $$('.rpill').forEach((b) => b.classList.toggle('on', Number(b.dataset.c) === state.cat));
  return load(1);
}

function wireChrome() {
  // الهيدر يتقلّص عند النزول — بلا مستمع scroll يعمل كل إطار
  const sentinel = $('#hero');
  if ('IntersectionObserver' in window && sentinel) {
    new IntersectionObserver(([e]) => $('#hdr').classList.toggle('stuck', !e.isIntersecting),
      { rootMargin: '-70px 0px 0px 0px' }).observe(sentinel);
  }

  reveal([...$$('.tcell'), $('.story-shot'), $('.story-txt'), $('.wabox')].filter(Boolean));

  // شريط التصنيفات الأفقي
  $('#railIn').addEventListener('click', async (e) => {
    const pill = e.target.closest('.rpill');
    if (!pill) return;
    await selectCat(pill.dataset.c);
    $('.grid').scrollIntoView({ behavior: CALM ? 'auto' : 'smooth', block: 'start' });
  });

  // روابط الهيدر: «كل المنتجات» و«العروض» تعملان كفلترين
  $$('.hnav a[data-cat],.hnav a[data-filter]').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      $$('.hnav a').forEach((x) => x.classList.toggle('on', x === a));
      // الرابطان يبدآن من الصفر: «العروض» تعني عروض المتجر كله
      // لا عروض التصنيف الذي صادف أن العميل كان يتصفّحه
      state.sale = a.dataset.filter === 'sale';
      $('#onSale').checked = state.sale;
      await selectCat(0);
      $('.grid').scrollIntoView({ behavior: CALM ? 'auto' : 'smooth', block: 'start' });
    });
  });

  // ضوء يتبع المؤشر على بطاقات الطبقة الفاخرة
  if (TIER === 'signature' && !CALM && matchMedia('(hover:hover)').matches) {
    $('#grid').addEventListener('pointermove', (e) => {
      const card = e.target.closest('.pcard');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }
}

// ═══ الأحداث ═════════════════════════════════════════════
function wire() {
  document.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    const open = e.target.closest('[data-open]');
    const fav = e.target.closest('[data-fav]');
    const qb = e.target.closest('[data-q]');
    const rm = e.target.closest('[data-rm]');
    const fi = e.target.closest('.fitem');
    const fc = e.target.closest('[data-c]');

    if (e.target.closest('[data-closetrack]')) {
      $('#trackBar').remove();
      ls.del(`rvios.lastorder.${SLUG}`);
      return;
    }

    // تبديل صورة المعرض
    const thumb = e.target.closest('[data-shot]');
    if (thumb) {
      $('#mainShot').src = thumb.dataset.shot;
      $$('.thumb').forEach((b) => b.classList.toggle('on', b === thumb));
      return;
    }

    if (e.target.closest('#loadMore')) { load(PAGE + 1, true); return; }
    if (add) {
      // زر النافذة يحمل الخيار المختار؛ زر البطاقة لا يحمل شيئاً
      const variantId = Number(add.dataset.variant) || 0;
      const opened = $('#modal').classList.contains('on');
      addToCart(Number(add.dataset.add), variantId);
      // لا نغلق النافذة إن كان النقر هو ما فتحها للتوّ لاختيار خيار
      if (opened) closeOverlay?.();
      return;
    }
    if (open) { openProduct(Number(open.dataset.open)); return; }

    if (fav) {
      const id = Number(fav.dataset.fav);
      favs.has(id) ? favs.delete(id) : favs.add(id);
      ls.set(FAV_KEY, [...favs]);
      render();
      return;
    }
    if (qb) {
      const line = cart.find((l) => l.id === Number(qb.dataset.q));
      line.qty += Number(qb.dataset.d);
      if (line.max && line.qty > line.max) { line.qty = line.max; toast(`لا يتوفر أكثر من ${AR(line.max)}`, 'bad'); }
      if (line.qty < 1) cart = cart.filter((l) => l.id !== line.id);
      saveCart(); drawCart();
      return;
    }
    if (rm) { cart = cart.filter((l) => l.id !== Number(rm.dataset.rm)); saveCart(); drawCart(); return; }

    if (fi) { selectCat(fi.dataset.c); return; }
    if (fc && fc.tagName === 'A') {
      e.preventDefault();
      await selectCat(fc.dataset.c);
      $('.grid').scrollIntoView({ behavior: CALM ? 'auto' : 'smooth', block: 'start' });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const shot = e.target.closest('.shot[data-open]');
    if (shot) { e.preventDefault(); openProduct(Number(shot.dataset.open)); }
  });

  $('#q').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    state.q = e.target.value.trim();
    searchTimer = setTimeout(() => load(1), 300);
  });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; load(1); });
  $('#inStock').addEventListener('change', (e) => { state.stock = e.target.checked; load(1); });
  $('#onSale').addEventListener('change', (e) => { state.sale = e.target.checked; load(1); });
  $('#prices').addEventListener('change', (e) => {
    const band = PRICE_BANDS.find((b) => b.id === e.target.dataset.band);
    state.min = band?.min ?? 0;
    state.max = band?.max ?? 0;
    load(1);
  });
  $('#fToggle').addEventListener('click', () => $('#filters').classList.toggle('open'));

  $('#openCart').addEventListener('click', () => show($('#drawer')));
  $('#closeCart').addEventListener('click', () => closeOverlay?.());
  $('#closeModal').addEventListener('click', () => closeOverlay?.());
  $('#veil').addEventListener('click', () => closeOverlay?.());

  $('#share').addEventListener('click', async () => {
    const url = location.origin + '/' + SLUG;
    if (navigator.share) { try { await navigator.share({ title: SHOP.name, url }); return; } catch { /* أُلغيت */ } }
    try { await navigator.clipboard.writeText(url); toast('نُسخ رابط المتجر'); }
    catch { toast(url); }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.id !== 'copyP') return;
    try { await navigator.clipboard.writeText(location.href); toast('نُسخ رابط المنتج'); }
    catch { toast(location.href); }
  });

  // ═══ تأكيد الطلب (§٤.١) ═══════════════════════════════
  $('#waBtn').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const res = await api.post(`/api/shop/${encodeURIComponent(SLUG)}/orders`, {
      lines: cart.map((l) => ({ id: l.id, variantId: l.variantId ?? 0, qty: l.qty })),
      name: $('#cName').value.trim(),
      address: $('#cAddress')?.value.trim() ?? '',
      note: $('#cNote').value.trim(),
    });

    cart = []; saveCart(); drawCart(); closeOverlay?.();

    // نحفظ آخر طلب ليجد العميل رابط تتبّعه حين يعود
    ls.set(`rvios.lastorder.${SLUG}`, { ref: res.ref, at: Date.now() });
    showTrackLink(res.ref);

    toast(res.message);
    window.open(res.wa, '_blank', 'noopener');
    load(PAGE);           // المخزون تغيّر بعد الحجز
  }).catch(() => {}));

  // ═══ الإبلاغ (§٦.٢) ═══════════════════════════════════
  $('#reportBtn').addEventListener('click', async () => {
    const reason = prompt('سبب البلاغ عن هذا المتجر:\n(منتجات مضللة · لم يستلم الطلب · محتوى مخالف · أخرى)');
    if (!reason?.trim()) return;
    try {
      const res = await api.post(`/api/shop/${encodeURIComponent(SLUG)}/report`, { reason: reason.trim() });
      toast(res.message);
    } catch (err) { toast(err.message, 'bad'); }
  });
}
