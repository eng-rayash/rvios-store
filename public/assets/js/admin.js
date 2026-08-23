// ═══════════════════════════════════════════════════════════
//  لوحة إدارة المنصة (§٣.٥)
// ═══════════════════════════════════════════════════════════
import { $, $$, api, AR, escapeHtml, toast, withBusy, when } from './app.js';

/** أسماء الباقات تُجلب من الخادم — لا نسخة ثانية تتخلّف عن plans.js */
let PLAN_NAMES = { basic: 'مجانية', plus: 'بلس', pro: 'برو' };
api.get('/api/plans')
  .then((plans) => { PLAN_NAMES = Object.fromEntries(plans.map((p) => [p.id, p.name])); })
  .catch(() => { /* نبقى على الافتراضي */ });
const KINDS = {
  build:   'أنشئوا متجري',
  domain:  'دومين مخصص',
  store:   'متجر إضافي',
  verify:  'طلب توثيق',
  upgrade: 'طلب ترقية',
  other:   'أخرى',
};

let reportStatus = 'open', reqStatus = 'open';

// ═══ البوابة ═════════════════════════════════════════════
(async () => {
  const s = await api.get('/api/admin/session').catch(() => ({ admin: false }));
  if (s.admin) enter();
})();

$('#enter').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#gateErr').hidden = true;
  await api.post('/api/admin/login', { pass: $('#pass').value });
  enter();
}).catch((err) => { $('#gateErr').hidden = false; $('#gateErr').textContent = err.message; }));

$('#pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#enter').click(); });

function enter() {
  $('#gate').hidden = true;
  $('#panel').hidden = false;
  loadAll();
  wire();
}

async function loadAll() {
  // الإعدادات أولاً: منها أسماء الباقات ووسائل الدفع التي يعرضها الطابور
  await loadSettings();
  await Promise.all([
    loadStats(), loadStores(), loadReports(), loadRequests(),
    loadPlans(), loadInvoices(),
  ]);
}

// ═══ الإحصائيات ══════════════════════════════════════════
async function loadStats() {
  const d = await api.get('/api/admin/stats');

  const cards = [
    { key: true, label: 'معدل التفعيل', value: `${AR(d.activationRate)}٪`,
      note: `${AR(d.activated)} من ${AR(d.stores)} متجر بلغ رابطاً + أول منتج` },
    { label: 'المتاجر', value: AR(d.stores), note: `${AR(d.active)} نشط · ${AR(d.suspended)} موقوف` },
    { label: 'التجار', value: AR(d.merchants), note: 'حسابات مسجّلة' },
    { label: 'المتاجر الحيّة', value: AR(d.lively), note: `أضافت منتجاً خلال ٣٠ يوماً (${AR(d.retentionRate)}٪)` },
    { label: 'الطلبات', value: AR(d.orders), note: `${AR(d.confirmed)} مؤكد أو مكتمل` },
    { label: 'المنتجات', value: AR(d.products), note: 'عبر كل المتاجر' },
    { label: 'معدل الترقية', value: `${AR(d.upgradeRate)}٪`,
      note: `${AR(d.paidMerchants)} تاجر مدفوع · ${AR(d.paid)} متجر` },
    { label: 'حسابات متعددة المتاجر', value: AR(d.multiStore), note: 'تجار يملكون أكثر من متجر' },
    { key: d.pendingInvoices > 0, label: 'إيصالات تنتظر مراجعتك', value: AR(d.pendingInvoices),
      note: `${AR(d.unpaidInvoices)} فاتورة بانتظار الدفع` },
    { label: 'المحصَّل', value: AR(d.revenue), note: 'ريال يمني من فواتير مؤكدة' },
    { label: 'المتاجر الموثّقة', value: AR(d.verified), note: `${AR(d.openReports)} بلاغ مفتوح` },
  ];

  $('#stats').innerHTML = cards.map((c) => `
    <div class="stat ${c.key ? 'key' : ''}">
      <small>${escapeHtml(c.label)}</small>
      <b>${c.value}</b>
      <i>${escapeHtml(c.note)}</i>
    </div>`).join('');

  $('#payPill').hidden = !d.pendingInvoices;
  $('#payPill').textContent = AR(d.pendingInvoices);
  $('#repPill').hidden = !d.openReports;
  $('#repPill').textContent = AR(d.openReports);
  $('#reqPill').hidden = !d.openRequests;
  $('#reqPill').textContent = AR(d.openRequests);

  const rows = [
    ['الاكتساب', 'عدد التجار المسجّلين', AR(d.merchants), 'نمو أعلى القمع'],
    ['التفعيل', '٪ من وصلوا لرابط + أول منتج', `${AR(d.activationRate)}٪`, 'المؤشر الأهم في المرحلة الأولى'],
    ['الاستبقاء', '٪ المتاجر التي أضافت منتجاً خلال ٣٠ يوماً', `${AR(d.retentionRate)}٪`, 'يميّز الحيّ عن المهجور'],
    ['القيمة', 'الطلبات المؤكدة', AR(d.confirmed), 'إثبات أن المنصة تُنتج بيعاً فعلياً'],
    ['التسييل', '٪ الترقية من مجاني إلى مدفوع', `${AR(d.upgradeRate)}٪`, 'صحة نموذج الفريميوم'],
    ['الثقة', 'المتاجر الموثّقة · البلاغات', `${AR(d.verified)} · ${AR(d.openReports)}`, 'سلامة النظام البيئي'],
  ];

  $('#funnel').innerHTML = `<table style="margin:-20px">
    <thead><tr><th>المرحلة</th><th>المؤشر</th><th>القيمة</th><th>لماذا يهم</th></tr></thead>
    <tbody>${rows.map(([a, b, c, e]) => `
      <tr><td><b>${a}</b></td><td>${b}</td>
      <td><span class="money" style="font-size:20px">${c}</span></td>
      <td style="color:var(--soft);font-size:12.5px">${e}</td></tr>`).join('')}</tbody></table>`;
}

