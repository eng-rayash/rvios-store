// ═══════════════════════════════════════════════════════════
//  الموقع التسويقي (§٣.١) — الهدف الوحيد: تحويل الزائر لمسجّل
// ═══════════════════════════════════════════════════════════
import { $, $$, api, AR, escapeHtml, scopeTheme } from './app.js';

// ── الهيدر اللاصق ────────────────────────────────────────
const hdr = $('#hdr');
if (hdr) addEventListener('scroll', () => hdr.classList.toggle('stuck', scrollY > 20), { passive: true });

// ── الظهور التدريجي ──────────────────────────────────────
//  عناصر .rv تبدأ بـ opacity:0، فلو تعطّل المراقب لأي سبب
//  اختفت الصفحة كلها تحت الهيرو. لذلك شبكتا أمان:
//  ١) <noscript> في الصفحة يُظهر كل شيء بلا JS.
//  ٢) مؤقّت أدناه يكشف ما بقي مخفياً بعد ٣ ثوانٍ.
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .16, rootMargin: '0px 0px -60px' });

const reveal = (el) => { el.classList.add('in'); io.unobserve(el); };
$$('.rv').forEach((el) => io.observe(el));

/** تُستدعى بعد حقن أي عناصر .rv جديدة */
export function watchReveal(els) {
  els.forEach((el) => io.observe(el));
}

/**
 * الشبكة الأخيرة تنزع `rv` بدل أن تضيف `in`.
 * إضافة `in` تعتمد على انتقال CSS، وهو لا يتقدّم في تبويب
 * لا يُرسم — فتبقى الصفحة بيضاء رغم «كشفها». نزع الصنف
 * يعيد العناصر إلى حالتها الطبيعية بلا انتقال ولا انتظار.
 */
const dropReveal = () => $$('.rv').forEach((el) => el.classList.remove('rv', 'in'));

setTimeout(() => { io.disconnect(); dropReveal(); }, 3000);

// المراقب لا يعمل والتبويب مخفي — اكشف فوراً عند العودة إليه
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(() => $$('.rv:not(.in)').forEach(reveal), 400);
  }
});

// ── شريط تقدّم القراءة ───────────────────────────────────
const bar = $('#progress');
if (bar) {
  const paint = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener('scroll', paint, { passive: true });
  addEventListener('resize', paint, { passive: true });
  paint();
}

// ── حركة اللوحة المعلّقة ─────────────────────────────────
const sign = $('.sign');
if (sign && !matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(min-width: 900px)').matches) {
  addEventListener('mousemove', (e) => {
    const x = (e.clientX / innerWidth - .5) * 14;
    const y = (e.clientY / innerHeight - .5) * 8;
    sign.style.translate = `${x}px ${y}px`;
  }, { passive: true });
}

// ── قائمة الجوال ─────────────────────────────────────────
$('#burger')?.addEventListener('click', (e) => {
  const nav = $('.site-nav');
  const open = nav.style.display === 'flex';
  nav.style.cssText = open ? '' :
    'display:flex;position:absolute;top:100%;inset-inline:0;background:var(--paper);flex-direction:column;' +
    'gap:0;padding:14px 24px;border-bottom:1px solid var(--line);box-shadow:var(--shadow)';
  e.currentTarget.setAttribute('aria-expanded', String(!open));
});

// اختيار وجهة يغلق القائمة — وإلا بقيت مفتوحة فوق المحتوى
$('.site-nav')?.addEventListener('click', (e) => {
  if (!e.target.closest('a')) return;
  $('.site-nav').style.cssText = '';
  $('#burger')?.setAttribute('aria-expanded', 'false');
});

// ── ضوء يتبع المؤشر على بطاقات المزايا ───────────────────
const frow = $('.frow');
if (frow && matchMedia('(hover:hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  frow.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.fcard');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, { passive: true });
}

