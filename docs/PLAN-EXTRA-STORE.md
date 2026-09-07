# خطة: المتجر الإضافي (باقة برو)

**الحالة:** ✅ **مُنفَّذ ومُختبَر** — ٣٩ فحصاً في [`test/stores.mjs`](test/stores.mjs)
**المرجع:** تقرير الباقات والتسعير §٢ و§٦.٢ · المواصفة التقنية §٢.١

## ما نُفِّذ فعلاً

| البند | الحالة |
|---|---|
| تصحيح نموذج التسعير (`canBuyExtraStores`) | ✅ |
| `merchants.store_slots` · `sessions.active_store_id` | ✅ |
| `requireStore` بثلاث درجات | ✅ |
| قيد الخانات بدل الرفض المطلق | ✅ |
| وراثة الباقة + `ensureSubscription` عند الإنشاء | ✅ |
| `grantStoreSlot` / `revokeStoreSlot` مربوطتان بـ`extra_store` | ✅ |
| `POST /api/me/active-store` · `GET /api/me/stores` | ✅ |
| ترويسة `X-Store` من الواجهة | ✅ |
| مبدّل المتاجر في الشريط العلوي | ✅ |
| `?new=1` لإنشاء متجر ثانٍ | ✅ |
| فصل حذف المتجر عن حذف الحساب | ✅ |
| مقاييس الإدارة بالتجار لا بالمتاجر | ✅ |

**الافتراضات المتَّخذة:** سقف ٥ متاجر · المتجر الإضافي يرث باقة الحساب ·
انتهاء برو يُخفي ولا يحذف. غيّرها في `MAX_STORE_SLOTS` و`src/routes/auth.js`.

---

## الخطة الأصلية

---

## السياق

باقة برو **تَعِد صراحةً** بـ«أكثر من متجر واحد» في صفحة الأسعار وفي `PLANS.pro.features`،
بينما [`src/routes/auth.js:105`](src/routes/auth.js) يرفض المتجر الثاني لكل الباقات بلا استثناء:

```js
const existing = db.prepare('SELECT id FROM stores WHERE merchant_id = ?').get(merchant.id);
if (existing) bad('لديك متجر بالفعل');
```

وعدٌ معلن بلا تنفيذ. هذه الخطة تغلقه.

---

## ١. تصحيح نموذج التسعير أولاً

تقرير الباقات يحسم تناقضاً قائماً في الكود:

| المصدر | ما يقوله |
|---|---|
| `PLANS.pro.extraStores = 1` | برو **تشمل** متجراً ثانياً مجاناً |
| `ADDONS` → «متجر إضافي» | **رسوم شهرية** |
| تقرير الباقات §٢ | «متجر إضافي · بسعر **مخفّض**» |
| تقرير الباقات §٦.٢ | **$٣ شهرياً** |

**النموذج الصحيح:** برو **تفتح الإمكانية**، وكل متجر إضافي يُشترى بـ$٣ شهرياً.
لا يوجد متجر مجاني مشمول.

**التعديل المطلوب في [`src/plans.js`](src/plans.js):**

```js
// بدل extraStores: 1  (تعني «واحد مجاني»)
canBuyExtraStores: true,      // برو فقط
maxExtraStores: 5,            // سقف تشغيلي، لا وعد بالمجانية
```
وتصحيح نص الميزة من «أكثر من متجر واحد» إلى **«متاجر إضافية بسعر مخفّض»**
كي لا يفهم التاجر أنها مشمولة.

> `extraStores` حقل ميت اليوم: مُعرَّف في ثلاث باقات، ومقروء في مكان واحد فقط
> ([`page-pricing.js:17`](public/assets/js/page-pricing.js)) للعرض، ولا يُفحص في الخادم إطلاقاً.

---

## ٢. الاستحقاق: خانات لا أعلام

المتاجر الإضافية تُشترى، فالعدد المسموح يجب أن يكون **رقماً مملوكاً للحساب** لا مشتقاً من الباقة.

**تعديل المخطط** في [`src/db.js`](src/db.js):

```sql
ALTER TABLE merchants ADD COLUMN store_slots INTEGER NOT NULL DEFAULT 1;
```

- كل تاجر يبدأ بخانة واحدة
- فاتورة `extra_store` مدفوعة ← `store_slots += 1`
- إلغاء الفاتورة ← `store_slots -= 1` (مع حماية: لا تنزل تحت عدد المتاجر القائمة)

