// سكربت صفحة /login — أُخرج من HTML ليعمل مع CSP الصارم
import { $, $$, api, toast, withBusy } from '/assets/js/app.js';

let phone = '';
const show = (id) => $$('.step').forEach((s) => s.classList.toggle('on', s.id === id));

$('#sendCode').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  $('#phoneErr').hidden = true;
  const res = await api.post('/api/auth/request-code', { phone: $('#phone').value });
  phone = res.phone;
  $('#phoneEcho').textContent = '+967 ' + res.phone;
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
