# برومتات صور بطاقات قسم «ما تحصل عليه»

ثمانية برومتات لتوليد صورة لكل بطاقة في `FEATURES` بـ [sections.tsx](../src/components/marketing/sections.tsx).

| القرار | القيمة |
| --- | --- |
| المولّد | Nano Banana / Gemini |
| الأسلوب | رسم متجهي مسطّح على هوية RVIOS |
| النص داخل الصورة | لا شيء إطلاقاً |
| النسبة | 3:4 طولية |

قيم الألوان منقولة حرفياً من `@theme inline` في [globals.css](../src/app/globals.css) — لا تُبدّل واحدة منها بلون «قريب»، فالغرض أن تجلس الصورة داخل البطاقة لا فوقها.

**لماذا البرومت بالإنجليزية:** المولّد يلتزم بقيم HEX وبمفردات الأسلوب المسطّح التزاماً أعلى بكثير بالإنجليزية؛ والبرومت العربي يجرّه نحو زخرفة شرقية لم تُطلب. فوق كل برومت سطرٌ عربي يقول ما تصوّره البطاقة.

---

## كيف تُستعمل

1. الصق **كتلة الأسلوب المشتركة** ثم برومت البطاقة تحتها، وسطر النفي في آخره أو في خانة negative prompt.
2. ولّد **البطاقة ١ أولاً**، وأعِدها حتى ترضى عنها — فهي مرجع المجموعة كلها.
3. مع البرومتات السبعة الباقية أرفق الصورة الأولى كصورة مرجعية وأضف هذا السطر:
   `match the exact illustration style, stroke weight and palette of the attached reference image`
   بدون هذه الخطوة ستخرج ثماني صور من ثمانية أساليب مختلفة.
4. احفظ الناتج WebP في `public/images/features/` بالأسماء الموضوعة تحت كل بطاقة.

---

## كتلة الأسلوب المشتركة

```text
Flat vector illustration, editorial and minimal. Geometric shapes with uniform thin
outlines, no gradients, no 3D, no photorealism, no gloss, no texture noise.
Strict palette, use these exact colors only:
  background #F8F7F4, raised surfaces #FFFFFF, secondary fill #EFEDE7,
  all outlines #DCD8CF, dark shapes #241F1B, muted shapes #6B6259,
  gold accent #C8A45D, deep gold #876522, and a single crimson accent #9E2226.
Crimson is the focal color — it must appear on exactly one element and nowhere else.
Portrait 3:4 composition, subject centered and sitting slightly above center,
generous empty margins on all four sides, the illustration must stay readable when
scaled down to 300px wide.
Absolutely no text, no letters, no Arabic or Latin characters, no numbers, no logos,
no watermarks, no UI labels of any kind — shapes only.
```

## سطر النفي

```text
no text, no letters, no numbers, no logos, no watermark, no gradients, no drop
shadows, no 3D render, no photograph, no glossy plastic, no neon, no blue tones,
no green tones, no purple, no clutter, no busy background
```

---

## ١ — رابط يخصّك وحدك

> رابط واحد ينطلق من ملفك الشخصي فيفتح متجرك أنت وحدك.
> `01-link.webp`

```text
A single continuous ribbon-like line rising from a small rounded profile circle at the
bottom of the frame, curving upward and ending at a small storefront card at the top —
the storefront drawn as a simple white rectangle with a scalloped awning. The ribbon is
gold #C8A45D and unbroken along its whole path. The awning is the single crimson #9E2226
element. Two faint outlined chat-bubble shapes sit far behind in #EFEDE7 to suggest the
link being shared, kept small and unobtrusive. The composition reads as one path from one
person to one shop — nothing branches, nothing duplicates.
```

## ٢ — طلباتك عبر واتساب

> الطلب يُسجَّل عندنا برقم مرجعي ثم يصلك جاهزاً في محادثة.
> `02-whatsapp-orders.webp`

```text
A narrow vertical receipt slip with a torn zigzag bottom edge, drawn in white #FFFFFF with
#DCD8CF outlines and three short muted #6B6259 bars standing in for lines of an order — the
bars are plain rectangles, never letters. A small rounded tag shape in gold #C8A45D is
clipped to the top corner of the slip, representing the reference number. The slip is
sliding into a large rounded speech bubble outlined in #241F1B that occupies the upper half
of the frame; the bubble's tail points down-left. The bubble's inner fill is the single
crimson #9E2226 element, kept as a soft flat tint. Neutral generic messaging shape — do not
imitate any real messaging app's logo or brand color.
```

## ٣ — لونك يصبغ المتجر كله

> لون واحد يشتقّ لوحة كاملة: أسطحاً وحدوداً ونصوصاً.
> `03-color.webp`

```text
A single round drop of crimson #9E2226 falling from the top of the frame — this is the only
crimson element and the visual origin of everything below it. Beneath it, four stacked
rounded panels fan out like cards in a deck, each one a progressively lighter flat tint
derived from that same crimson, from a deep muted rose down to a barely-there blush, all
outlined in #DCD8CF. A slim vertical ladder of small square swatches runs along one side
showing the same derivation in steps. The idea is one color becoming an entire palette:
surfaces, borders and text tones — not a single button being colored.
```

## ٤ — خيارات لكل منتج

