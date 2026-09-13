'use client';

import { useRef, type CSSProperties } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';

/**
 * الوصلة بين المشهد الأول وبرهانه.
 *
 * أربع طبقات تنزلق بسرعات مختلفة مع التمرير، فتُقرأ المسافة
 * بين الهيرو وشريط المتاجر عمقاً لا فاصلاً فارغاً: الهالة
 * والحبيبات في العمق تتحرّك أكثر، والحلقات دونها، والوشم
 * أقلّ، والسطح الفاتح يصعد عكسها حتى يبتلع الظلام ويسلّم
 * الصفحة إلى القسم الفاتح تحته.
 *
 * القرار المهمّ هنا ما **لم** يُضَف: لا GSAP ولا ScrollTrigger
 * ولا Lenis. المكتبة الوحيدة هي Motion الموجودة أصلاً في
 * الحزمة، و`useScroll` يربط الحركة بموضع التمرير الحقيقي —
 * فلا تُخطف عجلة الزائر، ولا يتعارض شيء مع شريط التقدّم في
 * LandingChrome ولا مع `scroll-behavior: smooth` والمرابط.
 * والطبقات كلها CSS: صفر بايت صور وصفر طلب شبكة.
 *
 * ومع `prefers-reduced-motion` تثبت الطبقات في مكانها — المشهد
 * يبقى، والحركة وحدها تسقط.
 */
export function ParallaxSeam() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // صفر حين يلامس أعلى الوصلة أسفل الشاشة، وواحد حين يغادر أسفلها أعلاها
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const back  = useTransform(scrollYProgress, [0, 1], ['-13%', '13%']);
  const rings = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  const mark  = useTransform(scrollYProgress, [0, 1], ['-4%', '4%']);
  const sheet = useTransform(scrollYProgress, [0, 1], ['15%', '-4%']);

  /** الطبقة تُحرَّك رأسياً فقط — فلا فرق بين RTL وLTR */
  const layer = (y: MotionValue<string>): CSSProperties | undefined =>
    reduced ? undefined : ({ y, willChange: 'transform' } as unknown as CSSProperties);

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative isolate min-h-[clamp(240px,38vh,380px)] overflow-hidden bg-ink"
    >
      {/* ١ · العمق: الهالتان والحبيبات — امتداد لأرضية الهيرو نفسها */}
      <motion.div style={layer(back)} className="pointer-events-none absolute inset-x-0 -inset-y-[26%]">
        <div className="absolute -top-[10%] -end-[12%] size-[46vw] rounded-full bg-shop/35 blur-[110px]" />
        <div className="absolute -bottom-[8%] -start-[10%] size-[40vw] rounded-full bg-brass/20 blur-[120px]" />
        <div className="grain absolute inset-0 [--grain:.16]" />
      </motion.div>

      {/* ٢ · الحلقات: أثر المشهد المُصيَّر فوقها، بحدّ واحد لا بصورة */}
      <motion.div style={layer(rings)} className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="size-[62vw] max-w-[760px] rounded-full border border-cream/10" />
        <div className="absolute size-[42vw] max-w-[520px] rounded-full border border-brass/15" />
      </motion.div>

      {/* ٣ · الوشم: اسم المنصة عمقاً لا عنواناً — لا يزاحم عنوان الهيرو */}
      <motion.div style={layer(mark)} className="pointer-events-none absolute inset-0 grid place-items-center">
        <span dir="ltr" className="font-en text-[clamp(3.6rem,15vw,10rem)] leading-none font-bold tracking-tight text-cream/[.07]">
          RVIOS
        </span>
      </motion.div>

      {/* ٤ · السطح الفاتح يصعد: نهايته لون القسم التالي نفسه، فلا
             يُرى خطّ التقاء بين الوصلة وشريط المتاجر */}
      <motion.div
        style={layer(sheet)}
        className="pointer-events-none absolute inset-x-[-12%] bottom-[-18%] h-[64%]
                   rounded-t-[100%] border-t border-cream/10 bg-paper"
      />
    </div>
  );
}
