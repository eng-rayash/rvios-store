// ═══════════════════════════════════════════════════════════
//  لوحة التاجر (§٣.٣)
//  مبدأ حاكم: أول مؤشر يراه التاجر هو الطلبات المنتظرة،
//  لأن سرعة رده هي عنق الزجاجة الحقيقي في تدفق واتساب.
// ═══════════════════════════════════════════════════════════
import {
  $, $$, api, AR, money, escapeHtml, toast, withBusy, trapFocus, applyTheme,
  scopeTheme, derivePalette, tierOf, when, setApiStore,
} from './app.js';

const STATES = {
  wait: ['b-wait', 'قيد التأكيد'], ok: ['b-ok', 'مؤكد'],
  done: ['b-done', 'مكتمل'],       off: ['b-off', 'ملغى'],
};
/** ألوان مقترحة — والتاجر حرّ في أي لون آخر عبر المنتقي */
const COLORS = [
  ['#9E2226', '#6E1519'], ['#2F5D50', '#1E3E35'], ['#1F4E79', '#143451'],
  ['#7A4B1E', '#513113'], ['#5B2A6E', '#3C1B49'], ['#A8641B', '#734512'],
  ['#2C2C2C', '#111111'], ['#8C1F4A', '#5E1432'], ['#0F766E', '#0A4F4A'],
  ['#B45309', '#7C3A06'],
];
const TIER_NAME = { clean: 'نقي', warm: 'دافئ', signature: 'فاخر' };
let SKINS = [];

let STORE = null, CATS = [], PRODUCTS = [], PLAN = null, CAPACITY = {};
let STORES = [], SLOTS = { owned: 1, slots: 1, free: 0 };
let draft = { images: [], variants: [] };  // تعديلات غير محفوظة (إعدادات + معرض المنتج + خياراته)
let editingId = null;
let closeSheet = null;
let orderFilter = 'all';

// ═══ إقلاع ═══════════════════════════════════════════════
boot();

async function boot() {
  let me;
  try { me = await api.get('/api/auth/me'); }
  catch { location.href = '/login'; return; }

  if (!me.authenticated) { location.href = '/login'; return; }
  if (!me.hasStore)      { location.href = '/onboarding'; return; }

  window.__merchantName = me.merchant.name;   // يُستخدم بعد تحميل المتجر
  await Promise.all([loadStore(), loadOverview(), loadProducts(), loadCats(), loadOrders(), loadPlan()]);
  await loadStoreList();
  wire();
}

async function loadStore() {
  const res = await api.get('/api/me/store');
  STORE = res.store; PLAN = res.plan; SKINS = res.skins ?? [];
  setApiStore(STORE.slug);          // كل نداء تالٍ يحمل المتجر النشط
  applyTheme(STORE);
  paintHeader();
  fillSettings();
}

/** يبني مبدّل المتاجر — يظهر فقط لمن يملك أكثر من متجر */
async function loadStoreList() {
  let data;
  try { data = await api.get('/api/me/stores'); } catch { return; }
  STORES = data.stores; SLOTS = data.slots;

  const many = STORES.length > 1;
  const canAdd = SLOTS.free > 0;
  $('#storePick').hidden = !many && !canAdd;
  if ($('#storePick').hidden) return;

  const avatar = (s) => s.logo
    ? `<img src="${escapeHtml(s.logo)}" alt="">`
    : escapeHtml(s.name.replace(/^(متجر|محل)\s+/, '').charAt(0) || 'م');

  $('#pickAv').innerHTML = avatar(STORE);
  $('#pickAv').style.background = STORE.color;
  $('#pickName').textContent = STORE.name;

  $('#pickList').innerHTML = STORES.map((s) => `
    <button role="option" aria-selected="${s.id === STORE.id}" data-pick="${escapeHtml(s.slug)}"
            class="${s.id === STORE.id ? 'on' : ''}">
      <span class="pav" style="background:${escapeHtml(s.color)}">${avatar(s)}</span>
      <span class="meta">
        <span>${escapeHtml(s.name)}</span>
        <small>rviosstore.com/${escapeHtml(s.slug)}</small>
      </span>
      ${s.id === STORE.id
        ? '<svg class="tick" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>'
        : ''}
    </button>`).join('')
    + (canAdd ? `<hr>
      <button class="add" data-newstore>
        <span class="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></span>
        <span class="meta"><span>أضف متجراً</span><small style="direction:rtl">لديك ${AR(SLOTS.free)} خانة شاغرة</small></span>
      </button>` : '');
}

/** يبدّل المتجر النشط ثم يعيد تحميل اللوحة كاملة */
async function switchStore(slug) {
  if (slug === STORE.slug) return closePicker();
  try {
    await api.post('/api/me/active-store', { store: slug });
    setApiStore(slug);
    closePicker();
    await Promise.all([loadStore(), loadOverview(), loadProducts(), loadCats(), loadOrders(), loadPlan()]);
    await loadStoreList();
    toast(`أنت الآن في ${STORE.name}`);
  } catch (err) { toast(err.message, 'bad'); }
}

function closePicker() {
  $('#pickList').hidden = true;
  $('#pickBtn').setAttribute('aria-expanded', 'false');
}

function paintHeader() {
  // اسم التاجر إن سجّله، وإلا اسم المتجر — لا نكرّر «صاحب المتجر» مرتين
  $('#ownerName').textContent = window.__merchantName || STORE.name;
  $('#slugView').textContent = STORE.slug;
  $('#shopLink').href = `/${STORE.slug}`;
  $('#planFoot').textContent = `باقة ${PLAN.name}`;
  $('#avatar').innerHTML = STORE.logo
    ? `<img src="${escapeHtml(STORE.logo)}" alt="">`
    : escapeHtml(STORE.name.replace(/^(متجر|محل)\s+/, '').charAt(0) || 'م');
}

