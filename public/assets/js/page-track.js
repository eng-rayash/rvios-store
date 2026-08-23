// ═══════════════════════════════════════════════════════════
//  صفحة تتبّع الطلب — /{slug}/track أو /track?s=slug&ref=…
//  العميل يملك رقماً مرجعياً منذ §٤.١، وهذه الواجهة التي
//  تجعله ذا معنى بدل أن يبقى رقماً في رسالة واتساب.
// ═══════════════════════════════════════════════════════════
import { $, api, AR, money, escapeHtml, toast, withBusy, applyTheme, when } from './app.js';

const params = new URLSearchParams(location.search);
const SLUG = params.get('s') ?? '';
let SHOP = null;

const STEPS = [
  { id: 'wait', label: 'قيد التأكيد', icon: 'M12 7v5l3 2' },
  { id: 'ok',   label: 'مؤكد',        icon: 'M20 6 9 17l-5-5' },
  { id: 'done', label: 'مكتمل',       icon: 'M5 12h14M13 6l6 6-6 6' },
];

// حالة الطلب في المتجر إن عُرف
if (SLUG) {
  api.get(`/api/shop/${encodeURIComponent(SLUG)}`)
    .then((d) => { SHOP = d.store; applyTheme(SHOP); })
    .catch(() => {});
}

const refInput = $('#ref');
if (params.get('ref')) refInput.value = params.get('ref').toUpperCase();

refInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
});
refInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#go').click(); });

$('#go').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#err').hidden = true;
  $('#result').hidden = true;

  const ref = refInput.value.trim();
  if (!ref) throw new Error('أدخل الرقم المرجعي');

  const slug = SLUG || prompt('ما رابط المتجر؟ (مثال: yazan)')?.trim();
  if (!slug) throw new Error('نحتاج رابط المتجر لتتبّع الطلب');

  const o = await api.get(`/api/shop/${encodeURIComponent(slug)}/orders/${encodeURIComponent(ref)}`);
  paint(o);
  history.replaceState(null, '', `?s=${encodeURIComponent(slug)}&ref=${encodeURIComponent(ref)}`);
}).catch((err) => {
  $('#err').hidden = false;
  $('#err').textContent = err.message;
}));

function paint(o) {
  const cancelled = o.status === 'off';
  const reached = cancelled ? -1 : STEPS.findIndex((s) => s.id === o.status);
  const pct = cancelled ? 0 : (reached / (STEPS.length - 1)) * 100;

  const nodes = cancelled
    ? `<div class="node cancel" style="flex:1">
         <div class="dot"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
         <span>أُلغي الطلب</span>
       </div>`
    : STEPS.map((s, i) => `
        <div class="node ${i <= reached ? 'done' : ''}">
          <div class="dot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path d="${s.icon}"/>${s.id === 'wait' ? '<circle cx="12" cy="12" r="9"/>' : ''}
            </svg>
          </div>
          <span>${s.label}</span>
        </div>`).join('');

  const hasDelivery = o.deliveryFee > 0;

  $('#result').innerHTML = `
    <div class="ref">${escapeHtml(o.ref)}</div>
    <div class="when">طُلب ${when(o.createdAt)}</div>

    <div class="line">
      ${cancelled ? '' : `<i style="width:calc(${pct}% - ${pct ? 0 : 0}px)"></i>`}
      ${nodes}
    </div>

    <div class="items">
      ${o.items.map((it) => `
        <div class="row">
          <span>${escapeHtml(it.name)}${it.variant ? ` · ${escapeHtml(it.variant)}` : ''} × ${AR(it.qty)}</span>
          <span>${money(it.price * it.qty)}</span>
        </div>`).join('')}
      ${hasDelivery ? `
        <div class="row" style="color:var(--soft)"><span>المجموع</span><span>${money(o.subtotal)}</span></div>
        <div class="row" style="color:var(--soft)"><span>التوصيل</span><span>${money(o.deliveryFee)}</span></div>` : ''}
      <div class="row tot"><span>الإجمالي</span><b>${money(o.total)}</b></div>
    </div>

    ${o.status === 'wait' ? `
      <p style="font-size:12.5px;color:var(--soft);line-height:1.9;margin-top:16px;text-align:center">
        طلبك مسجّل وبانتظار تأكيد التاجر. تواصل معه عبر واتساب إن أردت الاستعجال.
      </p>` : ''}
    ${SHOP ? `<div style="text-align:center;margin-top:18px">
        <a class="btn btn-line btn-sm" href="/${encodeURIComponent(SHOP.slug)}">عودة إلى ${escapeHtml(SHOP.name)}</a>
      </div>` : ''}`;

  $('#result').hidden = false;
}

// تتبّع تلقائي حين يصل الرابط كاملاً
if (SLUG && params.get('ref')) $('#go').click();