> مقاسات وألوان بأسعار مختلفة للمنتج الواحد، ومؤشر توفّر صادق لكل خيار.
> `04-variants.webp`

```text
One simple product silhouette centered in the upper portion — a plain folded garment shape
in #EFEDE7 with #DCD8CF outlines. Below it, a vertical stack of three option rows; each row
is a rounded pill outlined in #DCD8CF containing a small circular swatch on one side and a
short gold #C8A45D bar on the other standing in for a price. The middle pill is the selected
one: its outline and its swatch are the single crimson #9E2226 element. Each row carries a
small availability dot at its edge — two dots solid #241F1B, the bottom one hollow with only
an outline to read as unavailable. The honesty of that hollow dot is the point of the image.
```

## ٥ — لوحة تحكّم كاملة

> منتجاتك وطلباتك وإعداداتك في مكان واحد، من جوالك أو حاسوبك.
> `05-dashboard.webp`

```text
Two device frames overlapping slightly: a tall rounded phone outline in front, a wider
laptop-screen rectangle behind, both drawn as simple white #FFFFFF shapes with #DCD8CF
outlines and no bezel detail. Both screens carry the exact same abstract layout — one wide
header band, a two-by-two grid of rounded tiles, and a short side rail of small squares —
all filled #EFEDE7, so the eye reads one dashboard shown twice rather than two products. A
single tile in the phone's grid is filled crimson #9E2226 as the active panel; one small
gold #C8A45D square marks the side rail. No app icons, no menu bars, no readable content.
```

## ٦ — إحصائيات متجرك

> زوّار ومنتجات أكثر طلباً ومبيعات — أرقام حقيقية لا تقديرات.
> `06-stats.webp`

```text
A clean bar chart of five rounded vertical bars rising left to right across the lower half
of the frame, drawn in #EFEDE7 with #DCD8CF outlines; the tallest bar is filled crimson
#9E2226 and is the only crimson element. A thin gold #C8A45D line traces over the bar tops
as a trend line and ends in a small solid dot above the tallest bar. In the upper area, a
single open ring shape in #6B6259 with a gold #C8A45D arc segment stands in for a share of
visitors. No axes with tick labels, no numbers, no percentages — the shapes alone carry the
meaning. Composition stays airy, never a dense analytics dashboard.
```

## ٧ — صور تُرفع مضغوطة

> الصور تُهيَّأ قبل الرفع فيفتح متجرك سريعاً على شبكة بطيئة.
> `07-images.webp`

```text
A large image tile at the bottom of the frame — a white #FFFFFF rounded rectangle outlined
in #DCD8CF, containing the classic simplified picture glyph: a small circle for a sun and two
overlapping triangles for mountains, in #EFEDE7. Above it, a narrowing funnel drawn as two
converging thin #DCD8CF lines, through which the tile passes and emerges at the top as a much
smaller version of the same tile, this one outlined in gold #C8A45D. A slim upward arrow in
crimson #9E2226 sits beside the small tile as the single crimson element, indicating the fast
upload. Three short horizontal speed lines in #EFEDE7 trail behind the small tile. The story
is one image becoming lighter, not two different images.
```

## ٨ — أمان ونسخ احتياطي

> حقٌّ في كل الباقات بما فيها المجانية، لا ميزة تُباع في الأعلى.
> `08-security.webp`

```text
A broad shield shape centered in the frame, drawn in white #FFFFFF with a #241F1B outline and
a small closed padlock in gold #C8A45D at its center. Behind the shield, two identical shield
outlines are offset upward and to the side in #EFEDE7, reading as duplicate backup copies. A
thin circular arrow in crimson #9E2226 loops once around the whole group as the single crimson
element, suggesting a repeating backup cycle. Underneath, a short row of three small equal
rounded squares in #EFEDE7 with #DCD8CF outlines — equal in size and identical in weight, so
none reads as a premium tier. Calm and reassuring, never alarming, no warning symbols.
```

---

## التحقق بعد التوليد

- اعرض كل صورة بعرض 300px (عرض البطاقة الفعلي على `lg:grid-cols-4`) وتأكّد أن الشكل ما يزال مقروءاً.
- تأكّد أن الأحمر `#9E2226` ظهر على **عنصر واحد فقط** في كل صورة — إن تعدّد ضاع مركز البصر داخل البطاقة.
- تأكّد أن خلفية الصورة `#F8F7F4` تطابق `--color-paper` فتذوب حافة الصورة في البطاقة بدل أن تُقرأ مربّعاً ملصوقاً.
- افحص الثماني جنباً إلى جنب: أي صورة تختلف في سُمك الخط أو كثافة التفاصيل تُعاد بالصورة المرجعية.

## ملاحظة على تخطيط البطاقة

الشبكة الحالية `sm:grid-cols-2 lg:grid-cols-4` مع أيقونة `size-11`. صورة 3:4 طولية لا تسكن هذه البطاقة كما هي: ستحتاج البطاقة صورة علوية بعرض كامل داخل `aspect-[3/4]`، وغالباً شبكة أقل تكثيفاً (ثلاثة أعمدة على `lg`). تعديل [sections.tsx](../src/components/marketing/sections.tsx) لم يُنفَّذ — هذا الملف برومتات فقط.
