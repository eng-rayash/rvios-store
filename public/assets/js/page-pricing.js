// سكربت صفحة /pricing — أُخرج من HTML ليعمل مع CSP الصارم
import { $, $$, api, AR, escapeHtml } from '/assets/js/app.js';
import '/assets/js/site.js';

const FEATURES = [
  ['عدد المنتجات',        (p) => p.products === null ? 'غير محدود' : AR(p.products)],
  ['رابط متجر خاص',       () => true],
  ['طلبات عبر واتساب',    () => true],
  // §٣.٦ — الفرق الأول الذي يراه عميل التاجر: درجة تصميم الواجهة
  ['درجة تصميم المتجر',   (p) => p.design?.name ?? '—'],
  ['لونك على الموقع كله',  () => true],
  ['قسم «قصة المتجر» بصورة عرض', () => true],
  ['شريط ثقة وشريط تصنيفات', (p) => p.design?.id !== 'clean'],
  ['وهج محيط وتأثيرات متقدمة', (p) => p.design?.id === 'signature'],
  ['سكِنات إضافية',        (p) => p.extraThemes ? '٣ سكِنات' : false],
  ['زر الإبلاغ وحماية العميل', () => true],
  ['صور لكل منتج',        (p) => AR(p.imagesPerProduct)],
  ['تصنيفات فرعية',       (p) => p.subcategories],
  ['إحصائيات المتجر',     (p) => p.stats],
  ['شارة التوثيق',        (p) => p.canVerify],
  ['دومين مخصص',          (p) => p.customDomain],
  ['متاجر إضافية',        (p) => p.extraStores ? AR(p.extraStores) : false],
];

const YES = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E8B57" stroke-width="2.8" style="margin:0 auto"><path d="M20 6 9 17l-5-5"/></svg>';
const NO  = '<span style="color:var(--line);font-size:18px">—</span>';

const plans = await api.get('/api/plans');

$('#prow').innerHTML = plans.map((p, i) => `
  <div class="pcard ${i === 1 ? 'feat' : ''}">
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

$('#cmp').innerHTML = `
  <thead><tr>
    <th style="text-align:start">الميزة</th>
    ${plans.map((p) => `<th style="text-align:center">${escapeHtml(p.name)}</th>`).join('')}
  </tr></thead>
  <tbody>${FEATURES.map(([label, get]) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      ${plans.map((p) => {
        const v = get(p);
        return `<td style="text-align:center">${v === true ? YES : v === false ? NO : escapeHtml(String(v))}</td>`;
      }).join('')}
    </tr>`).join('')}</tbody>`;

const ADDONS = [
  { n: 'نُنشئ متجرك بدلاً عنك', k: 'رسوم مقطوعة', d: 'يتولى فريقنا رفع منتجاتك وضبط هويتك البصرية كاملة، وتستلم متجراً جاهزاً للمشاركة.' },
  { n: 'دومين مخصص',            k: 'رسوم سنوية',  d: 'اربط نطاقك الخاص بمتجرك بدل الرابط الفرعي — متاح مع برو أو كإضافة منفصلة.' },
  { n: 'متجر إضافي',             k: 'رسوم شهرية',  d: 'لمن لديه أكثر من نشاط تجاري ويريد فصلها تحت الحساب نفسه.' },
];

$('#addons').innerHTML = ADDONS.map((a) => `
  <div class="card" style="padding:24px">
    <span class="badge b-done">${a.k}</span>
    <h3 style="font-family:var(--display);font-size:24px;font-weight:700;margin:10px 0 6px">${a.n}</h3>
    <p style="font-size:13.5px;color:var(--soft);line-height:1.9;margin-bottom:16px">${a.d}</p>
    <a href="/contact" class="btn btn-line btn-sm">اطلب الخدمة</a>
  </div>`).join('');

const FAQ = [
  ['هل تأخذون عمولة على مبيعاتي؟',
   'لا. الدفع يتم بينك وبين عميلك مباشرة، والمنصة لا تلمس أموال المبيعات إطلاقاً. مصدر دخلنا هو الاشتراك فقط.'],
  ['ماذا يحدث إن تجاوزت حد الباقة المجانية؟',
   'يبقى متجرك ومنتجاتك كما هي، لكن لن تتمكن من إضافة منتج جديد حتى ترقّي باقتك أو تحذف منتجاً.'],
  ['كيف أدفع الاشتراك؟',
   'التحصيل في المرحلة الحالية يدوي عبر التحويل أو المحفظة المحلية، ونعمل على تفعيل الدفع داخل المنصة.'],
  ['هل يمكنني تغيير رابط متجري لاحقاً؟',
   'نعم، من إعدادات المتجر. انتبه أن الرابط القديم يتوقف عن العمل، لذا حدّثه أينما شاركته.'],
  ['هل أحتاج خبرة تقنية؟',
   'لا. التسجيل برقم جوالك، والإعداد خطوات معدودة. وإن أردت، نبني متجرك بدلاً عنك كخدمة منفصلة.'],
];

$('#faq').innerHTML = FAQ.map(([q, a]) => `
  <details class="card" style="padding:18px 20px;margin-bottom:10px">
    <summary style="font-weight:800;font-size:14.5px;cursor:pointer">${q}</summary>
    <p style="font-size:13.5px;color:var(--soft);line-height:1.95;margin-top:10px">${a}</p>
  </details>`).join('');
