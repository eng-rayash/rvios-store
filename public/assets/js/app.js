// ═══════════════════════════════════════════════════════════
//  طبقة الوصول للبيانات + أدوات مشتركة
//  كل نداء شبكة في المشروع يمر من هنا — نقطة واحدة للتبديل.
// ═══════════════════════════════════════════════════════════

import { paletteFor, tierOf, skinOf } from './theme-core.js';

export { paletteFor, tierOf, skinOf, derivePalette, SKINS, TIERS, lch, hexToLch, onColor } from './theme-core.js';

export const $  = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/** أرقام عربية-هندية — لغة الواجهة (§٧.١) */
export const AR = (n) => Number(n ?? 0).toLocaleString('ar-EG');

/**
 * رمز العملة — حالة وحيدة تُضبط مرة عند تحميل المتجر.
 *
 * كان مكتوباً بالقيمة في اثنين وعشرين موضعاً، وكل موضع منها
 * قفلٌ يمني صامت: متجر في عمّان يعرض أسعاره بالريال اليمني ولا
 * شيء في الواجهة يشي بالخطأ حتى يدفع عميل. والافتراضي يبقى
 * `ر.ي` فلا يتغيّر شيء لمن لم يضبط دولته.
 */
let CURRENCY = 'ر.ي';
export const setCurrency = (sym) => { CURRENCY = sym || 'ر.ي'; };
export const currency = () => CURRENCY;
export const money = (n) => `${AR(n)} <span class="cur">${CURRENCY}</span>`;

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message); this.status = status; this.code = code;
  }
}

/**
 * المتجر النشط في هذا التبويب.
 * يُرسل كترويسة مع كل نداء، فيعمل تبويبان على متجرين مختلفين
 * بلا تعارض — الجلسة تحفظ الاختيار، والترويسة تتجاوزه لهذا التبويب.
 */
let activeStore = null;
export const setApiStore = (slugOrId) => { activeStore = slugOrId ? String(slugOrId) : null; };
export const getApiStore = () => activeStore;

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(activeStore ? { 'x-store': activeStore } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم — تحقق من اتصالك', 0, 'NETWORK');
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* رد غير JSON */ }

  if (!res.ok) {
    throw new ApiError(data?.error ?? `خطأ ${res.status}`, res.status, data?.code ?? '');
  }
  return data;
}

export const api = {
  get:   (p)    => request('GET', p),
  post:  (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del:   (p)    => request('DELETE', p),
};

// ── إشعار عابر ───────────────────────────────────────────
let toastEl;
export function toast(msg, kind = 'ok') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  const icon = kind === 'bad'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C8A45D" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
  toastEl.innerHTML = icon + escapeHtml(msg);
  toastEl.classList.toggle('bad', kind === 'bad');
  toastEl.classList.add('on');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('on'), 2800);
}

/** يغلّف أي زر بحالة تحميل ويعرض الخطأ تلقائياً */
export async function withBusy(btn, fn) {
  if (!btn) return fn();
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  try {
    return await fn();
  } catch (e) {
    toast(e.message, 'bad');
    throw e;
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ── حبس التركيز داخل نافذة (وصولية) ──────────────────────
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function trapFocus(panel, onClose) {
  const previous = document.activeElement;
  const first = panel.querySelector(FOCUSABLE);
  first?.focus();

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const firstEl = items[0], lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
  }

  function close() {
    document.removeEventListener('keydown', onKey, true);
    previous?.focus?.();
    onClose?.();
  }

  document.addEventListener('keydown', onKey, true);
  return close;
}

// ── تطبيق هوية المتجر (§٣.٦ طبقة الثيمات) ────────────────
/**
 * `full` تعني «اصبغ الصفحة كلها»: الأسطح والحدود والنصوص
 * والظلال، لا لون الأزرار فقط. تُستخدم في واجهة المتجر حيث
 * الهوية للتاجر. لوحة التاجر تمرّرها false فتبقى هوية RVIOS
 * على الكروم، ويظهر لون التاجر في المعاينة وحدها.
 */
export function applyTheme(store, { full = false, root = document.documentElement } = {}) {
  if (!store) return;
  const palette = paletteFor(store);
  const keep = full ? null
    : ['--shop', '--shop-deep', '--shop-lift', '--shop-rgb', '--on-shop', '--on-shop-deep', '--shop-text'];

  for (const [key, value] of Object.entries(palette)) {
    if (keep && !keep.includes(key)) continue;
    root.style.setProperty(key, value);
  }

  if (full && root === document.documentElement) {
    root.dataset.tier = tierOf(store.plan);
    root.dataset.skin = skinOf(store.theme).id;
    root.style.colorScheme = palette['--scheme'];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette['--shop']);
  }
  return palette;
}

/** يكتب اللوحة على عنصر واحد — للمعاينات داخل لوحة التاجر */
export function scopeTheme(el, store) {
  if (!el || !store) return;
  const palette = paletteFor(store);
  for (const [key, value] of Object.entries(palette)) el.style.setProperty(key, value);
  el.dataset.tier = tierOf(store.plan);
  el.dataset.skin = skinOf(store.theme).id;
  return palette;
}

// ── تخزين محلي آمن ───────────────────────────────────────
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* وضع التصفح الخاص */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* تجاهل */ }
  },
};

/**
 * بطاقة باقة واحدة — تستعملها الرئيسية و/pricing معاً.
 *
 * كانتا نسختين متطابقتين في ملفين، فحين تغيّر تصميم البطاقة
 * تحرّكت واحدة وبقيت الأخرى: صفحة الباقات ظهرت بلا حدود ولا
 * خلفية. قالب واحد يمنع تكرار ذلك.
 */
export function planCard(p, i, { reveal = false } = {}) {
  const featured = i === 1;
  return `
    <div class="pcard card-s${featured ? ' feat' : ''}${reveal ? ' rv' : ''}"${reveal ? ` data-d="${i + 1}"` : ''}>
      <div class="ptag">${featured ? 'الأكثر اختياراً' : '&nbsp;'}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="pdesc">${escapeHtml(p.desc)}</div>
      <div class="pnum">${p.price === 0 ? 'مجانية' : p.price === null ? '—' : AR(p.price)}${
        p.price === null ? '<span> / شهرياً</span>' : p.price ? '<span> ر.ي / شهرياً</span>' : ''}</div>
      <ul>${p.features.map((ft) => `<li>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>
        ${escapeHtml(ft)}</li>`).join('')}</ul>
      <a href="/onboarding" class="pbtn">${p.price === 0 ? 'ابدأ مجاناً' : 'اطلب الباقة'}</a>
    </div>`;
}

/** تاريخ مقروء بالعربية */
export function when(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1)    return 'الآن';
  if (mins < 60)   return `قبل ${AR(mins)} دقيقة`;
  if (mins < 1440) return `قبل ${AR(Math.round(mins / 60))} ساعة`;
  const days = Math.round(mins / 1440);
  if (days === 1)  return 'أمس';
  if (days < 30)   return `قبل ${AR(days)} يوم`;
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}
