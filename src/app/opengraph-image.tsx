import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/**
 * بطاقة المشاركة — ما يراه من يصل الرابط قبل أن يفتحه.
 *
 * ★ كانت `og:image` هي `logo.png`: ٨٩٥×٥٨٢، شعارٌ على شفافية.
 * فكل مشاركة على واتساب أو تويتر تعرض مربّعاً مقصوصاً بخلفية
 * يختارها التطبيق — وهي أوّل انطباع عن منصّة تبيع التصميم.
 * والمقاس المطلوب ١٢٠٠×٦٣٠، ولا أحد يلاحظ الفرق إلا حين يُشارَك
 * الرابط فعلاً، أي بعد فوات الأثر.
 *
 * ★ وتُولَّد بالكود لا بملفّ صورة: النصّ يتغيّر مع الوصف، ولا
 * يدخل المستودع أصلٌ ثنائي يُنسى تحديثه.
 *
 * قيود Satori المفروضة على ما تحت: flexbox وحده (لا grid)، ولا
 * متغيّرات CSS — فالألوان مكتوبة صراحةً هنا وهي نفسها في
 * `globals.css`. والخطّ يُمرَّر مخزناً: بلا ذلك تُرسم العربية
 * مربّعات فارغة.
 */
export const alt = 'RVIOS Store — أنشئ متجرك الإلكتروني مجاناً';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#241F1B';
const CREAM = '#FFFFFF';
const BRASS = '#C8A45D';
const SHOP = '#9E2226';
const SOFT = 'rgba(255,255,255,.62)';

export default async function OpengraphImage() {
  /**
   * ★ «تجوّل» الساكن لا «ريدكس» المتغيّر — وهذا قيد Satori لا اختيار.
   *
   * محرّك `ImageResponse` يحلّل الخطّ بنفسه، ومحلّله يعجز عن الخطوط
   * المتغيّرة: يرمي `Cannot read properties of undefined (reading
   * '256')` وهو يقرأ جدولاً لا وجود له في بنية متغيّرة. وGoogle لا
   * تنشر نسخةً ساكنة من «ريدكس» إطلاقاً (٤٠٤ على مسار static).
   *
   * فبطاقة المشاركة وحدها بوجهٍ غير وجه الموقع. وهو تنازلٌ صغير
   * مقصود: البديل بطاقةٌ تُرسم فيها العربية مربّعات فارغة. و«تجوّل»
   * ليس غريباً عن المشروع — كان خطّه الاحتياطي العربي قبل التبديل.
   */
  const arabic = await readFile(join(process.cwd(), 'public/fonts/Tajawal-Regular.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: INK,
          padding: '64px 72px',
          direction: 'rtl',
        }}
      >
        {/* القضيب النحاسي — العنصر التوقيعي نفسه، مسطَّحاً */}
        <div style={{ display: 'flex', height: 3, backgroundColor: BRASS, opacity: 0.55, width: 220 }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 62, color: CREAM, lineHeight: 1.25 }}>
            أنشئ متجرك الإلكتروني مجاناً
          </div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 30, color: SOFT, lineHeight: 1.5 }}>
            برابط يخصّك وحدك، وطلبات تصلك عبر واتساب — بلا عمولة على مبيعاتك.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, backgroundColor: SHOP }} />
            <div style={{ display: 'flex', marginRight: 14, fontSize: 26, color: CREAM, letterSpacing: 4 }}>
              RVIOS STORE
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: SOFT, direction: 'ltr' }}>
            rviosstore.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      /* ★ `new Uint8Array(buf)` لا `buf.buffer`.
         `readFile` تُعيد Buffer من مُجمَّع مشترك: خاصيّته `buffer`
         هي ذاكرة المُجمَّع كاملةً — أكبر من الملف بكثير، وبيانات
         الملف تبدأ عند `byteOffset` لا عند الصفر. فتمريرها يُسلّم
         Satori بايتات غريبة يقرؤها خطّاً معطوباً. */
      /* ★ `ArrayBuffer` مقصوصٌ بدقّة — لا `buf` ولا `buf.buffer`.
         `readFile` تُعيد Buffer من مُجمَّع مشترك: `buf.buffer` هي
         ذاكرة المُجمَّع كاملةً، وبيانات الملف تبدأ عند `byteOffset`
         لا عند الصفر — فيقرأ المحلّل ترويسةً ليست ترويسة خطّ.
         والقصّ يُخرج بايتات الملف وحدها في ArrayBuffer مستقلّ. */
      /* البايتات مقصوصةٌ بدقّة: `readFile` تُعيد Buffer من مُجمَّع
         مشترك، و`buf.buffer` هي ذاكرة المُجمَّع كاملةً لا الملف. */
      fonts: [{
        name: 'Tajawal',
        data: arabic.buffer.slice(arabic.byteOffset, arabic.byteOffset + arabic.byteLength) as ArrayBuffer,
        weight: 400,
        style: 'normal',
      }],
    },
  );
}
