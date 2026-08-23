// سكربت صفحة /contact — أُخرج من HTML ليعمل مع CSP الصارم
import { $, api, withBusy } from '/assets/js/app.js';
import '/assets/js/site.js';

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  withBusy($('#send'), async () => {
    $('#err').hidden = true;
    const res = await api.post('/api/contact', {
      kind: $('#kind').value,
      contact: $('#contact').value.trim(),
      detail: $('#detail').value.trim(),
    });
    $('#form').hidden = true;
    $('#done').hidden = false;
  }).catch((err) => { $('#err').hidden = false; $('#err').textContent = err.message; });
});