// ── احجز رابطك (الهيرو) ──────────────────────────────────
/**
 * الحقل يستدعي نفس نقطة الفحص التي تستخدمها صفحة الإعداد،
 * فما يراه الزائر هنا هو ما سيحصل عليه فعلاً. الحرفنة
 * العربية → اللاتينية تجري في الخادم (slug.js) — مصدر واحد
 * للحقيقة بدل نسخة تقريبية في الواجهة تتناقض معه لاحقاً.
 */
const claim = $('#claim');
if (claim) {
  const input = $('#claimName');
  const state = $('#claimState');
  let timer, seq = 0;

  const show = (kind, html) => { state.className = `claim-state ${kind}`; state.innerHTML = html; };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const raw = input.value.trim();
    if (!raw) { show('', ''); return; }
    show('wait', '<span class="sdot"></span>جارٍ الفحص…');

    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const res = await api.get('/api/slug/check?q=' + encodeURIComponent(raw));
        if (mine !== seq) return;                    // ردّ متأخّر لكتابة أقدم
        if (res.ok) show('ok', `<span class="sdot"></span>متاح: <b>rviosstore.com/${escapeHtml(res.slug)}</b>`);
        else show('no', `<span class="sdot"></span>${escapeHtml(res.reason)}${
          res.suggestion ? ` — جرّب <b>${escapeHtml(res.suggestion)}</b>` : ''}`);
      } catch {
        if (mine === seq) show('', '');              // تعذّر الفحص: لا نُخيف الزائر برسالة خطأ
      }
    }, 340);
  });

  claim.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    // الاسم يُمرَّر إلى الإعداد فيبدأ التاجر من حيث انتهى هنا
    location.href = raw ? `/onboarding?store=${encodeURIComponent(raw)}` : '/onboarding';
  });
}

// ── القطاعات ─────────────────────────────────────────────
const SECTORS = [
  { name: 'أزياء',         img: 'fashion',     alt: 'بليزر رجالي كلاسيكي' },
  { name: 'عطور',          img: 'perfumes',    alt: 'زجاجة عطر فاخرة' },
  { name: 'إلكترونيات',    img: 'electronics', alt: 'هواتف وحواسيب وسماعات' },
  { name: 'حلويات',        img: 'sweets',      alt: 'قطعة كيك شوكولاتة' },
  { name: 'إكسسوارات',     img: 'accessories', alt: 'ساعات وخواتم وأساور' },
  { name: 'مستلزمات منزل', img: 'home',        alt: 'أجهزة مطبخ منزلية' },
];

const trow = $('#trow');
if (trow) {
  // القسم أسفل الطيّة، فالصور تُحمّل كسولاً (§٥.٣)
  trow.innerHTML = SECTORS.map((s, i) => `
    <a class="tag rv" data-d="${(i % 6) + 1}" href="/sectors">
      <div class="str"></div>
      <div class="plate">
        <img src="/assets/img/sectors/${s.img}.png" alt="${s.alt}" loading="lazy" decoding="async" width="360" height="360">
      </div>
      <span>${s.name}</span>
    </a>`).join('');
  $$('.tag').forEach((el) => io.observe(el));
}