**لماذا خانة لا حساب من الباقة:** لو اشتق العدد من `plan` لحظياً، لفقد التاجر متجره الثاني
لحظة انتهاء اشتراك برو — وهذا يخالف §٥.٥ «إخفاء لا حذف». الخانة مملوكة، وانتهاء برو
يُخفي المتجر الإضافي ولا يمحوه.

---

## ٣. حلّ «المتجر النشط» — جذر المشكلة

[`src/auth.js:178`](src/auth.js) هو الموضع الأهم في المشروع:

```js
const store = db.prepare('SELECT * FROM stores WHERE merchant_id = ? ORDER BY id LIMIT 1').get(m.id);
```

`ORDER BY id LIMIT 1` يختار **أقدم** متجر ويتجاهل الباقي بصمت. تمر منه **٢١ مساراً**
في [`src/routes/merchant.js`](src/routes/merchant.js)، ولا يقرأ أي معرّف متجر من الطلب.

### الحل: ترتيب حلّ من ثلاث درجات

```js
export function requireStore(req) {
  const m = requireMerchant(req);
  const stores = db.prepare('SELECT * FROM stores WHERE merchant_id = ? ORDER BY id').all(m.id);
  if (!stores.length) throw new HttpError(409, 'لم تُنشئ متجرك بعد', 'NO_STORE');

  // ١) صريح من الطلب  ٢) محفوظ في الجلسة  ٣) الأقدم
  const asked = req.headers['x-store'] ?? req.query?.get('store');
  const store = (asked && stores.find((s) => s.slug === asked || String(s.id) === String(asked)))
             ?? stores.find((s) => s.id === sessionActiveStore(req))
             ?? stores[0];

  if (store.status === 'suspended') throw new HttpError(403, 'هذا المتجر موقوف — تواصل مع الدعم');
  return { merchant: m, store, stores };
}
```

**لماذا هذا الترتيب:**

| الدرجة | الغرض |
|---|---|
| ترويسة `X-Store` | تبويبان على متجرين مختلفين يعملان معاً بلا تعارض |
| `sessions.active_store_id` | يتذكّر اختيار التاجر بين الزيارات |
| أقدم متجر | يحافظ على سلوك اليوم حرفياً لأصحاب المتجر الواحد |

**الأثر:** تعديل دالة واحدة. **الـ٢١ مساراً لا تتغيّر إطلاقاً** — كلها تستقبل
`{ store }` كما هي اليوم، ويستمر `scope(store.id)` في فرض العزل دون تغيير.

**تعديل المخطط:**
```sql
ALTER TABLE sessions ADD COLUMN active_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL;
```

### مسار التبديل
```
POST /api/me/active-store   { store: "slug-or-id" }
→ يتحقق من الملكية، يكتب sessions.active_store_id، يعيد المتجر الجديد
```

---

## ٤. الواجهة: مبدّل في الشريط العلوي

الشريط العلوي اليوم ([`public/dashboard.html`](public/dashboard.html)) يحمل شريحة الرابط
`#shopLink` وكتلة `.who`. المبدّل يحل محل شريحة الرابط الساكنة:

```
[شعار المتجر ▾]  متجر ذو يزن للعطور        rviosstore.com/yazan  [نسخ]   [ذو يزن]
       └─ قائمة: متجر ذو يزن ✓ · بوتيك ريّان · ＋ أضف متجراً
```

- يظهر المبدّل **فقط** إن ملك التاجر أكثر من متجر — صاحب المتجر الواحد لا يرى تغييراً
- اختيار متجر ← `POST /api/me/active-store` ← إعادة تحميل بيانات اللوحة
- `applyTheme(STORE)` يُعاد استدعاؤه فيتغيّر لون اللوحة مع المتجر — إشارة بصرية فورية
  أنك في متجر آخر (يمنع تعديل منتج في المتجر الخطأ)

**تعديلات [`dashboard.js`](public/assets/js/dashboard.js):**
- `boot()` يقرأ `me.stores` (جمع) بدل `me.hasStore` (مفرد)
- `loadStore()` يملأ المبدّل من `res.stores`
- إضافة `switchStore(slug)` تستدعي المسار ثم تعيد `Promise.all([...])` نفسها الموجودة في `boot()`

**تعديل [`app.js`](public/assets/js/app.js):** إرسال `X-Store` في كل نداء — نقطة واحدة،
لأن كل الطلبات تمر من `request()`.

