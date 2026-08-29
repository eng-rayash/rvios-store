// ═══════════════════════════════════════════════════════════
//  تدفق التسجيل والإعداد (§٣.٢)
//  الهدف: أقصر مسافة بين «لا شيء» و«رابط قابل للمشاركة».
// ═══════════════════════════════════════════════════════════
import { $, $$, api, toast, withBusy, escapeHtml, applyTheme, scopeTheme, derivePalette } from './app.js';

/** ‏?new=1 يعني «أضف متجراً» لتاجر مسجّل، لا تسجيلاً جديداً */
const ADDING = new URLSearchParams(location.search).get('new') === '1';

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
let step = 0;
const data = { phone: '', name: '', slug: '', sector: '', city: '', tagline: '', logo: '', color: '#9E2226', colorDeep: '#6E1519', product: {} };

const SECTORS = [
  { id: 'perfumes',   name: 'عطور وبخور',  icon: 'M9 2h6v3H9zM7 5h10l1 15H6z' },
  { id: 'fashion',    name: 'أزياء وملابس', icon: 'M12 3 8 5 3 8l3 4 2-1v8h8v-8l2 1 3-4-5-3-4-2z' },
  { id: 'beauty',     name: 'تجميل وعناية', icon: 'M12 2a5 5 0 0 1 5 5c0 3-5 13-5 13S7 10 7 7a5 5 0 0 1 5-5z' },
  { id: 'food',       name: 'أطعمة وحلويات', icon: 'M4 4h16v6a8 8 0 0 1-16 0zM4 20h16' },
  { id: 'electronics',name: 'إلكترونيات',  icon: 'M4 5h16v11H4zM9 20h6M12 16v4' },
  { id: 'home',       name: 'مستلزمات منزل', icon: 'm3 11 9-8 9 8M6 10v10h12V10' },
  { id: 'accessories',name: 'إكسسوارات',   icon: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM8 12l-3 9 7-4 7 4-3-9' },
  { id: 'kids',       name: 'أطفال',        icon: 'M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6 21v-4a6 6 0 0 1 12 0v4' },
  { id: 'other',      name: 'أخرى',         icon: 'M4 6h16M4 12h16M4 18h16' },
];

const COLORS = [
  ['#9E2226', '#6E1519'], ['#2F5D50', '#1E3E35'], ['#1F4E79', '#143451'],
  ['#7A4B1E', '#513113'], ['#5B2A6E', '#3C1B49'], ['#A8641B', '#734512'],
  ['#2C2C2C', '#111111'], ['#8C1F4A', '#5E1432'],
];

// ═══ تنقل ════════════════════════════════════════════════
function goto(id) {
  step = STEPS.indexOf(id);
  $$('.step').forEach((s) => s.classList.toggle('on', s.id === id));
  paintBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $(`#${id}`).querySelector('input, button')?.focus();
}

function paintBar() {
  $('#bar').innerHTML = STEPS.slice(0, 6).map((_, i) =>
    `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
}

// ═══ معاينة حية ══════════════════════════════════════════
function preview() {
  const name = data.name.trim() || 'متجرك';
  $('#pvName').textContent = name;
  $('#pvTag').textContent = data.tagline;
  $('#pvSlug').textContent = data.slug || 'yourstore';
  // تُسقط البادئة فقط حين يتبعها اسم فعلي («متجر سارة» → س، بينما «متجرك» → م)
  $('#pvAv').innerHTML = data.logo
    ? `<img src="${escapeHtml(data.logo)}" alt="">`
    : escapeHtml(name.replace(/^(متجر|محل)\s+/, '').charAt(0) || 'م');
  // الكروم يأخذ لون التاجر، وبطاقة المعاينة تأخذ اللوحة كاملة
  applyTheme({ color: data.color, colorDeep: data.colorDeep });
  scopeTheme($('.plaque'), { color: data.color, colorDeep: data.colorDeep });
}

// ═══ ١. الجوال ═══════════════════════════════════════════
$('#sendCode').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const phone = $('#phone').value.trim();
  $('#phoneErr').hidden = true;
  const res = await api.post('/api/auth/request-code', { phone });
  data.phone = res.phone;
  $('#phoneEcho').textContent = '+967 ' + res.phone;
  if (res.devCode) {
    $('#devHint').hidden = false;
    $('#devHint').textContent = `وضع التطوير — الرمز: ${res.devCode}`;
  }
  goto('s2');
  $('#otp').firstElementChild.focus();
}).catch((err) => {
  $('#phoneErr').hidden = false;
  $('#phoneErr').textContent = err.message;
}));

$('#phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#sendCode').click(); });

// ═══ ٢. الرمز ════════════════════════════════════════════
const otpInputs = $$('#otp input');
otpInputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 1);
    if (input.value && i < otpInputs.length - 1) otpInputs[i + 1].focus();
    if (otpInputs.every((x) => x.value)) $('#verify').click();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) otpInputs[i - 1].focus();
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    digits.split('').forEach((d, k) => { if (otpInputs[k]) otpInputs[k].value = d; });
    if (digits.length === 6) $('#verify').click();
  });
});

$('#back1').addEventListener('click', () => goto('s1'));

$('#verify').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#otpErr').hidden = true;
  const code = otpInputs.map((x) => x.value).join('');
  const res = await api.post('/api/auth/verify', { phone: data.phone, code });
  if (res.hasStore && !ADDING) {
    toast('لديك متجر بالفعل — إلى لوحة التحكم');
    setTimeout(() => { location.href = '/dashboard'; }, 900);
    return;
  }
  goto('s3');
}).catch((err) => {
  $('#otpErr').hidden = false;
  $('#otpErr').textContent = err.message;
  otpInputs.forEach((x) => { x.value = ''; });
  otpInputs[0].focus();
}));

// ═══ ٣. الاسم والرابط — فحص فوري (§٣.٢) ══════════════════
let slugTimer, slugEdited = false;

$('#name').addEventListener('input', (e) => {
  data.name = e.target.value;
  if (!slugEdited) { $('#slug').value = e.target.value; checkSlug(); }
  preview();
});

$('#slug').addEventListener('input', () => { slugEdited = true; checkSlug(); });

/**
 * الاسم القادم من حقل «احجز رابطك» في الصفحة الرئيسية.
 * الزائر كتبه هناك ورأى أنه متاح؛ إعادة مطالبته به هنا تُلغي
 * أثر ما فعله للتو وتُشعره بأنه بدأ من الصفر.
 */
{
  const q = new URLSearchParams(location.search);
  const wanted = q.get('store')?.trim().slice(0, 40);
  if (wanted) {
    data.name = wanted;
    $('#name').value = wanted;
    $('#slug').value = wanted;
    checkSlug();
    preview();
  }
}

function checkSlug() {
  clearTimeout(slugTimer);
  const raw = $('#slug').value;
  const box = $('#slugState');
  $('#toSector').disabled = true;

  if (!raw.trim()) { box.className = 'slugstate'; box.textContent = ''; return; }
  box.className = 'slugstate';
  box.textContent = 'جارٍ الفحص…';

  slugTimer = setTimeout(async () => {
    try {
      const res = await api.get('/api/slug/check?q=' + encodeURIComponent(raw));
      data.slug = res.slug;
      preview();
      if (res.ok) {
        box.className = 'slugstate ok';
        box.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg> الرابط متاح`;
        $('#toSector').disabled = false;
      } else {
        box.className = 'slugstate no';
        box.innerHTML = escapeHtml(res.reason) +
          (res.suggestion ? ` — <button class="sugg" type="button" id="useSugg">جرّب ${escapeHtml(res.suggestion)}</button>` : '');
        const btn = $('#useSugg');
        if (btn) btn.addEventListener('click', () => {
          $('#slug').value = res.suggestion; slugEdited = true; checkSlug();
        });
      }
    } catch (err) {
      box.className = 'slugstate no';
      box.textContent = err.message;
    }
  }, 320);
}

