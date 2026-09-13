import { Fragment, type ReactNode } from 'react';

/**
 * ظهور العنوان كلمةً كلمة من خلف قناع.
 *
 * الفرق بينه وبين تلاشٍ عادي أنّ الكلمة **تصعد من تحت حافّة**
 * لا تظهر في مكانها: العين تقرأ ارتفاعاً مادّياً لا تغيّر
 * عتامة. وهذا هو الأثر كلّه — سطر واحد من الحركة يفصل عنواناً
 * مصنوعاً عن عنوان مكتوب.
 *
 * ★ الحركة بـCSS لا بـJavaScript، وهذا قرار سلامة لا تفضيل
 *   أسلوب. مكتبة الحركة تكتب حالة البداية أسلوباً سطرياً على
 *   العنصر — أي `translateY(110%)` داخل قناع — ثم تعتمد على
 *   حلقة إطارات لتُزيلها. فإن لم تعمل تلك الحلقة (JS تعطّل،
 *   ترطيب فشل، تبويب غير مرسوم) بقي **عنوان الصفحة الأول
 *   مختفياً إلى الأبد** بلا خطأ واحد يُنبّه. أما هنا فالحالة
 *   النهائية هي الأصل، و`animation-fill-mode: both` هي التي
 *   تُنزل الكلمة تحت القناع للحظة — فأسوأ ما يقع أن تظهر
 *   الكلمات بلا صعود. وهو ما يقوله تعليق `Reveal` نفسه.
 *
 * ★★ وربحٌ ثانٍ: العنوان يبقى مكوّناً خادمياً بلا حدّ عميل،
 *    فلا يُشحن لأجله بايت واحد من JS.
 *
 * القناع `overflow-hidden` على غلاف كل كلمة، والغلاف
 * `inline-block` كي يبقى الالتفاف العربي طبيعياً ولا تُكسر
 * الكلمة عند حافّة السطر. والمسافة بين الكلمتين **خارج**
 * القناع: لو وُضعت داخله لابتلعها `inline-block` والتصقت
 * الكلمتان.
 *
 * ★★★ الحشو والهامش السالب (`--mask`) ليسا ضبطاً بصرياً بل
 *     شرطُ عمل القناع أصلاً. صندوق السطر يُحسب من مقاييس الخطّ،
 *     و«مغفرة» خطّ عربي مزخرف تتجاوز نزلاتُه وصعودُه ذلك
 *     الصندوق بوضوح — فيقصّ `overflow-hidden` أذيال الحروف
 *     ويُقرأ العنوان مبتوراً. الحشو يوسّع الصندوق ليسع المحرف
 *     كاملاً، والهامش السالب يُعيد ما أضافه إلى تباعد الأسطر —
 *     فيتّسع القناع ولا يتباعد السطران. ولأن الكلمة تنزاح
 *     بنسبة من ارتفاعها هي لا بقيمة ثابتة، تبقى خارج القناع
 *     تماماً مهما اتّسع.
 */
export function Words({
  text,
  delay = 0,
  step = 0.075,
  className,
}: {
  text: string;
  delay?: number;
  step?: number;
  className?: string;
}) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span
            className="inline-block overflow-hidden align-bottom
                       [--mask:.26em] mt-[calc(var(--mask)*-1)] mb-[calc(var(--mask)*-1)]"
          >
            <span
              className="inline-block pt-[var(--mask)] pb-[var(--mask)] [animation:rv-word_.9s_both]
                         [animation-timing-function:cubic-bezier(.16,1,.3,1)]"
              style={{ animationDelay: `${delay + i * step}s` }}
            >
              {w}
            </span>
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * شعرة تُرسم تحت كلمة.
 *
 * تنمو من جهة القراءة (اليمين في RTL) بعد أن تستقرّ الكلمة
 * فوقها — لا معها. التزامن يجعلهما حدثاً واحداً مزدحماً؛
 * والتأخير يجعلها **تعليقاً** على ما قيل للتوّ.
 */
export function Underline({
  children,
  delay = 0.9,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className ?? ''}`}>
      {children}
      <i
        aria-hidden
        className="absolute inset-x-0 -bottom-1.5 block h-px origin-right bg-gradient-to-l
                   from-brass/0 via-brass to-brass/0
                   [animation:rv-rule_1.1s_both] [animation-timing-function:cubic-bezier(.16,1,.3,1)]"
        style={{ animationDelay: `${delay}s` }}
      />
    </span>
  );
}
