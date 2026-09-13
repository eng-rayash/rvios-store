// سكربت صفحة /login — أُخرج من HTML ليعمل مع CSP الصارم
import { $, $$, api, toast, withBusy } from '/assets/js/app.js';
import { COUNTRIES, DEFAULT_COUNTRY } from '/assets/js/countries.js';

let phone = '';
const show = (id) => $$('.step').forEach((s) => s.classList.toggle('on', s.id === id));

/**
 * منتقي الدولة — كان `+967` مكتوباً في HTML، فلم يكن لتاجر من
 * خارج اليمن أي طريق للدخول أصلاً. الخيار يُرسل مع الرقم فيفهم
 * الخادم `790123456` أردنياً لا يمنياً.
 */
const country = $('#country');
country.innerHTML = Object.values(COUNTRIES)
  .map((c) => `<option value="${c.code}">+${c.dial}</option>`).join('');
country.value = DEFAULT_COUNTRY;

$('#sendCode').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#phoneErr').hidden = true;
  const res = await api.post('/api/auth/request-code',
    { phone: $('#phone').value, country: country.value });
  phone = res.phone;
  $('#phoneEcho').textContent = '+' + res.phone;
  if (res.devCode) { $('#devHint').hidden = false; $('#devHint').textContent = `وضع التطوير — الرمز: ${res.devCode}`; }
  show('s2');
  $('#otp').firstElementChild.focus();
}).catch((err) => { $('#phoneErr').hidden = false; $('#phoneErr').textContent = err.message; }));

$('#phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#sendCode').click(); });
$('#back').addEventListener('click', () => show('s1'));

const inputs = $$('#otp input');
inputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 1);
    if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
    if (inputs.every((x) => x.value)) $('#verify').click();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const d = (e.clipboardData.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    d.split('').forEach((x, k) => { if (inputs[k]) inputs[k].value = x; });
    if (d.length === 6) $('#verify').click();
  });
});

$('#verify').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#otpErr').hidden = true;
  const res = await api.post('/api/auth/verify', { phone, code: inputs.map((x) => x.value).join('') });
  location.href = res.hasStore ? '/dashboard' : '/onboarding';
}).catch((err) => {
  $('#otpErr').hidden = false;
  $('#otpErr').textContent = err.message;
  inputs.forEach((x) => { x.value = ''; });
  inputs[0].focus();
}));
