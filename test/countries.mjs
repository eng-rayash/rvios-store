// رفع القفل اليمني — الدول والعملات
//
// كان النظام يفترض اليمن في ثلاثة مواضع لا يظهر أيّ منها إلا
// حين يحاول تاجر من خارجها التسجيل: نمط الجوال، ورمز الاتصال
// المكتوب `967` بالقيمة، ورمز العملة `ر.ي`. وما يستحق الفحص
// ليس أن الدول محفوظة في جدول، بل أن القفل رُفع فعلاً:
//   ١) رقم أردني محلي يُقبل حين تُذكر دولته
//   ٢) ورقم أردني يبدأ بـ`77` لا يُقرأ كرقم يمني
//   ٣) ومتجر خارج اليمن يعرض عملته هو لا الريال اليمني
//   ٤) ورسالة الخطأ لا تقول «أدخل رقماً يمنياً» بعد اليوم
import { toE164, validE164, symbolOf, localOf, countryOfPhone } from '../server/countries.js';

import { BASE as B } from './base.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✔', m)) : (fail++, console.log('  ✘', m)); };

async function j(method, path, body, cookie) {
  const r = await fetch(B + path, {
    method,
    headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = JSON.parse(t); } catch {}
  return { status: r.status, data: d, text: t, cookie: r.headers.getSetCookie?.().join('; ') ?? '' };
}

// ═══ توحيد الأرقام — بلا خادم ولا حدود معدّل ═══════════════
console.log('── كل صيغة يكتبها التاجر تؤدّي إلى الرقم نفسه ──');
const YE = '967777123456';
for (const written of ['777123456', '0777123456', '+967777123456', '00967777123456',
                       '777 123 456', '٧٧٧١٢٣٤٥٦']) {
  ok(toE164(written) === YE, `«${written}» → ${YE}`);
}

console.log('\n── رمز الدولة الصريح يُفهم بلا تلميح ──');
ok(toE164('+962790123456') === '962790123456', 'أردني بصيغة دولية');
ok(toE164('+201012345678') === '201012345678', 'مصري بصيغة دولية');
// ★ الفخّ: `218` يبدأ بـ`21`… ولو رُتّبت الرموز بالأقصر أولاً
// لالتقط `20` (مصر) كل رقم ليبي وأفسده بلا أن يرمي خطأً
ok(toE164('+218912345678') === '218912345678', 'ليبي لا يُلتقط كمصري رغم أنه يبدأ بـ٢١٨');

console.log('\n── الرقم المحلي يحتاج دولته ──');
ok(toE164('790123456', 'JO') === '962790123456', 'أردني محلي مع دولته');
// ★ الفخّ الثاني: `770123456` أردني صالح، ويبدأ بـ`77` مثل
// أرقام اليمن. بلا تلميح الدولة يصير يمنياً — ورقمان مختلفان
// في بلدين يتصادمان على مفتاح `merchants.phone` الفريد.
ok(toE164('770123456', 'JO') === '962770123456', 'أردني يبدأ بـ٧٧ يبقى أردنياً');
ok(toE164('770123456') === '967770123456', 'والافتراضي يبقى اليمن لمن لم يذكر دولته');

console.log('\n── ما ليس رقماً لا يمرّ ──');
ok(toE164('') === '', 'الفارغ');
ok(toE164('123') === '', 'قصير جداً');
ok(toE164('+9999999999999') === '', 'دولة غير مدعومة');
ok(validE164(YE) === true && validE164('967111111111') === false, 'التحقّق يرفض النمط الخاطئ');

console.log('\n── العملة تتبع الدولة ──');
ok(symbolOf('YE') === 'ر.ي', 'اليمن');
ok(symbolOf('JO') === 'د.أ', 'الأردن');
ok(symbolOf('EG') === 'ج.م', 'مصر');
// السقوط الآمن يحمي كل متجر قائم: عمود `country` أُضيف بقيمة
// افتراضية، والصفوف القديمة لا تحمل شيئاً صريحاً
ok(symbolOf(null) === 'ر.ي' && symbolOf('') === 'ر.ي', 'الغائب يسقط على الافتراضي لا على فراغ');
ok(symbolOf('ZZ') === 'ر.ي', 'ودولة مجهولة كذلك');

console.log('\n── العودة إلى الصيغة المحلية ──');
ok(localOf(YE) === '777123456', 'الرقم كما يعرفه صاحبه');
ok(countryOfPhone('962790123456')?.code === 'JO', 'الدولة تُستنتج من الرقم');

// ═══ الخادم ════════════════════════════════════════════════
// حدّ رموز التحقق عشرون لكل عنوان في الساعة، وهو **مشترك** بين
// كل ملفات الفحص. لذلك نطلب رمزين فقط هنا.
console.log('\n── تاجر من خارج اليمن يستطيع الدخول ──');
const JO_LOCAL = '791234567';
const req = await j('POST', '/api/auth/request-code', { phone: JO_LOCAL, country: 'JO' });
ok(req.status === 200, `قُبل الرقم الأردني (${req.status})`);
ok(req.data?.phone === '962791234567', `حُفظ دولياً: ${req.data?.phone}`);

const ver = await j('POST', '/api/auth/verify',
  { phone: req.data.phone, code: req.data.devCode });
ok(ver.status === 200, 'اكتمل التحقق');
const JO_SID = ver.cookie.split(';')[0];

console.log('\n── رسالة الخطأ لم تعد تقول «يمنياً» ──');
const nope = await j('POST', '/api/auth/request-code', { phone: '12' });
ok(nope.status === 400, 'رُفض الرقم الخاطئ');
ok(!/يمني/.test(nope.data?.error ?? ''), 'ولا تذكر رسالتُه اليمنَ وحدها');
ok(/الأردن/.test(nope.data?.error ?? ''), 'بل تعدّد الدول المدعومة');

console.log('\n── متجر أردني يعرض عملته هو ──');
const made = await j('POST', '/api/stores', {
  name: 'متجر عمّان للعطور',
  slug: 'amman-scents',
  sector: 'perfumes',
  city: 'عمّان',
  country: 'JO',
}, JO_SID);
ok(made.status === 201, `أُنشئ المتجر (${made.status}${made.data?.error ? ': ' + made.data.error : ''})`);

const shop = await j('GET', '/api/shop/amman-scents');
ok(shop.data?.store?.country === 'JO', 'الدولة محفوظة مع المتجر');
ok(shop.data?.store?.currency === 'د.أ', `والعملة مشتقّة منها (${shop.data?.store?.currency})`);
// رقم واتساب المتجر ورث رقم التاجر — ويجب أن يبقى أردنياً
ok(shop.data?.store?.whatsapp === '962791234567', 'ورقم واتساب دولي لا محلي');

console.log('\n── دولة غير مدعومة تُرفض بوضوح ──');
const bad = await j('PATCH', '/api/me/store', { country: 'ZZ' }, JO_SID);
ok(bad.status === 400, `رُفضت الدولة المجهولة (${bad.status})`);
const stillJO = await j('GET', '/api/shop/amman-scents');
ok(stillJO.data?.store?.country === 'JO', 'ولم تُفسد الدولة المحفوظة');

console.log('\n── متجر يمني قائم لم يتغيّر شيء عنده ──');
const yazan = await j('GET', '/api/shop/yazan');
ok(yazan.data?.store?.country === 'YE', 'بقي على اليمن');
ok(yazan.data?.store?.currency === 'ر.ي', 'وبقيت عملته الريال اليمني');

console.log('\n── صفحة المتجر المصيَّرة من الخادم تحمل العملة الصحيحة ──');
const page = await j('GET', '/amman-scents');
ok(/og:locale" content="ar_JO"/.test(page.text), 'og:locale يتبع الدولة');
ok(page.text.includes('+962791234567'), 'ورقم الهاتف في البيانات المنظّمة دولي');

// لا تنظيف: حذف المتجر الوحيد لتاجر مرفوض عمداً في الخادم
// (`LAST_STORE`)، وهو سلوك صحيح لا نلتفّ عليه من الفحص. ولهذا
// يعمل هذا الملف **أخيراً** في السلسلة، و`npm test` يبدأ بـ
// `npm run reset` فلا يبقى المتجر الأردني لتشغيل تالٍ.

console.log(`\n  نجح ${pass} · فشل ${fail}\n`);
process.exitCode = fail ? 1 : 0;