// ═══ المتاجر ═════════════════════════════════════════════
async function loadStores(q = '') {
  const rows = await api.get('/api/admin/stores' + (q ? `?q=${encodeURIComponent(q)}` : ''));

  $('#storeRows').innerHTML = rows.length ? rows.map((s) => `
    <tr>
      <td><div class="pcell">
        <div class="pth" style="background:${escapeHtml(s.color)};color:#fff;font-family:var(--display);font-size:19px;font-weight:700">
          ${s.logo ? `<img src="${escapeHtml(s.logo)}" alt="">` : escapeHtml(s.name.replace(/^(متجر|محل)\s+/, '').charAt(0))}
        </div>
        <div>
          <b>${escapeHtml(s.name)} ${s.verified ? '<span class="badge b-ok" style="font-size:10px">موثّق</span>' : ''}</b>
          <small><a href="/${encodeURIComponent(s.slug)}" target="_blank" rel="noopener" style="color:var(--shop)">/${escapeHtml(s.slug)}</a> · ${escapeHtml(s.city || '—')}</small>
        </div>
      </div></td>
      <td>
        ${escapeHtml(s.owner_name || '—')}
        ${s.owner_stores > 1
          ? `<span class="badge b-done" title="هذا التاجر يملك ${AR(s.owner_stores)} متاجر">${AR(s.owner_stores)} متاجر</span>`
          : ''}
        <br><small style="color:var(--soft);direction:ltr">${escapeHtml(s.owner_phone)}</small>
      </td>
      <td><span class="badge b-done">${PLAN_NAMES[s.plan] ?? s.plan}</span></td>
      <td>${AR(s.products)}</td>
      <td>${AR(s.orders)}</td>
      <td>
        <span class="badge ${s.status === 'active' ? 'b-ok' : 'b-off'}">${s.status === 'active' ? 'نشط' : 'موقوف'}</span>
        ${s.reports ? `<span class="badge b-wait" style="margin-inline-start:4px">${AR(s.reports)} بلاغ</span>` : ''}
      </td>
      <td><div class="acts-cell">
        <button class="btn btn-line btn-sm" data-verify="${s.id}" data-to="${s.verified ? 0 : 1}">
          ${s.verified ? 'سحب التوثيق' : 'توثيق'}
        </button>
        <button class="btn btn-line btn-sm" data-susp="${s.id}" data-to="${s.status === 'active' ? 'suspended' : 'active'}"
          style="color:${s.status === 'active' ? 'var(--danger)' : 'var(--ok)'}">
          ${s.status === 'active' ? 'تعليق' : 'تفعيل'}
        </button>
      </div></td>
    </tr>`).join('')
    : `<tr><td colspan="7"><div class="empty"><p>لا توجد متاجر مطابقة.</p></div></td></tr>`;
}

