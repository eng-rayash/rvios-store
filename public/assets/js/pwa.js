// ═══════════════════════════════════════════════════════════
//  تسجيل عامل الخدمة
//
//  سكربت خارجي لا inline: سياسة CSP لا تسمح بـunsafe-inline
//  للسكربتات، وهذا قيد مقصود لا عقبة نلتفّ عليها.
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  // بعد التحميل لا قبله: التسجيل ينافس تحميل الصفحة على شبكة بطيئة
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      /**
       * نسخة جديدة جاهزة؟ نُعلم المستخدم ولا نُحدّث تحته.
       * إعادة التحميل القسري وسط كتابة منتج تُضيّع عمله.
       */
      reg.addEventListener('updatefound', () => {
        const fresh = reg.installing;
        if (!fresh) return;
        fresh.addEventListener('statechange', () => {
          if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotice();
          }
        });
      });
    }).catch(() => { /* التسجيل تحسين لا شرط */ });
  });
}

function showUpdateNotice() {
  if (document.getElementById('swUpdate')) return;

  const bar = document.createElement('div');
  bar.id = 'swUpdate';
  bar.className = 'toast on';
  bar.style.cssText = 'inset-inline-start:auto;inset-inline-end:24px;gap:14px';
  bar.innerHTML = '<span>يتوفّر تحديث للوحة</span>';

  const btn = document.createElement('button');
  btn.textContent = 'حدّث الآن';
  btn.style.cssText = 'font-weight:800;text-decoration:underline;color:inherit';
  btn.addEventListener('click', () => location.reload());

  bar.appendChild(btn);
  document.body.appendChild(bar);
}