$('#toSector').addEventListener('click', () => goto('s4'));

// ═══ ٤. النشاط ═══════════════════════════════════════════
$('#sectors').innerHTML = SECTORS.map((s) => `
  <button class="pick" data-sector="${s.id}" type="button">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${s.icon}"/></svg>
    <b>${s.name}</b>
  </button>`).join('');

$('#sectors').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-sector]');
  if (!pick) return;
  $$('.pick').forEach((p) => p.classList.toggle('on', p === pick));
  data.sector = pick.dataset.sector;
});

$('#city').addEventListener('input', (e) => { data.city = e.target.value; });
$('#toBrand').addEventListener('click', () => goto('s5'));

// ═══ ٥. الهوية ═══════════════════════════════════════════
$('#sws').innerHTML = COLORS.map(([c, d], i) =>
  `<button class="sw ${i === 0 ? 'on' : ''}" type="button" style="background:${c}" data-c="${c}" data-d="${d}" aria-label="لون ${i + 1}"></button>`).join('');

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** الدرجة الغامقة تُشتق حين لا تأتي من عيّنة جاهزة (§٣.٦) */
function setColor(color, deep) {
  if (!HEX6.test(color)) return;
  data.color = color;
  data.colorDeep = HEX6.test(deep ?? '') ? deep : derivePalette(color)['--shop-deep'];
  $$('.sw').forEach((s) => s.classList.toggle('on', s.dataset.c.toLowerCase() === color.toLowerCase()));
  $('#colorPick').value = color;
  $('#colorHex').value = color.toUpperCase();
  preview();
}

