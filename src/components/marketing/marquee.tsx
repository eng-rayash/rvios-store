'use client';

import { Children, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

/**
 * شريط متحرّك لا ينقطع.
 *
 * كان انزلاقاً بـ`@keyframes` — يتحرّك ولا يُلمس. صار محمولاً على
 * Embla بإضافة `AutoScroll`، والفرق ليس في المظهر بل في أن
 * الشريط صار **جسماً**: يُسحب بالإصبع فيتبع اليد ثم يستأنف
 * زحفه، ويقف تحت المؤشّر، ويقف حين يدخله التنقّل بلوحة
 * المفاتيح فلا يهرب الرابط من تحت من يتصفّح بالـTab. وهذا آخر
 * ما يفعله الزائر على الجوال غريزةً: يمرّر الشريط بيده.
 *
 * ومع `prefers-reduced-motion` يعود شريطاً يُمرَّر باليد بلا
 * حركة ذاتية ولا نسخ مكرّرة — المحتوى كاملٌ ولا يُحرم أحد منه.
 */

/**
 * ★ التكرار شرط دوران لا زينة.
 *
 * `loop` في Embla لا يعمل إلا إن كان مجموع عرض الشرائح أكبر من
 * الإطار؛ وثمانية متاجر على شاشة عريضة لا تملؤها، فيقف الشريط
 * ساكناً بلا خطأ واحد في السجلّ. النسخ تضمن الامتلاء في كل عرض،
 * وهو ما كانت تفعله النسخة القديمة أصلاً بنسختين ثابتتين.
 *
 * والنسخ الزائدة `inert`: خارج مسار الـTab وخارج شجرة الوصول،
 * فلا يمرّ قارئ الشاشة على المتاجر نفسها ثلاث مرّات. (النسخة
 * السابقة استعملت `aria-hidden` وحدها — وهي تُخفي الرابط عن
 * القارئ وتُبقيه قابلاً للتركيز، وذاك أسوأ من الحالين.)
 */
/**
 * ★ السرعة بالبكسل لكل إطار، و`0.4` ليست رقماً عشوائياً: هي
 *   ٢٤ بكسلاً في الثانية، أي زمن الدورة نفسه الذي كانت تقطعه
 *   نسخة `@keyframes` القديمة (٤٦ ثانية للنسخة الواحدة). تغيّرت
 *   الآلة ولم يتغيّر إيقاع الصفحة.
 */
export function Marquee({ children, speed = 0.4 }: { children: ReactNode; speed?: number }) {
  const reduced = useReducedMotion();
  const items = Children.toArray(children);

  if (reduced || items.length === 0) {
    return (
      <div className="wrap flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    );
  }

  const copies = Math.max(2, Math.ceil(12 / items.length));

  return (
    <div className="[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <Carousel
        opts={{ loop: true, align: 'start', dragFree: true, skipSnaps: true }}
        plugins={[
          AutoScroll({
            playOnInit: true,
            speed,
            startDelay: 0,
            stopOnInteraction: false,   // يستأنف بعد السحب
            stopOnMouseEnter: true,     // ويقف ليُقرأ تحت المؤشّر
          }),
        ]}
      >
        <CarouselContent className="ms-0">
          {Array.from({ length: copies }, (_, copy) =>
            items.map((item, i) => (
              <CarouselItem
                key={`${copy}-${i}`}
                inert={copy > 0}
                className="basis-auto ps-0 pe-4"
              >
                {item}
              </CarouselItem>
            )),
          )}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
