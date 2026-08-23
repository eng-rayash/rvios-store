// صفحة انقطاع الاتصال — سكربت خارجي لأن CSP يمنع inline
const retry = document.getElementById('retry');

retry?.addEventListener('click', () => {
  retry.disabled = true;
  retry.textContent = 'جارٍ المحاولة…';
  location.reload();
});

// عودة الشبكة تُعيد التحميل تلقائياً — لا ننتظر ضغطة المستخدم
window.addEventListener('online', () => location.reload());