$('#sws').addEventListener('click', (e) => {
  const sw = e.target.closest('.sw');
  if (sw) setColor(sw.dataset.c, sw.dataset.d);
});

$('#colorPick').addEventListener('input', (e) => setColor(e.target.value));
$('#colorHex').addEventListener('input', (e) => {
  const v = e.target.value.trim().replace(/^(?!#)/, '#');
  if (HEX6.test(v)) setColor(v);
});

$('#tagline').addEventListener('input', (e) => { data.tagline = e.target.value; preview(); });

/** يقرأ صورة ويصغّرها في المتصفح (§٥.٣ — لا يُترك للتاجر) */
function readImage(file, maxSide = 800) {
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

function wireDrop(dropId, fileId, prevId, onDone) {
  $(`#${dropId}`).addEventListener('click', () => $(`#${fileId}`).click());
  $(`#${fileId}`).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      $(`#${prevId}`).src = dataUrl;
      $(`#${prevId}`).hidden = false;
      onDone(dataUrl);
    } catch (err) { toast(err.message, 'bad'); }
  });
}

wireDrop('logoDrop', 'logoFile', 'logoPrev', (url) => { data.logo = url; preview(); });
wireDrop('prodDrop', 'prodFile', 'prodPrev', (url) => { data.product.image = url; });

$('#toProduct').addEventListener('click', () => goto('s6'));
$$('[data-skip]').forEach((b) => b.addEventListener('click', () => goto(b.dataset.skip)));

// ═══ ٦. الإنشاء ══════════════════════════════════════════
async function createStore(withProduct) {
  const payload = {
    name: data.name.trim(),
    slug: data.slug,
    sector: data.sector || 'other',
    city: data.city.trim(),
    tagline: data.tagline.trim(),
    logo: data.logo,
    color: data.color,
    colorDeep: data.colorDeep,
    whatsapp: data.phone,
  };

  if (withProduct && $('#pName').value.trim()) {
    payload.product = {
      name: $('#pName').value.trim(),
      price: Number($('#pPrice').value) || 0,
      qty: Number($('#pQty').value) || 1,
      image: data.product.image ?? '',
    };
  }

  const res = await api.post('/api/stores', payload);
  const url = `${location.origin}/${res.slug}`;
  $('#finalUrl').innerHTML = `${location.host}/<b>${escapeHtml(res.slug)}</b>`;
  $('#viewShop').href = `/${res.slug}`;
  $('#copyUrl').dataset.url = url;
  goto('s7');
}

$('#finish').addEventListener('click', (e) => withBusy(e.currentTarget, () => createStore(true)).catch(() => {}));
$('#finishSkip').addEventListener('click', (e) => withBusy(e.currentTarget, () => createStore(false)).catch(() => {}));

$('#copyUrl').addEventListener('click', async (e) => {
  const url = e.currentTarget.dataset.url;
  try { await navigator.clipboard.writeText(url); toast('نُسخ رابط متجرك'); }
  catch { toast(url); }
});

// ═══ إقلاع ═══════════════════════════════════════════════
(async () => {
  paintBar();
  preview();
  try {
    const me = await api.get('/api/auth/me');
    if (!me.authenticated) return;              // زائر جديد — يبدأ من الجوال

    data.phone = me.merchant.phone;

    // متجر إضافي: يُسمح به فقط بخانة شاغرة، ولا يُعاد التوجيه
    if (ADDING && me.slots?.free > 0) {
      $('#s1 h1').textContent = 'أضف متجراً جديداً';
      $('#s1 p').textContent = 'متجرك الحالي يبقى كما هو — هذا متجر مستقل بمنتجاته ورابطه.';
      goto('s3');                               // التاجر مسجّل، فنتخطى الجوال والرمز
      return;
    }
    if (ADDING) {
      toast('لا توجد خانة متجر شاغرة — اشترِ خانة من قسم الاشتراك', 'bad');
      setTimeout(() => { location.href = '/dashboard'; }, 1600);
      return;
    }

    if (me.hasStore) { location.href = '/dashboard'; return; }
    goto('s3');
  } catch { /* زائر جديد */ }
})();

/**
 * اللون القادم من استوديو الصفحة الرئيسية.
 * الزائر اختاره ورأى متجره مصبوغاً به قبل أن يضغط «أنشئ»؛
 * إسقاطه هنا يكسر الوعد الذي قطعته تلك الصفحة.
 * يُطبَّق في نهاية الملف لأن setColor وHEX6 يُعرَّفان بعد كتلة
 * قراءة المعاملات أعلاه.
 */
{
  const q = new URLSearchParams(location.search);
  const color = q.get('color');
  if (color && HEX6.test(color)) setColor(color, q.get('deep') ?? '');
}