// ═══ البلاغات (§٦.٢) ═════════════════════════════════════
async function loadReports() {
  const rows = await api.get(`/api/admin/reports?status=${reportStatus}`);

  $('#reportRows').innerHTML = rows.length ? rows.map((r) => `
    <div class="ord">
      <div class="cust">
        <b>${escapeHtml(r.reason)}</b>
        <small>
          <a href="/${encodeURIComponent(r.store_slug)}" target="_blank" rel="noopener" style="color:var(--shop);font-weight:700">${escapeHtml(r.store_name)}</a>
          · ${when(r.created_at)}
        </small>
        ${r.detail ? `<div style="font-size:12.5px;color:var(--soft);margin-top:6px;line-height:1.8">${escapeHtml(r.detail)}</div>` : ''}
      </div>
      ${r.status === 'open'
        ? `<button class="btn btn-line btn-sm" data-rep="${r.id}" data-to="closed">إغلاق البلاغ</button>`
        : `<button class="btn btn-line btn-sm" data-rep="${r.id}" data-to="open">إعادة فتح</button>`}
    </div>`).join('')
    : `<div class="empty"><p>لا بلاغات في هذه الحالة.</p></div>`;
}

// ═══ طلبات الخدمات والتوثيق ══════════════════════════════
async function loadRequests() {
  const rows = await api.get(`/api/admin/requests?status=${reqStatus}`);

  $('#reqRows').innerHTML = rows.length ? rows.map((r) => `
    <div class="ord">
      <span class="badge b-wait">${escapeHtml(KINDS[r.kind] ?? r.kind)}</span>
      <div class="cust">
        <b>${r.store_name
          ? `<a href="/${encodeURIComponent(r.store_slug)}" target="_blank" rel="noopener">${escapeHtml(r.store_name)}</a>`
          : 'طلب من الموقع العام'}</b>
        <small style="direction:ltr;display:inline-block">${escapeHtml(r.contact || '—')}</small>
        <small> · ${when(r.created_at)}</small>
        ${r.detail ? `<div style="font-size:12.5px;color:var(--soft);margin-top:6px;line-height:1.8">${escapeHtml(r.detail)}</div>` : ''}
      </div>
      ${r.status === 'open' ? `
        <a class="btn btn-wa btn-sm" href="https://wa.me/967${escapeHtml(r.contact)}" target="_blank" rel="noopener">واتساب</a>
        <button class="btn btn-fill btn-sm" data-req="${r.id}" data-to="done">
          ${r.kind === 'verify' ? 'اقبل ووثّق' : 'تم الإنجاز'}
        </button>
        <button class="btn btn-line btn-sm" data-req="${r.id}" data-to="rejected" style="color:var(--danger)">رفض</button>
      ` : `<button class="btn btn-line btn-sm" data-req="${r.id}" data-to="open">إعادة فتح</button>`}
    </div>`).join('')
    : `<div class="empty"><p>لا طلبات في هذه الحالة.</p></div>`;
}

// ═══ مراجعة المدفوعات (§٥.٦) ═════════════════════════════
let invStatus = 'under_review';
/** معرّف الوسيلة → اسمها العربي، من الإعدادات */
let METHOD_NAMES = {};

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