// ═══ نظرة عامة ═══════════════════════════════════════════
async function loadOverview() {
  const d = await api.get('/api/me/overview');

  const icon = (p) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6259" stroke-width="1.8">${p}</svg>`;
  const kpis = [
    { hot: true, label: 'طلبات قيد التأكيد', value: d.kpis.pending,
      icon: icon('<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 2H2"/>') },
    { label: 'زيارات هذا الأسبوع', value: d.kpis.visits,
      icon: icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>') },
    { label: 'المنتجات المنشورة', value: d.kpis.products,
      icon: icon('<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>') },
    { label: 'مبيعات مؤكدة (الشهر)', value: d.kpis.confirmed, money: true,
      icon: icon('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>') },
  ];

  $('#kpis').innerHTML = kpis.map((k) => `
    <div class="kpi ${k.hot ? 'hot' : ''}">
      <small>${k.icon}${k.label}</small>
      <b>${k.money ? AR(k.value) : AR(k.value)}${k.money ? ' <span style="font-size:14px;font-family:var(--body);color:var(--soft)">ر.ي</span>' : ''}</b>
    </div>`).join('');

  $('#pendPill').hidden = !d.kpis.pending;
  $('#pendPill').textContent = AR(d.kpis.pending);

  drawChart(d.chart);

  const cap = d.capacity;
  $('#meter').innerHTML = `
    <h2 style="font-size:15px;font-weight:800">سعة باقة ${escapeHtml(PLAN.name)}</h2>
    <b>${escapeHtml(cap.label)}</b>
    <div class="bar"><i style="width:${cap.pct}%"></i></div>
    <div class="row"><span>${cap.max ? `بقي ${AR(cap.max - cap.used)} منتج` : 'غير محدود'}</span><span>${AR(cap.pct)}٪</span></div>
    ${cap.max && cap.pct >= 70
      ? `<button class="btn btn-fill btn-sm btn-block" style="margin-top:14px" data-go="plan">رقِّ باقتك</button>`
      : ''}`;

  $('#recent').innerHTML = d.recent.length
    ? d.recent.map((o) => orderRow(o, true)).join('')
    : `<div class="empty"><p>لا توجد طلبات بعد.<br>شارك رابط متجرك لتصلك أول الطلبات.</p></div>`;
}

function drawChart(rows) {
  const W = 560, H = 180, pad = 8;
  const max = Math.max(...rows.map((r) => Math.max(r.visits, r.orders * 8)), 10);
  const x = (i) => pad + (i * (W - pad * 2)) / (rows.length - 1);
  const y = (v) => H - (v / max) * (H - 20);

  const line = (key, mult, color, width) =>
    `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"
      points="${rows.map((r, i) => `${x(i)},${y(r[key] * mult)}`).join(' ')}"/>`;

  const area = `<polygon fill="url(#g)" points="${pad},${H} ${rows.map((r, i) => `${x(i)},${y(r.visits)}`).join(' ')} ${W - pad},${H}"/>`;

  $('#chart').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="الزيارات والطلبات خلال آخر سبعة أيام">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--shop)" stop-opacity=".18"/>
        <stop offset="100%" stop-color="var(--shop)" stop-opacity="0"/>
      </linearGradient></defs>
      ${area}
      ${line('visits', 1, 'var(--shop)', 2.4)}
      ${line('orders', 8, 'var(--brass)', 2)}
      ${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.visits)}" r="3" fill="var(--shop)"/>`).join('')}
    </svg>
    <div class="xlab">${rows.map((r) =>
      `<span>${new Date(r.day).toLocaleDateString('ar-EG', { weekday: 'short' })}</span>`).join('')}</div>
    <div style="display:flex;gap:16px;font-size:12px;color:var(--soft);margin-top:10px">
      <span style="display:flex;align-items:center;gap:6px"><i style="width:12px;height:2.5px;background:var(--shop);display:block"></i>الزيارات</span>
      <span style="display:flex;align-items:center;gap:6px"><i style="width:12px;height:2.5px;background:var(--brass);display:block"></i>الطلبات</span>
    </div>`;
}

// ═══ الطلبات ═════════════════════════════════════════════
function orderRow(o, compact) {
  const [cls, label] = STATES[o.status];
  const items = o.items?.map((i) => `${escapeHtml(i.name)} ×${AR(i.qty)}`).join(' · ') ?? '';
  const next = { wait: 'ok', ok: 'done' }[o.status];
  const nextLabel = { ok: 'تأكيد الطلب', done: 'إتمام الطلب' }[next];

  return `<div class="ord">
    <span class="ref">${escapeHtml(o.ref)}</span>
    <div class="cust">
      <b>${escapeHtml(o.cust_name || 'عميل')}</b>
      <small>${when(o.created_at)} · ${AR(o.items?.length ?? 0)} منتج</small>
    </div>
    <span class="badge ${cls}">${label}</span>
    <span class="amt">${AR(o.total)} <span style="font-family:var(--body);font-size:12px;color:var(--soft);font-weight:500">ر.ي</span></span>
    ${compact ? '' : `
      <a class="btn btn-wa btn-sm" href="${escapeHtml(o.wa ?? '#')}" target="_blank" rel="noopener">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5Z"/></svg>
        واتساب
      </a>
      ${next ? `<button class="btn btn-line btn-sm" data-adv="${o.id}" data-to="${next}">${nextLabel}</button>` : ''}
      ${o.status === 'wait' || o.status === 'ok'
        ? `<button class="btn btn-line btn-sm" data-adv="${o.id}" data-to="off" style="color:var(--danger)">إلغاء</button>` : ''}`}
    ${items && !compact ? `<div class="oitems">${items}</div>` : ''}
  </div>`;
}

/**
 * الطلبات تأتي مُرقَّمة من الخادم.
 * التصفية أيضاً على الخادم: لو صفّينا محلياً لعرضنا «المؤكَّدة»
 * من الصفحة الحالية فقط، فيظن التاجر أن لديه ٣ طلبات مؤكَّدة
 * بينما لديه ٤٠ — والعدد في التبويب يقول غير ذلك.
 */
let orderPage = 1;
let orderTotalPages = 1;

async function loadOrders({ page = 1, append = false } = {}) {
  const q = new URLSearchParams({ page: String(page) });
  if (orderFilter !== 'all') q.set('status', orderFilter);

  const d = await api.get(`/api/me/orders?${q}`);
  orderPage = d.page;
  orderTotalPages = d.pages;

  window.__orders = append ? [...(window.__orders ?? []), ...d.orders] : d.orders;

  $('#orderTabs').innerHTML = [
    ['all', 'الكل', Object.values(d.counts).reduce((a, n) => a + n, 0)],
    ...Object.entries(STATES).map(([k, v]) => [k, v[1], d.counts[k]]),
  ].map(([k, label, n]) =>
    `<button class="tab ${orderFilter === k ? 'on' : ''}" data-of="${k}">${label} (${AR(n)})</button>`).join('');

  paintOrders(d.total);
}

function paintOrders(total = window.__orders?.length ?? 0) {
  const list = window.__orders ?? [];

  if (!list.length) {
    $('#allorders').innerHTML = `<div class="empty"><p>لا توجد طلبات في هذه الحالة.</p></div>`;
    return;
  }

  const more = orderPage < orderTotalPages
    ? `<div class="more-wrap">
         <button class="btn ghost" id="moreOrders">عرض المزيد</button>
         <small>${AR(list.length)} من ${AR(total)}</small>
       </div>`
    : (total > list.length ? '' : `<div class="more-wrap"><small>${AR(total)} طلباً</small></div>`);

  $('#allorders').innerHTML = list.map((o) => orderRow(o, false)).join('') + more;
}

// ═══ المنتجات ════════════════════════════════════════════
async function loadProducts() {
  const d = await api.get('/api/me/products');
  PRODUCTS = d.products;
  CAPACITY = d.capacity;
  $('#capLabel').textContent = d.capacity.label;
  $('#addProduct').disabled = !d.capacity.canAdd;
  $('#addProduct').title = d.capacity.canAdd ? '' : 'بلغتَ حد باقتك';

  $('#prows').innerHTML = PRODUCTS.length ? PRODUCTS.map((p) => `
    <tr>
      <td><div class="pcell">
        <div class="pth">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy">`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DFD1B5" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m21 15-5-5L5 21"/></svg>`}</div>
        <div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.summary || '')}</small></div>
      </div></td>
      <td>${escapeHtml(p.categoryName || '—')}</td>
      <td><span class="money" style="font-size:19px">${AR(p.price)}</span> <span style="font-size:11.5px;color:var(--soft)">ر.ي</span></td>
      <td>${p.qty ? `${AR(p.qty)} قطعة` : '<span style="color:var(--danger);font-weight:700">نفد</span>'}</td>
      <td><span class="badge ${p.live ? 'b-ok' : 'b-off'}">${p.live ? 'منشور' : 'مخفي'}</span></td>
      <td><div class="acts-cell">
        <button class="ico" data-edit="${p.id}" aria-label="تعديل ${escapeHtml(p.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="ico dz" data-del="${p.id}" aria-label="حذف ${escapeHtml(p.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
      </div></td>
    </tr>`).join('')
    : `<tr><td colspan="6"><div class="empty"><p>لا منتجات بعد.<br>أضف أول منتج ليظهر متجرك للعملاء.</p></div></td></tr>`;
}

// ═══ التصنيفات ═══════════════════════════════════════════
async function loadCats() {
  CATS = await api.get('/api/me/categories');
  $('#crows').innerHTML = CATS.length ? CATS.map((c) => `
    <tr>
      <td><b style="font-size:13.5px">${escapeHtml(c.name)}</b></td>
      <td>${AR(c.count)} منتج</td>
      <td>${AR(c.sort)}</td>
      <td><div class="acts-cell">
        <button class="ico" data-cedit="${c.id}" aria-label="تعديل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="ico dz" data-cdel="${c.id}" aria-label="حذف"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
      </div></td>
    </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty"><p>لا تصنيفات بعد.<br>التصنيفات تساعد عملاءك على التصفح.</p></div></td></tr>`;
}

// ═══ الإعدادات ═══════════════════════════════════════════
function fillSettings() {
  $('#setName').value    = STORE.name;
  $('#setTagline').value = STORE.tagline;
  $('#setAbout').value   = STORE.about;
  $('#setSlug').value    = STORE.slug;
  $('#setWa').value      = STORE.whatsapp;
  $('#setCity').value    = STORE.city;
  $('#setAddress').value = STORE.address;
  $('#setHours').value   = STORE.hours;
  $('#setDelFee').value  = STORE.deliveryFee || '';
  $('#setDelFree').value = STORE.deliveryFreeOver || '';
  $('#setDelNote').value = STORE.deliveryNote || '';

  if (STORE.logo)     { $('#logoPrev').src = STORE.logo;       $('#logoPrev').hidden = false; }
  if (STORE.banner)   { $('#bannerPrev').src = STORE.banner;   $('#bannerPrev').hidden = false; }
  if (STORE.showcase) { $('#showPrev').src = STORE.showcase;   $('#showPrev').hidden = false; }

  const color = draft.color ?? STORE.color;
  $('#sws').innerHTML = COLORS.map(([c, d]) =>
    `<button class="sw ${c.toLowerCase() === color.toLowerCase() ? 'on' : ''}" type="button" style="background:${c}" data-c="${c}" data-d="${d}" aria-label="لون"></button>`).join('');
  $('#setColor').value = color;
  $('#setColorHex').value = color.toUpperCase();

  const tier = tierOf(STORE.plan);
  $('#tierBadge').innerHTML =
    `<span class="badge b-ok">تصميم ${escapeHtml(PLAN.design?.name ?? TIER_NAME[tier])}</span>`;

  paintSkins();

  $('#vBadge').innerHTML = STORE.verified
    ? '<span class="badge b-ok">موثّق</span>'
    : '<span class="badge b-done">غير موثّق</span>';

  $('#verifyBody').innerHTML = STORE.verified
    ? `<p style="font-size:13px;color:var(--soft);line-height:1.9">متجرك موثّق — تظهر الشارة لعملائك في واجهة المتجر، وهي إشارة ثقة تزيد إقبالهم على الشراء.</p>`
    : PLAN.canVerify
      ? `<p style="font-size:13px;color:var(--soft);line-height:1.9;margin-bottom:14px">التوثيق اختياري، ويمنح متجرك شارة «موثّق» تراها عملاؤك. نراجع الطلب يدوياً ونتواصل معك عبر واتساب.</p>
         <button class="btn btn-fill btn-sm" data-req="verify">اطلب التوثيق</button>`
      : `<p style="font-size:13px;color:var(--soft);line-height:1.9">شارة التوثيق متاحة في الباقات المدفوعة.
         <a href="#" data-go="plan" style="color:var(--shop);font-weight:700">قارن الباقات ←</a></p>`;

  updatePreview();
}

/**
 * السكِنات — الاختيار حكرٌ على برو (§٢.١ extraThemes).
 * غير المشترك يراها معطّلة لا مخفية: يعرف ما الذي يشتريه.
 */
function paintSkins() {
  const current = draft.theme ?? STORE.savedTheme ?? STORE.theme ?? 'signature';
  const locked = !PLAN.extraThemes;

  $('#skins').innerHTML = SKINS.map((s) => `
    <button type="button" class="skin ${s.id === current ? 'on' : ''}" data-skin="${escapeHtml(s.id)}"
            ${locked && s.id !== 'signature' ? 'disabled' : ''}>
      <span class="mini" data-mini="${escapeHtml(s.id)}">
        <i class="bar"></i><span class="row"><i></i><i></i></span>
      </span>
      <em>${escapeHtml(s.name)}</em>
      <small>${escapeHtml(s.desc)}</small>
    </button>`).join('');

  // معاينات السكِنات تُصبغ بلون التاجر الحالي لا بألوان ثابتة
  const palette = derivePalette(draft.color ?? STORE.color, { deep: draft.colorDeep ?? STORE.colorDeep });
  const dark = derivePalette(draft.color ?? STORE.color, { deep: draft.colorDeep ?? STORE.colorDeep, dark: true });
  $$('[data-mini]').forEach((el) => {
    const p = el.dataset.mini === 'midnight' ? dark : palette;
    for (const [k, v] of Object.entries(p)) el.style.setProperty(k, v);
    if (el.dataset.mini === 'editorial') el.style.setProperty('--sand', p['--paper']);
  });

  $('#skinHint').textContent = locked
    ? 'السكِنات الإضافية متاحة في باقة برو — متجرك يعرض «التوقيع».'
    : 'يُطبَّق على واجهة متجرك فور الحفظ.';
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * اختيار اللون — من عيّنة جاهزة أو من المنتقي.
 * حين لا تُمرَّر درجة غامقة نشتقّها في OKLab، فيبقى أي لون
 * يختاره التاجر متناسقاً مع بقية اللوحة بلا ضبط يدوي.
 */
function pickColor(color, deep) {
  if (!HEX6.test(color)) return;
  draft.color = color;
  draft.colorDeep = HEX6.test(deep ?? '') ? deep : derivePalette(color)['--shop-deep'];

  $$('.sw').forEach((s) => s.classList.toggle('on', s.dataset.c.toLowerCase() === color.toLowerCase()));
  $('#setColor').value = color;
  $('#setColorHex').value = color.toUpperCase();

  applyTheme({ color: draft.color, colorDeep: draft.colorDeep });   // كروم اللوحة: --shop فقط
  paintSkins();
  updatePreview();
}

function updatePreview() {
  const name = ($('#setName').value || STORE.name || 'متجرك').trim();
  const logo   = draft.logo ?? STORE.logo;
  const banner = draft.banner ?? STORE.banner;
  const letter = escapeHtml(name.replace(/^(متجر|محل)\s+/, '').charAt(0) || 'م');

  $('#pvName').textContent = name;
  $('#pvHeroName').textContent = name;
  $('#pvTag').textContent  = $('#setTagline').value;
  $('#pvSlug').textContent = $('#setSlug').value || STORE.slug;
  $('#pvAv').innerHTML = logo ? `<img src="${escapeHtml(logo)}" alt="">` : letter;

  $('#pvBanner').hidden = !banner;
  if (banner) $('#pvBanner').src = banner;
  $('#prev').classList.toggle('shot', !!banner);

  const show = draft.showcase ?? STORE.showcase;
  $('#pvShot').style.backgroundImage = show ? `url("${show.replace(/["\\]/g, '')}")` : '';

  // هنا يقع بيت القصيد: لوحة كاملة تُكتب على عنصر المعاينة
  // وحده، فيرى التاجر أثر لونه على المتجر لا على زر واحد.
  const preview = scopeTheme($('#prev'), {
    color: draft.color ?? STORE.color,
    colorDeep: draft.colorDeep ?? STORE.colorDeep,
    plan: STORE.plan,
    theme: PLAN.extraThemes ? (draft.theme ?? STORE.savedTheme ?? 'signature') : 'signature',
  });
  $('#pvTier').textContent = `طبقة ${TIER_NAME[tierOf(STORE.plan)]}`;
  return preview;
}

// ═══ الاشتراك والفوترة (§٥) ══════════════════════════════
let BILLING = null;
/** أسماء الباقات من الخادم — لا نسخة ثانية تتخلّف عن plans.js */
let PLANS_BY_ID = {};

const INV_STATUS = {
  unpaid:       ['b-wait', 'بانتظار الدفع'],
  under_review: ['b-ok',   'قيد المراجعة'],
  paid:         ['b-done', 'مدفوعة'],
  void:         ['b-off',  'ملغاة'],
};
const INV_KIND = {
  subscription: 'اشتراك',
  store_build:  'إنشاء متجر',
  domain:       'دومين مخصص',
  extra_store:  'خانة متجر إضافي',
};

/**
 * سعر الباقة بالريال من إعدادات المنصة.
 *
 * ملاحظة مهمة: `plans.js` تحمل `priceUsd` — وهو السعر
 * الاستراتيجي المرجعي بالدولار (بسبب ازدواج سعر الصرف).
 * أما ما يُفوتَر به التاجر فعلاً فيأتي من `platform_settings`،
 * وهو ما يجب أن تعرضه الواجهة دائماً.
 */
function priceLabel(planId) {
  const p = BILLING.prices?.[planId];
  if (p === 0) return 'مجانية دائماً';
  if (p === null || p === undefined) return 'السعر يُعلن قريباً';
  return `${AR(p)} ر.ي / شهرياً`;
}

async function loadPlan() {
  const [d, b] = await Promise.all([
    api.get('/api/me/plan'),
    api.get('/api/me/billing'),
  ]);
  BILLING = b;
  PLANS_BY_ID = Object.fromEntries(d.all.map((p) => [p.id, p.name]));

  const sub = b.subscription;
  const ends = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // حالة الاشتراك تُقرأ بلمحة: مهلة أو انتهاء يجب أن يُريا فوراً
  const state = sub.status === 'grace'
    ? `<span class="badge b-wait">في المهلة — ${AR(sub.graceDays)} أيام</span>`
    : sub.status === 'expired'
      ? '<span class="badge b-off">منتهٍ</span>'
      : sub.daysLeft !== null && sub.daysLeft <= 7
        ? `<span class="badge b-wait">يتبقى ${AR(sub.daysLeft)} يوم</span>`
        : '';

  $('#curPlan').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--display);font-size:34px;font-weight:700">
          باقة ${escapeHtml(d.current.name)} ${state}
        </div>
        <div style="font-size:13px;color:var(--soft)">
          ${escapeHtml(d.capacity.label)} · ${escapeHtml(d.current.desc)}
          ${ends ? ` · تتجدّد ${ends}` : ''}
        </div>
      </div>
      <div style="margin-inline-start:auto;font-size:13px;color:var(--soft)">
        ${priceLabel(d.current.id)}
      </div>
    </div>
    ${b.hidden > 0 ? `
      <div class="warnbox" style="margin-top:14px">
        <b>${AR(b.hidden)} من منتجاتك مخفية</b> عن العملاء لأنها تتجاوز حد باقتك الحالية.
        بياناتها سليمة ولم يُحذف شيء — تعود كلها فور الترقية.
      </div>` : ''}`;

  paintOpenInvoice();

  $('#planCards').innerHTML = d.all.map((p) => {
    const current = p.id === d.current.id;
    const price = BILLING.prices[p.id];          // بالريال، من إعدادات المنصة
    const priceKnown = price !== null && price !== undefined;
    return `
    <div class="plan ${current ? 'on' : ''}">
      ${current ? '<span class="tag">باقتك الحالية</span>' : ''}
      <h3>${escapeHtml(p.name)}</h3>
      <div class="pd">${escapeHtml(p.desc)}</div>
      <div class="num">${price === 0 ? 'مجانية' : !priceKnown ? '—' : AR(price)}
        ${price ? '<span> ر.ي / شهرياً</span>' : !priceKnown ? '<span> / شهرياً</span>' : ''}</div>
      <ul>${p.features.map((f) => `
        <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>${escapeHtml(f)}</li>`).join('')}</ul>
      ${current
        ? '<button class="btn btn-line btn-sm btn-block" disabled>باقتك الحالية</button>'
        : p.id === 'basic'
          ? ''
          : `<button class="btn btn-fill btn-sm btn-block" data-buy="subscription" data-plan="${p.id}"
                     ${priceKnown ? '' : 'disabled title="السعر لم يُعلن بعد"'}>
               ${priceKnown ? 'ترقية الآن' : 'قريباً'}
             </button>
             ${priceKnown ? `<button class="btn btn-line btn-sm btn-block" style="margin-top:7px"
                   data-buy="subscription" data-plan="${p.id}" data-months="12">
               سنوي — ${AR(b.yearlyMonthsFree)} شهرين مجاناً
             </button>` : ''}`}
    </div>`;
  }).join('');

  paintInvoiceLog();

  paintAddons(d);
}

/**
 * شاشة الدفع (§٧.٣).
 * المرجع بارز وقابل للنسخ: بدونه تستحيل مطابقة الحوالات
 * بالمبالغ عملياً حين تصل عشرات التحويلات المتقاربة.
 */
function paintOpenInvoice() {
  const box = $('#openInv');
  const inv = BILLING.invoices.find((i) => i.status === 'unpaid' || i.status === 'under_review');
  if (!inv) { box.hidden = true; return; }

  const reviewing = inv.status === 'under_review';
  const methods = BILLING.methods ?? [];

  box.hidden = false;
  box.className = 'card inv';
  box.innerHTML = `
    <div class="top">
      <span class="ref">${escapeHtml(inv.ref)}</span>
      <span class="badge ${INV_STATUS[inv.status][0]}">${INV_STATUS[inv.status][1]}</span>
      <span class="amt">${AR(inv.amount)}<span> ر.ي</span></span>
    </div>
    <div class="what">
      ${escapeHtml(INV_KIND[inv.kind] ?? inv.kind)}
      ${inv.plan ? ` · باقة ${escapeHtml(PLANS_BY_ID[inv.plan] ?? inv.plan)}` : ''}
      ${inv.months > 1 ? ` · ${AR(inv.months)} شهراً` : ''}
    </div>

    ${reviewing ? `
      <div class="warnbox" style="margin-top:16px">
        <b>وصلنا إيصالك وفُعّلت باقتك فوراً.</b>
        نراجعه خلال يوم عمل — لا حاجة لأي إجراء منك.
      </div>`
    : `
      <div class="paysteps">
        <div class="pstep">
          <span class="n"></span>
          <div>
            <h4>حوّل المبلغ</h4>
            ${methods.length
              ? methods.map((m) => `
                  <div class="methodbox">
                    <b>${escapeHtml(m.name)}</b>
                    <p>${escapeHtml(m.instructions)}</p>
                  </div>`).join('')
              : '<p>لم تُضبط وسائل التحويل بعد — تواصل معنا عبر واتساب.</p>'}
          </div>
        </div>

        <div class="pstep">
          <span class="n"></span>
          <div>
            <h4>اكتب هذا المرجع في خانة الملاحظات</h4>
            <div class="copyrow">
              <span class="v">${escapeHtml(inv.ref)}</span>
              <button class="btn btn-line btn-sm" data-copy="${escapeHtml(inv.ref)}">نسخ</button>
            </div>
            <div class="warnbox">
              مهم: بدون المرجع قد يتأخر تأكيد اشتراكك، لأننا لن نعرف صاحب الحوالة.
            </div>
          </div>
        </div>

        <div class="pstep">
          <span class="n"></span>
          <div>
            <h4>ارفع صورة الإيصال</h4>
            <p>تُفعَّل باقتك فور الرفع، ونراجع الإيصال لاحقاً.</p>
            <div class="drop" id="proofDrop" style="margin-top:9px">
              <img id="proofPrev" hidden alt="">
              <b>اختر صورة الإيصال</b><small>لقطة شاشة أو صورة من التطبيق</small>
            </div>
            <input type="file" id="proofFile" accept="image/*" hidden>
            <select id="proofMethod" style="margin-top:9px">
              ${methods.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('')}
            </select>
            <button class="btn btn-fill btn-block" id="sendProof" style="margin-top:9px" disabled
                    data-inv="${inv.id}">أرسل الإيصال وفعّل الباقة</button>
          </div>
        </div>
      </div>`}`;
}

function paintInvoiceLog() {
  const rows = BILLING.invoices;
  $('#invRows').innerHTML = rows.length ? rows.map((i) => `
    <tr>
      <td style="direction:ltr;font-family:var(--display);font-size:17px;color:var(--shop)">${escapeHtml(i.ref)}</td>
      <td>${escapeHtml(INV_KIND[i.kind] ?? i.kind)}${i.plan ? ` · ${escapeHtml(PLANS_BY_ID[i.plan] ?? i.plan)}` : ''}</td>
      <td><span class="money" style="font-size:18px">${AR(i.amount)}</span> <small style="color:var(--soft)">ر.ي</small></td>
      <td><span class="badge ${INV_STATUS[i.status][0]}">${INV_STATUS[i.status][1]}</span></td>
      <td style="color:var(--soft);font-size:12.5px">${when(i.created_at)}</td>
    </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty"><p>لا فواتير بعد.</p></div></td></tr>`;
}

/** ADDONS.id → نوع الفاتورة المقابل في الخادم */
const ADDON_KIND = { build: 'store_build', domain: 'domain', store: 'extra_store' };

function paintAddons(d) {
  const prices = BILLING.addons ?? {};
  $('#addons').innerHTML = d.addons.map((a) => {
    const kind = ADDON_KIND[a.id];
    const price = prices[kind];
    // ما لم يُعلن سعره يبقى طلب تواصل، فلا نَعِد بشراء لا يعمل
    return `
    <div class="addon">
      <div class="t"><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.desc)}</small></div>
      <span class="badge b-done">${price ? `${AR(price)} ر.ي` : escapeHtml(a.kind)}</span>
      ${price
        ? `<button class="btn btn-fill btn-sm" data-buy="${escapeHtml(kind)}">اشترِ الآن</button>`
        : `<button class="btn btn-line btn-sm" data-req="${escapeHtml(a.id)}">اطلب الخدمة</button>`}
    </div>`;
  }).join('');
}

// ═══ نافذة المنتج ════════════════════════════════════════
/** يرسم مصغّرات المعرض — الأولى غلاف، ويمكن حذفها أو ترقيتها */
function paintGallery() {
  const max = CAPACITY.imagesPerProduct ?? 1;
  $('#imgCap').textContent = max > 1
    ? `(${draft.images.length} من ${max})`
    : '(صورة واحدة في باقتك)';

  $('#pGallery').innerHTML = draft.images.map((url, i) => `
    <div class="gthumb ${i === 0 ? 'cover' : ''}">
      <img src="${escapeHtml(url)}" alt="">
      ${i === 0 ? '<span class="tag">الغلاف</span>'
                : `<button type="button" class="mk" data-cover="${i}" title="اجعلها الغلاف" aria-label="اجعلها الغلاف">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#241F1B" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
                   </button>`}
      <button type="button" class="del" data-rmimg="${i}" title="حذف" aria-label="حذف الصورة">×</button>
    </div>`).join('');

  $('#pImgDrop').hidden = draft.images.length >= max;
}

// ═══ خيارات المنتج ═══════════════════════════════════════
//  الشبكة تُرسل كاملة عند الحفظ، والخادم يستبدل بها ما كان.
//  الاستبدال — لا الدمج — هو ما يجعل حذف صفّ من الواجهة ممكناً.

/** الحدّ المسموح في الباقة؛ null يعني بلا حدّ */
const variantMax = () => CAPACITY.variantsPerProduct ?? null;

function paintVariants() {
  const on = $('#fHasVariants').checked;
  $('#vBody').hidden = !on;
  $('#vCount').hidden = !on;

  // الكمية أعلاه تصير مجموعاً محسوباً، فلا تُترك قابلة للتحرير
  const qty = $('#fQty');
  qty.disabled = on;
  qty.closest('.field').classList.toggle('is-derived', on);
  if (on) {
    const total = draft.variants.reduce((a, v) => a + (Number(v.qty) || 0), 0);
    qty.value = total;
    $('#vCount').textContent = `${AR(draft.variants.length)} خيار · المجموع ${AR(total)} قطعة`;
  }
  if (!on) return;

  const two = $('#fOpt2').value.trim();
  $('#vRows').classList.toggle('two', !!two);

  $('#vRows').innerHTML = draft.variants.map((v, i) => `
    <div class="vrow" data-i="${i}">
      <input type="text" data-v="v1" value="${escapeHtml(v.v1 ?? '')}"
             placeholder="${escapeHtml($('#fOpt1').value.trim() || 'القيمة')}" maxlength="40" aria-label="القيمة الأولى">
      ${two ? `<input type="text" data-v="v2" value="${escapeHtml(v.v2 ?? '')}"
             placeholder="${escapeHtml(two)}" maxlength="40" aria-label="القيمة الثانية">` : ''}
      <input type="number" data-v="qty" value="${Number(v.qty) || 0}" min="0" inputmode="numeric" aria-label="الكمية">
      <input type="number" data-v="price" value="${v.price ?? ''}" min="0" inputmode="numeric"
             placeholder="سعر المنتج" aria-label="سعر خاص">
      <button type="button" class="del" data-rmvar="${i}" title="حذف الخيار" aria-label="حذف الخيار">×</button>
    </div>`).join('');

  const max = variantMax();
  $('#vAdd').disabled = max !== null && draft.variants.length >= max;
  $('#vHint').textContent = max === null
    ? 'اترك حقل السعر فارغاً ليرث الخيارُ سعرَ المنتج.'
    : `اترك السعر فارغاً ليرث سعر المنتج · حدّ باقتك ${AR(max)} خيارات لكل منتج.`;
}

/** يقرأ الشبكة من الحقول إلى draft قبل أي إعادة رسم أو حفظ */
function readVariants() {
  $$('#vRows .vrow').forEach((row) => {
    const i = Number(row.dataset.i);
    const v = draft.variants[i];
    if (!v) return;
    row.querySelectorAll('[data-v]').forEach((input) => {
      const key = input.dataset.v;
      if (key === 'qty')        v.qty = Math.max(0, Number(input.value) || 0);
      else if (key === 'price') v.price = input.value === '' ? null : Math.max(0, Number(input.value) || 0);
      else                      v[key] = input.value;
    });
  });
}

function openSheet(product) {
  editingId = product?.id ?? null;
  $('#pSheetTitle').textContent = product ? 'تعديل المنتج' : 'منتج جديد';
  $('#fName').value    = product?.name ?? '';
  $('#fPrice').value   = product?.price ?? '';
  $('#fOld').value     = product?.old_price ?? '';
  $('#fQty').value     = product?.qty ?? 1;
  $('#fVariant').value = product?.variant ?? '';
  $('#fOpt1').value    = product?.opt1_name ?? '';
  $('#fOpt2').value    = product?.opt2_name ?? '';
  draft.variants = (product?.variants ?? []).map((v) => ({
    id: v.id, v1: v.v1, v2: v.v2, qty: v.qty, price: v.price,
  }));
  $('#fHasVariants').checked = !!product?.has_variants;
  paintVariants();
  $('#fSummary').value = product?.summary ?? '';
  $('#fDesc').value    = product?.description ?? '';
  $('#fLive').checked  = product ? !!product.live : true;

  draft.images = product?.images?.length ? [...product.images]
               : (product?.image ? [product.image] : []);
  paintGallery();

  $('#fCat').innerHTML = `<option value="">بدون تصنيف</option>` +
    CATS.map((c) => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

  $('#pSheet').classList.add('on');
  $('#veil').classList.add('on');
  closeSheet = trapFocus($('#pSheet'), () => {
    $('#pSheet').classList.remove('on');
    $('#veil').classList.remove('on');
    closeSheet = null;
  });
}

// ═══ صور ═════════════════════════════════════════════════
function readImage(file, maxSide = 900) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('الملف ليس صورة'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('الصورة أكبر من ٥ ميجابايت'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّرت قراءة الصورة')); };
    img.src = url;
  });
}

function wireDrop(dropId, fileId, prevId, onDone, maxSide) {
  $(`#${dropId}`).addEventListener('click', () => $(`#${fileId}`).click());
  $(`#${fileId}`).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await readImage(file, maxSide);
      $(`#${prevId}`).src = url;
      $(`#${prevId}`).hidden = false;
      onDone(url);
    } catch (err) { toast(err.message, 'bad'); }
  });
}