---

## ٥. الفوترة: من فاتورة مدفوعة إلى متجر فعلي

`extra_store` **نوع فاتورة معرَّف وقابل للدفع بالكامل اليوم** ([`src/billing.js:127`](src/billing.js))،
لكن `submitProof` و`markPaid` يتعاملان مع `kind === 'subscription'` فقط — فهو
**يُدفع ثم لا يفعل شيئاً**.

**المطلوب في [`src/billing.js`](src/billing.js):**

```js
// داخل submitProof() و markPaid()
if (inv.kind === 'extra_store') grantStoreSlot(inv.store_id);
// وداخل voidInvoice()
if (inv.kind === 'extra_store') revokeStoreSlot(inv.store_id);
```

`grantStoreSlot` يزيد `merchants.store_slots` للتاجر المالك.
`revokeStoreSlot` ينقص، **ولا ينزل تحت عدد المتاجر القائمة** — الرفض يمنع متجراً جديداً
ولا يحذف قائماً.

**شرط الشراء:** الفاتورة تُرفض إن لم يكن المتجر الحالي على برو
(`canBuyExtraStores`) — بنفس نمط `PRICE_UNSET` القائم.

---

## ٦. إنشاء المتجر الثاني

استبدال القيد في [`src/routes/auth.js:105`](src/routes/auth.js):

```js
const owned = db.prepare('SELECT COUNT(*) n FROM stores WHERE merchant_id = ?').get(merchant.id).n;
if (owned >= merchant.store_slots) {
  bad('بلغتَ عدد المتاجر المتاح في حسابك. اشترِ خانة متجر إضافي من قسم الاشتراك.', 'NO_STORE_SLOT');
}
```

**ثلاث نقاط في نفس المسار تحتاج انتباهاً:**

1. **الباقة الموروثة** — سطر ١١٩ يثبّت `plan: 'basic'`. المتجر الإضافي المدفوع
   يجب أن يرث باقة الحساب (برو)، وإلا اشترى التاجر خانة بـ$٣ وحصل على متجر مجاني الحدود.
2. **اسم التاجر** — سطر ١٣٨ يحدّث `merchants.name` عند الإنشاء؛ يجب ألا يُكتب فوقه عند المتجر الثاني.
3. **الاشتراك** — `ensureSubscription(storeId)` **لا تُستدعى عند إنشاء المتجر أصلاً**
   (تُستدعى فقط من `activatePlan`). المتجر الجديد يحتاج صف اشتراك.

**تدفق الإعداد:** [`onboarding.js:283`](public/assets/js/onboarding.js) يعيد التوجيه فوراً
إن `me.hasStore` — يجب أن يسمح بالمرور حين توجد خانة شاغرة، مع تخطي خطوتَي الجوال والرمز
(التاجر مسجّل أصلاً).

---

## ٧. إصلاح خلل قائم يظهر عند التعدد

[`src/routes/merchant.js:364`](src/routes/merchant.js) — حذف الحساب:

```js
const { merchant, store } = requireStore(req);
if (clean(body.confirm, 40) !== store.slug) bad(`اكتب «${store.slug}» بالضبط لتأكيد الحذف`);
...
db.prepare('DELETE FROM stores WHERE merchant_id = ?').run(merchant.id);   // ← كل المتاجر
```

**التأكيد أحادي والحذف جماعي.** اليوم غير ضار (متجر واحد)، ومع التعدد يعني:
تاجر بثلاثة متاجر يمحوها كلها بكتابة اسم أحدها.

**الإصلاح:** فصل العمليتين —
- `DELETE /api/me/stores/:id` لحذف متجر واحد (تأكيد بـslugه)
- `DELETE /api/me/account` لحذف الحساب (تأكيد بعبارة صريحة مثل «حذف حسابي»، مع تعداد
  المتاجر التي ستُحذف)

---

## ٨. لوحة الإدارة

اليوم [`admin.js:65`](src/routes/admin.js) يعرض صفاً لكل متجر — تاجر بثلاثة متاجر يظهر
اسمه ورقمه مكرراً ثلاث مرات. والإحصاءات كلها مقسومة على **عدد المتاجر** لا التجار
(`activationRate`, `upgradeRate`)، وهو صحيح فقط عند تطابق العددين.