async function loadInvoices() {
  const rows = await api.get(`/api/admin/invoices?status=${invStatus}`);

  $('#invRows').innerHTML = rows.length ? rows.map((i) => `
    <div class="ord">
      <span class="ref">${escapeHtml(i.ref)}</span>

      <div class="cust">
        <b><a href="/${encodeURIComponent(i.store_slug)}" target="_blank" rel="noopener">${escapeHtml(i.store_name)}</a></b>
        <small>
          ${escapeHtml(INV_KIND[i.kind] ?? i.kind)}${i.plan ? ` · ${escapeHtml(PLAN_NAMES[i.plan] ?? i.plan)}` : ''}
          ${i.months > 1 ? ` · ${AR(i.months)} شهراً` : ''}
          · <span style="direction:ltr;display:inline-block">${escapeHtml(i.owner_phone)}</span>
          · ${when(i.created_at)}
        </small>
        ${i.method ? `<small> · حُوّل عبر ${escapeHtml(METHOD_NAMES[i.method] ?? i.method)}</small>` : ''}
        ${i.void_reason ? `<div style="font-size:12.5px;color:var(--danger);margin-top:5px">سبب الرفض: ${escapeHtml(i.void_reason)}</div>` : ''}
      </div>

      <span class="amt">${AR(i.amount)} <span style="font-family:var(--body);font-size:12px;color:var(--soft);font-weight:500">ر.ي</span></span>
      <span class="badge ${INV_STATUS[i.status][0]}">${INV_STATUS[i.status][1]}</span>

      ${i.proof_key
        ? `<a class="btn btn-line btn-sm" href="${escapeHtml(i.proof_key)}" target="_blank" rel="noopener">عرض الإيصال</a>`
        : '<span class="badge b-off">بلا إيصال</span>'}

      ${i.status === 'under_review' || i.status === 'unpaid' ? `
        <button class="btn btn-fill btn-sm" data-inv="${i.id}" data-act="paid">تأكيد الدفع</button>
        <button class="btn btn-line btn-sm" data-inv="${i.id}" data-act="void" style="color:var(--danger)">رفض</button>
      ` : ''}

      ${i.proof_key ? `<div style="flex-basis:100%;margin-top:10px">
        <a href="${escapeHtml(i.proof_key)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(i.proof_key)}" alt="إيصال ${escapeHtml(i.ref)}" loading="lazy"
               style="max-height:180px;border-radius:6px;border:1px solid var(--line)">
        </a>
      </div>` : ''}
    </div>`).join('')
    : `<div class="empty"><p>لا فواتير في هذه الحالة.</p></div>`;
}

// ═══ الإعدادات: الأسعار وتعليمات التحصيل ═════════════════
const SETTING_FIELDS = [
  ['setPlus',    'price.plus'],
  ['setPro',     'price.pro'],
  ['setYearly',  'billing.yearlyMonthsFree'],
  ['setBuild',   'price.store_build'],
  ['setDomain',  'price.domain'],
  ['setExtra',   'price.extra_store'],
  ['setKuraimi', 'pay.kuraimi'],
  ['setJaib',    'pay.jaib'],
  ['setPaypal',  'pay.paypal'],
];

async function loadSettings() {
  const s = await api.get('/api/admin/settings');
  const byKey = Object.fromEntries(s.methods.map((m) => [m.instructionsKey, m.instructions]));
  METHOD_NAMES = Object.fromEntries(s.methods.map((m) => [m.id, m.name]));

  const values = {
    'price.plus': s.prices.plus, 'price.pro': s.prices.pro,
    'billing.yearlyMonthsFree': s.yearlyMonthsFree,
    'price.store_build': s.addons.store_build,
    'price.domain': s.addons.domain,
    'price.extra_store': s.addons.extra_store,
    ...byKey,
  };
  for (const [id, key] of SETTING_FIELDS) {
    const el = $(`#${id}`);
    if (el) el.value = values[key] ?? '';
  }
}

// ═══ الباقات ═════════════════════════════════════════════
async function loadPlans() {
  const rows = await api.get('/api/admin/plans');

  $('#planRows').innerHTML = rows.map((p) => `
    <div class="plan">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="pd">${escapeHtml(p.desc)}</div>
      <div class="num">${p.price === 0 ? 'مجانية' : p.price === null ? '—' : AR(p.price)}
        ${p.price === null ? '<span> / شهرياً</span>' : ''}</div>
      <div style="font-size:13px;color:var(--soft);margin-bottom:14px">
        <b style="color:var(--ink);font-family:var(--display);font-size:26px">${AR(p.stores)}</b> متجر على هذه الباقة
      </div>
      <ul>${p.features.map((f) => `
        <li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>${escapeHtml(f)}</li>`).join('')}</ul>
      <div style="font-size:12px;color:var(--soft);border-top:1px solid var(--line);padding-top:10px">
        حد المنتجات: ${p.products === null ? 'غير محدود' : AR(p.products)}
      </div>
    </div>`).join('');
}