// ═══ الأحداث ═════════════════════════════════════════════
function wire() {
  const TITLES = { home: 'نظرة عامة', orders: 'الطلبات', products: 'المنتجات',
                   cats: 'التصنيفات', settings: 'إعدادات المتجر', plan: 'الاشتراك والفوترة' };

  function go(v) {
    $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
    $$('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    $('#ttl').textContent = TITLES[v];
    $('#side').classList.remove('open');
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', async (e) => {
    const nav  = e.target.closest('[data-v]');
    const jump = e.target.closest('[data-go]');
    const edit = e.target.closest('[data-edit]');
    const del  = e.target.closest('[data-del]');
    const cdel = e.target.closest('[data-cdel]');
    const cedit= e.target.closest('[data-cedit]');
    const adv  = e.target.closest('[data-adv]');
    const of   = e.target.closest('[data-of]');
    const more = e.target.closest('#moreOrders');
    const req  = e.target.closest('[data-req]');
    const sw   = e.target.closest('.sw');

    if (nav)  go(nav.dataset.v);
    if (jump) { e.preventDefault(); go(jump.dataset.go); }

    if (edit) openSheet(PRODUCTS.find((p) => p.id === Number(edit.dataset.edit)));

    if (del) {
      const p = PRODUCTS.find((x) => x.id === Number(del.dataset.del));
      if (!confirm(`حذف «${p.name}»؟ لا يمكن التراجع.`)) return;
      try { await api.del(`/api/me/products/${p.id}`); toast('حُذف المنتج'); await loadProducts(); await loadOverview(); }
      catch (err) { toast(err.message, 'bad'); }
    }

    if (cedit) {
      const c = CATS.find((x) => x.id === Number(cedit.dataset.cedit));
      const name = prompt('اسم التصنيف:', c.name);
      if (!name?.trim()) return;
      try { await api.patch(`/api/me/categories/${c.id}`, { name: name.trim() }); toast('حُدّث التصنيف'); await loadCats(); }
      catch (err) { toast(err.message, 'bad'); }
    }

    if (cdel) {
      const c = CATS.find((x) => x.id === Number(cdel.dataset.cdel));
      if (!confirm(`حذف تصنيف «${c.name}»؟ ستبقى منتجاته بلا تصنيف.`)) return;
      try { await api.del(`/api/me/categories/${c.id}`); toast('حُذف التصنيف'); await loadCats(); await loadProducts(); }
      catch (err) { toast(err.message, 'bad'); }
    }

    if (adv) {
      try {
        await api.patch(`/api/me/orders/${adv.dataset.adv}`, { status: adv.dataset.to });
        toast('حُدّثت حالة الطلب');
        await Promise.all([loadOrders(), loadOverview(), loadProducts()]);
      } catch (err) { toast(err.message, 'bad'); }
    }

    if (more) {
      more.disabled = true;
      more.textContent = 'جارٍ التحميل…';
      try { await loadOrders({ page: orderPage + 1, append: true }); }
      catch (err) { toast(err.message, 'bad'); paintOrders(); }
    }

    // تغيير التبويب يعيد التحميل من الصفحة الأولى — التصفية على الخادم
    if (of) {
      orderFilter = of.dataset.of;
      $$('[data-of]').forEach((t) => t.classList.toggle('on', t === of));
      try { await loadOrders({ page: 1 }); }
      catch (err) { toast(err.message, 'bad'); }
    }

    if (req) {
      const kind = req.dataset.req === 'upgrade' ? 'upgrade' : req.dataset.req;
      try {
        const res = await api.post('/api/me/requests', { kind, detail: req.dataset.plan ? `ترقية إلى ${req.dataset.plan}` : '' });
        toast(res.message);
      } catch (err) { toast(err.message, 'bad'); }
    }

    // ── الفوترة: إنشاء فاتورة ونسخ المرجع ──
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      await withBusy(buy, async () => {
        await api.post('/api/me/billing/invoices', {
          kind: buy.dataset.buy,
          plan: buy.dataset.plan ?? null,
          months: Number(buy.dataset.months) || 1,
        });
        await loadPlan();
        $('#openInv').scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('أُنشئت فاتورتك — اتبع خطوات التحويل');
      }).catch(() => {});
      return;
    }

    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); toast('نُسخ المرجع'); }
      catch { toast(copy.dataset.copy); }
      return;
    }

    if (e.target.closest('#proofDrop')) { $('#proofFile').click(); return; }

    const rmImg = e.target.closest('[data-rmimg]');
    const mkCover = e.target.closest('[data-cover]');
    if (rmImg) { draft.images.splice(Number(rmImg.dataset.rmimg), 1); paintGallery(); return; }
    if (mkCover) {
      const i = Number(mkCover.dataset.cover);
      draft.images.unshift(draft.images.splice(i, 1)[0]);   // الترقية إلى الغلاف
      paintGallery();
      return;
    }

    if (sw) { pickColor(sw.dataset.c, sw.dataset.d); return; }

    const skin = e.target.closest('[data-skin]');
    if (skin && !skin.disabled) {
      $$('.skin').forEach((s) => s.classList.toggle('on', s === skin));
      draft.theme = skin.dataset.skin;
      updatePreview();
    }
  });

  // ── مبدّل المتاجر ──
  $('#pickBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const list = $('#pickList');
    list.hidden = !list.hidden;
    $('#pickBtn').setAttribute('aria-expanded', String(!list.hidden));
  });

  document.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) return switchStore(pick.dataset.pick);
    if (e.target.closest('[data-newstore]')) { location.href = '/onboarding?new=1'; return; }
    if (!e.target.closest('.storepick')) closePicker();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

  // ── رفع إيصال الدفع ──
  //  العناصر تُبنى ديناميكياً، فنستمع على المستند لا عليها
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'proofFile') return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      draft.proof = await readImage(file, 1400);
      $('#proofPrev').src = draft.proof;
      $('#proofPrev').hidden = false;
      $('#sendProof').disabled = false;
    } catch (err) { toast(err.message, 'bad'); }
  });

  document.addEventListener('click', async (e) => {
    const send = e.target.closest('#sendProof');
    if (!send || !draft.proof) return;
    await withBusy(send, async () => {
      const res = await api.post(`/api/me/billing/invoices/${send.dataset.inv}/proof`, {
        method: $('#proofMethod')?.value ?? '',
        proof: draft.proof,
      });
      draft.proof = null;
      // الباقة تغيّرت فعلاً — نعيد تحميل كل ما يتأثر بحدودها
      await Promise.all([loadStore(), loadPlan(), loadProducts(), loadOverview()]);
      toast(res.message);
    }).catch(() => {});
  });

  $('#burger').addEventListener('click', () => $('#side').classList.toggle('open'));

  $('#addProduct').addEventListener('click', () => openSheet(null));
  $('#pCancel').addEventListener('click', () => closeSheet?.());
  $('#veil').addEventListener('click', () => closeSheet?.());

  // ── خيارات المنتج ──
  $('#fHasVariants').addEventListener('change', () => {
    // أول تفعيل يبدأ بصفّ واحد فارغ — شبكة فارغة تماماً تربك
    if ($('#fHasVariants').checked && !draft.variants.length) {
      draft.variants = [{ v1: '', v2: '', qty: 0, price: null }];
    }
    paintVariants();
  });

  $('#vAdd').addEventListener('click', () => {
    readVariants();
    const max = variantMax();
    if (max !== null && draft.variants.length >= max) return;
    draft.variants.push({ v1: '', v2: '', qty: 0, price: null });
    paintVariants();
    $('#vRows .vrow:last-child [data-v="v1"]')?.focus();
  });

  $('#vRows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rmvar]');
    if (!btn) return;
    readVariants();
    draft.variants.splice(Number(btn.dataset.rmvar), 1);
    paintVariants();
  });

  // المجموع يتحدّث مع الكتابة، فيرى التاجر أثر رقمه فوراً
  $('#vRows').addEventListener('input', (e) => {
    if (e.target.dataset.v !== 'qty') return;
    readVariants();
    const total = draft.variants.reduce((a, v) => a + (Number(v.qty) || 0), 0);
    $('#fQty').value = total;
    $('#vCount').textContent = `${AR(draft.variants.length)} خيار · المجموع ${AR(total)} قطعة`;
  });

  // تغيير اسم المحور الثاني يُظهر عموده أو يُخفيه
  $('#fOpt2').addEventListener('change', () => { readVariants(); paintVariants(); });
  $('#fOpt1').addEventListener('change', () => { readVariants(); paintVariants(); });

  $('#pSave').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    readVariants();
    const hasVariants = $('#fHasVariants').checked;
    const payload = {
      name: $('#fName').value.trim(),
      categoryId: Number($('#fCat').value) || 0,
      price: Number($('#fPrice').value) || 0,
      oldPrice: Number($('#fOld').value) || 0,
      qty: Number($('#fQty').value) || 0,
      variant: $('#fVariant').value.trim(),
      opt1Name: $('#fOpt1').value.trim(),
      opt2Name: $('#fOpt2').value.trim(),
      // مصفوفة فارغة تعني «ألغِ الخيارات» — والخادم يعيد qty
      // ليكون مصدر الحقيقة عندها
      variants: hasVariants
        ? draft.variants.filter((v) => (v.v1 ?? '').trim() || (v.v2 ?? '').trim())
        : [],
      summary: $('#fSummary').value.trim(),
      description: $('#fDesc').value.trim(),
      live: $('#fLive').checked,
      images: draft.images,        // الأولى تصبح الغلاف في الخادم
    };
    if (!payload.name) throw new Error('اسم المنتج مطلوب');
    if (hasVariants && !payload.variants.length) {
      throw new Error('أضف قيمة واحدة على الأقل، أو أزل علامة «لهذا المنتج خيارات»');
    }
    if (hasVariants && !payload.opt1Name) throw new Error('سمِّ الخيار الأول (مثل: المقاس)');

    if (editingId) await api.patch(`/api/me/products/${editingId}`, payload);
    else           await api.post('/api/me/products', payload);

    toast(editingId ? 'حُفظ المنتج' : 'أُضيف المنتج');
    closeSheet?.();
    await Promise.all([loadProducts(), loadCats(), loadOverview()]);
  }).catch(() => {}));

  $('#addCat').addEventListener('click', async () => {
    const name = prompt('اسم التصنيف الجديد:');
    if (!name?.trim()) return;
    try { await api.post('/api/me/categories', { name: name.trim() }); toast('أُضيف التصنيف'); await loadCats(); }
    catch (err) { toast(err.message, 'bad'); }
  });

  // ── الإعدادات ──
  ['setName', 'setTagline', 'setSlug'].forEach((id) =>
    $(`#${id}`).addEventListener('input', updatePreview));

  let slugTimer;
  $('#setSlug').addEventListener('input', () => {
    clearTimeout(slugTimer);
    const box = $('#slugState');
    const raw = $('#setSlug').value.trim();
    if (!raw || raw === STORE.slug) { box.textContent = ''; box.style.color = ''; return; }
    box.textContent = 'جارٍ الفحص…'; box.style.color = 'var(--soft)';
    slugTimer = setTimeout(async () => {
      try {
        const res = await api.get('/api/slug/check?q=' + encodeURIComponent(raw));
        box.textContent = res.ok ? 'الرابط متاح' : res.reason;
        box.style.color = res.ok ? 'var(--ok)' : 'var(--danger)';
      } catch (err) { box.textContent = err.message; box.style.color = 'var(--danger)'; }
    }, 320);
  });

  wireDrop('logoDrop',   'logoFile',   'logoPrev',   (u) => { draft.logo = u; updatePreview(); }, 400);
  wireDrop('bannerDrop', 'bannerFile', 'bannerPrev', (u) => { draft.banner = u; updatePreview(); }, 1600);
  wireDrop('showDrop',   'showFile',   'showPrev',   (u) => { draft.showcase = u; updatePreview(); }, 1400);

  // ── لون مخصص ──
  $('#setColor').addEventListener('input', (e) => pickColor(e.target.value));
  $('#setColorHex').addEventListener('input', (e) => {
    const v = e.target.value.trim().replace(/^(?!#)/, '#');
    if (HEX6.test(v)) pickColor(v);
  });

  // معرض المنتج: يقبل عدة ملفات دفعة واحدة ضمن حد الباقة
  $('#pImgDrop').addEventListener('click', () => $('#pImgFile').click());
  $('#pImgFile').addEventListener('change', async (e) => {
    const max = CAPACITY.imagesPerProduct ?? 1;
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    for (const file of files) {
      if (draft.images.length >= max) {
        toast(`باقتك تسمح بـ${AR(max)} صورة لكل منتج`, 'bad');
        break;
      }
      try { draft.images.push(await readImage(file, 900)); }
      catch (err) { toast(err.message, 'bad'); }
    }
    paintGallery();
  });

  $('#save').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const payload = {
      name: $('#setName').value.trim(),
      tagline: $('#setTagline').value.trim(),
      about: $('#setAbout').value.trim(),
      whatsapp: $('#setWa').value.trim(),
      city: $('#setCity').value.trim(),
      address: $('#setAddress').value.trim(),
      hours: $('#setHours').value.trim(),
      deliveryFee: Number($('#setDelFee').value) || 0,
      deliveryFreeOver: Number($('#setDelFree').value) || 0,
      deliveryNote: $('#setDelNote').value.trim(),
    };
    if ($('#setSlug').value.trim() !== STORE.slug) payload.slug = $('#setSlug').value.trim();
    if (draft.color)    { payload.color = draft.color; payload.colorDeep = draft.colorDeep; }
    if (draft.logo)     payload.logo = draft.logo;
    if (draft.banner)   payload.banner = draft.banner;
    if (draft.showcase) payload.showcase = draft.showcase;
    if (draft.theme && PLAN.extraThemes) payload.theme = draft.theme;

    const res = await api.patch('/api/me/store', payload);
    STORE = res.store;
    // حفظ الإعدادات يمسح مسوّدة الإعدادات وحدها. معرض المنتج
    // المفتوح وخياراته يبقيان — إسقاطهما هنا يفقد التاجر شبكة
    // مقاسات كتبها للتوّ بلا أي إشارة.
    draft = { images: draft.images ?? [], variants: draft.variants ?? [] };
    applyTheme(STORE);
    paintHeader();
    fillSettings();
    $('#saveHint').textContent = `آخر حفظ: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    toast('حُفظت التغييرات');
  }).catch(() => {}));

  $('#copyLink').addEventListener('click', async () => {
    const url = `${location.origin}/${STORE.slug}`;
    try { await navigator.clipboard.writeText(url); toast('نُسخ رابط المتجر'); }
    catch { toast(url); }
  });

  $('#logout').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    location.href = '/';
  });
}