// ── متاجر حقيقية على المنصة ──────────────────────────────
const mtrack = $('#mtrack');
if (mtrack) {
  // نداء **واحد** يخدم الشريط واللوحة معاً. كانا ندائين
  // متطابقين، أي رحلة شبكة مهدورة على أهم صفحة وأبطأ اتصال.
  api.get('/api/showcase').then((stores) => {
    if (!stores.length) { mtrack.closest('.marq').hidden = true; return; }

    const card = (s) => `
      <a class="mcard" href="/${encodeURIComponent(s.slug)}">
        <span class="av" style="background:${escapeHtml(s.color)}">
          ${s.logo ? `<img src="${escapeHtml(s.logo)}" alt="">`
                   : escapeHtml(s.name.replace(/^(متجر|محل)\s+/, '').charAt(0))}
        </span>
        <span>
          <b>${escapeHtml(s.name)}${s.verified ? ' ✓' : ''}</b>
          <i>rviosstore.com/${escapeHtml(s.slug)}</i>
        </span>
      </a>`;

    // نكرّر القائمة مرتين ليبدو الشريط متصلاً
    const cards = stores.map(card).join('');
    mtrack.innerHTML = cards + cards;

    // اسم اللوحة في الهيرو يعرض متجراً حقيقياً إن وُجد
    const first = stores.find((s) => s.verified) ?? stores[0];
    if (first && $('#signName')) {
      $('#signName').textContent = first.name;
      $('#signSlug').textContent = first.slug;
    }

    // المشهد في الهيرو: الجهازان يعرضان **متجرين مختلفين**،
    // ولكلٍّ لوحته اللونية كاملة. هذا برهان بصري على أن اللون
    // يصبغ المتجر كله — يراه الزائر قبل أن يقرأ الجملة.
    dressDevice($('#devLaptop'), first, '#lapAv', '#lapName');
    dressDevice($('#devPhone'), stores.find((s) => s !== first) ?? first, '#phAv', '#phName');
  }).catch(() => { mtrack.closest('.marq').hidden = true; });
}

// ── الباقات ──────────────────────────────────────────────
const prow = $('#prow');
if (prow) {
  api.get('/api/plans').then((plans) => {
    prow.innerHTML = plans.map((p, i) => `
      <div class="pcard ${i === 1 ? 'feat' : ''} rv" data-d="${i + 1}">
        ${i === 1 ? '<div class="ptag">الأكثر اختياراً</div>' : '<div class="ptag">&nbsp;</div>'}
        <h3>${escapeHtml(p.name)}</h3>
        <div class="pdesc">${escapeHtml(p.desc)}</div>
        <div class="pnum">${p.price === 0 ? 'مجانية' : p.price === null ? '—' : AR(p.price)}
          ${p.price === null ? '<span> / شهرياً</span>' : p.price ? '<span> ر.ي / شهرياً</span>' : ''}</div>
        <ul>${p.features.map((f) => `<li>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E8B57" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>
          ${escapeHtml(f)}</li>`).join('')}</ul>
        <a href="/onboarding" class="pbtn">${p.price === 0 ? 'ابدأ مجاناً' : 'اطلب الباقة'}</a>
      </div>`).join('');
    $$('.pcard').forEach((el) => io.observe(el));
  }).catch(() => {});
}

/** يكسو جهازاً في مشهد الهيرو بمتجر حقيقي: اسمه وشعاره ولوحته */
function dressDevice(device, store, avSel, nameSel) {
  if (!device || !store) return;
  scopeTheme(device, store);                       // اللوحة كاملة على الجهاز

  const name = $(nameSel);
  if (name) name.textContent = store.name;

  const av = $(avSel);
  if (av) {
    av.innerHTML = store.logo
      ? `<img src="${escapeHtml(store.logo)}" alt="">`
      : escapeHtml(store.name.replace(/^(متجر|محل)s+/, '').charAt(0));
  }
}

// ── منظار المؤشر على المشهد ──────────────────────────────
//  يميل المشهد قليلاً مع المؤشر فيبدو مجسّماً. نفس شرط
//  اللوحة المعلّقة: مؤشر حقيقي، شاشة واسعة، وحركة مسموحة.
const fit = $('.scene-fit');
if (fit && matchMedia('(hover:hover)').matches
        && matchMedia('(min-width:900px)').matches
        && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const base = getComputedStyle(fit).transform;
  addEventListener('mousemove', (e) => {
    const x = (e.clientX / innerWidth - .5) * 16;
    const y = (e.clientY / innerHeight - .5) * 10;
    fit.style.translate = `${x}px ${y}px`;
  }, { passive: true });
}