// ═══ الأحداث ═════════════════════════════════════════════
function wire() {
  const TITLES = { stats: 'الإحصائيات', stores: 'المتاجر', reports: 'البلاغات',
                   requests: 'الطلبات والتوثيق', plans: 'الباقات',
                   payments: 'مراجعة المدفوعات' };

  document.addEventListener('click', async (e) => {
    const nav    = e.target.closest('[data-v]');
    const verify = e.target.closest('[data-verify]');
    const susp   = e.target.closest('[data-susp]');
    const rep    = e.target.closest('[data-rep]');
    const req    = e.target.closest('[data-req]');
    const rs     = e.target.closest('[data-rs]');
    const qs     = e.target.closest('[data-qs]');

    if (nav) {
      $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + nav.dataset.v));
      $$('.nav button').forEach((b) => b.classList.toggle('on', b === nav));
      $('#ttl').textContent = TITLES[nav.dataset.v];
      $('#side').classList.remove('open');
    }

    if (verify) {
      try {
        await api.patch(`/api/admin/stores/${verify.dataset.verify}`, { verified: Number(verify.dataset.to) });
        toast(Number(verify.dataset.to) ? 'وُثّق المتجر' : 'سُحب التوثيق');
        await Promise.all([loadStores($('#storeQ').value), loadStats()]);
      } catch (err) { toast(err.message, 'bad'); }
    }

    if (susp) {
      const to = susp.dataset.to;
      if (to === 'suspended' && !confirm('تعليق هذا المتجر؟ سيتوقف رابطه عن العمل فوراً.')) return;
      try {
        await api.patch(`/api/admin/stores/${susp.dataset.susp}`, { status: to });
        toast(to === 'suspended' ? 'عُلّق المتجر' : 'أُعيد تفعيل المتجر');
        await Promise.all([loadStores($('#storeQ').value), loadStats()]);
      } catch (err) { toast(err.message, 'bad'); }
    }

    if (rep) {
      try {
        await api.patch(`/api/admin/reports/${rep.dataset.rep}`, { status: rep.dataset.to });
        toast('حُدّث البلاغ');
        await Promise.all([loadReports(), loadStats()]);
      } catch (err) { toast(err.message, 'bad'); }
    }

    if (req) {
      try {
        await api.patch(`/api/admin/requests/${req.dataset.req}`, { status: req.dataset.to });
        toast('حُدّث الطلب');
        await Promise.all([loadRequests(), loadStores($('#storeQ').value), loadStats()]);
      } catch (err) { toast(err.message, 'bad'); }
    }

    if (rs) { reportStatus = rs.dataset.rs; $$('[data-rs]').forEach((t) => t.classList.toggle('on', t === rs)); loadReports(); }
    if (qs) { reqStatus = qs.dataset.qs;    $$('[data-qs]').forEach((t) => t.classList.toggle('on', t === qs)); loadRequests(); }

    // ── مراجعة المدفوعات ──
    const is = e.target.closest('[data-is]');
    if (is) {
      invStatus = is.dataset.is;
      $$('[data-is]').forEach((t) => t.classList.toggle('on', t === is));
      loadInvoices();
      return;
    }

    const inv = e.target.closest('[data-inv]');
    if (inv) {
      const act = inv.dataset.act;
      let reason = '';
      if (act === 'void') {
        reason = prompt('سبب الرفض (يظهر في سجل التدقيق):') ?? '';
        if (!reason.trim()) return;
      } else if (!confirm('تأكيد استلام هذا المبلغ؟')) return;

      await withBusy(inv, async () => {
        await api.patch(`/api/admin/invoices/${inv.dataset.inv}`, { action: act, reason });
        await Promise.all([loadInvoices(), loadStats(), loadStores($('#storeQ').value)]);
        toast(act === 'paid' ? 'أُكّد الدفع' : 'رُفضت الفاتورة وسُحب التفعيل');
      }).catch(() => {});
    }
  });

  // ── حفظ الأسعار وتعليمات التحصيل ──
  $('#saveSettings').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const payload = {};
    for (const [id, key] of SETTING_FIELDS) {
      const el = $(`#${id}`);
      if (!el) continue;
      const raw = el.value.trim();
      payload[key] = key.startsWith('pay.') ? raw : (raw === '' ? null : Number(raw));
    }
    await api.patch('/api/admin/settings', payload);
    await Promise.all([loadSettings(), loadPlans()]);
    $('#settingsHint').textContent =
      `حُفظت ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    toast('حُفظت الإعدادات — سارية فوراً بلا إعادة نشر');
  }).catch(() => {}));

  let searchTimer;
  $('#storeQ').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadStores(e.target.value), 280);
  });

  $('#burger').addEventListener('click', () => $('#side').classList.toggle('open'));

  $('#logout').addEventListener('click', async () => {
    await api.post('/api/admin/logout');
    location.reload();
  });
}