**الحد الأدنى:** عمود «متاجر التاجر» في جدول المتاجر، وتصحيح مقامات النسب
لتقسم على عدد التجار حيث يكون ذلك هو المقصود.

---

## ٩. الملفات المتأثرة

| الملف | التغيير |
|---|---|
| `src/db.js` | عمودان: `merchants.store_slots` · `sessions.active_store_id` |
| `src/auth.js` | `requireStore` بثلاث درجات · `sessionActiveStore` |
| `src/plans.js` | `canBuyExtraStores` بدل `extraStores` · تصحيح نص الميزة |
| `src/billing.js` | `grantStoreSlot` / `revokeStoreSlot` · ربطهما بـ`extra_store` |
| `src/routes/auth.js` | قيد الخانات بدل الرفض المطلق · وراثة الباقة · `ensureSubscription` |
| `src/routes/merchant.js` | `POST /api/me/active-store` · فصل حذف المتجر عن حذف الحساب |
| `src/routes/admin.js` | عمود عدد المتاجر · تصحيح مقامات النسب |
| `public/assets/js/app.js` | إرسال `X-Store` في كل نداء |
| `public/dashboard.html` + `dashboard.js` + `dash.css` | مبدّل المتاجر |
| `public/assets/js/onboarding.js` | السماح بمتجر ثانٍ عند وجود خانة |
| `test/stores.mjs` | **جديد** — مجموعة فحوص للتعدد |

**لا يتغيّر:** [`src/tenancy.js`](src/tenancy.js) بالكامل — `scope()` تعزل متجراً عن متجر
ولو كانا لنفس التاجر، وهذا هو المطلوب بالضبط.

---

## ١٠. الفحوص

مجموعة جديدة `test/stores.mjs`:

- تاجر بخانة واحدة يُرفض متجره الثاني بـ`NO_STORE_SLOT`
- فاتورة `extra_store` مدفوعة تمنح خانة، والمتجر الثاني ينجح
- المتجر الثاني يرث باقة برو لا بيسك
- `X-Store` يبدّل السياق: منتجات المتجر أ لا تظهر تحت المتجر ب
- ترويسة لمتجر **لا يملكه** التاجر ← يسقط للافتراضي، لا تسريب
- `POST /api/me/active-store` يثبّت الاختيار عبر الطلبات التالية
- إلغاء فاتورة الخانة لا يحذف متجراً قائماً
- انتهاء اشتراك برو يُخفي المتجر الإضافي ولا يمحوه (§٥.٥)
- حذف متجر واحد لا يمس الآخر
- حذف الحساب يعدّد المتاجر ويطلب تأكيداً صريحاً

**فحص العزل الحاسم:** تاجر يملك متجرين — طلب على المتجر أ يجب ألا يرى صفاً واحداً
من المتجر ب. هذا ما تضمنه `scope()` أصلاً، والفحص يوثّقه.

---

## ١١. الترتيب المقترح

| # | الخطوة | لماذا هنا |
|---|---|---|
| ١ | تصحيح `plans.js` ونص الميزة | يوقف الوعد الخاطئ فوراً، بلا كود جديد |
| ٢ | `store_slots` + `active_store_id` + `requireStore` | الأساس؛ بعده كل شيء ممكن |
| ٣ | قيد الإنشاء + وراثة الباقة | المتجر الثاني يصبح قابلاً للوجود |
| ٤ | ربط `extra_store` بمنح الخانة | يصبح قابلاً للشراء |
| ٥ | مبدّل الواجهة | يصبح قابلاً للاستخدام |
| ٦ | فصل حذف المتجر عن الحساب | يغلق الخلل قبل أن يصبح ضاراً |
| ٧ | لوحة الإدارة | آخر ما يتأثر |

---

## قرارات تنتظر حسمك

| القرار | الخيارات | أثره |
|---|---|---|
| **سقف المتاجر لكل حساب** | ٣ · ٥ · بلا سقف | يمنع إساءة استخدام لم تحسب لها |
| **باقة المتجر الإضافي** | يرث برو · يبدأ بيسك ويُرقّى منفصلاً | الأول أبسط ويطابق «$٣ بسعر مخفّض» |
| **عند انتهاء برو** | يُخفى الإضافي · يبقى بحدود بيسك | §٥.٥ ترجّح الإخفاء |
| **السعر** | $٣ شهرياً (التقرير) | يُضبط في `platform_settings` بلا نشر |
