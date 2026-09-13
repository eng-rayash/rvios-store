'use client';

import Image from 'next/image';
import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/**
 * مشهد الهيرو — الصورة المُصيَّرة وقد صارت **جسماً في حيّز** لا
 * ملفاً موضوعاً على خلفية.
 *
 * الفكرة كلّها في أن ثلاث طبقات تستجيب لمؤشّر واحد بمقادير
 * مختلفة: الجهاز يميل قليلاً، والهالة تحته تنزلق **عكسه**
 * وبمقدار أكبر، وبطاقات الإشعار تسبقه قليلاً لأنها أقرب إلى
 * العين. حين تنزاح الهالة عكس الجسم تقرأ العين مصدرَ ضوءٍ
 * ثابتاً والجسمَ يتحرّك أمامه — وهذا هو الفرق بين عمقٍ محسوس
 * وصورةٍ تُهزّ.
 *
 * والمقادير صغيرة عمداً (عشر بكسلات وأقلّ من درجتين): المشهد
 * مُصيَّر بمنظور ثابت، وإمالته أكثر من ذلك تفضح أنه صورة —
 * فتُنقض الغاية نفسها. الأثر يجب أن يُحسّ ولا يُلاحَظ.
 *
 * ★ المستمع على القسم كلّه لا على الصورة: لو رُبط بالصورة لبدأت
 *   الحركة فجأةً عند تجاوز حافّتها، ولوقف المشهد ميّتاً بينما
 *   الزائر يقرأ العنوان بجواره. ومن يمرّ على النصّ يرى المشهد
 *   يستدير نحوه — وهو أقرب إلى الحقيقة البصرية: الضوء يعرف
 *   بالغرفة كلّها لا بحدود الجسم.
 */
export function HeroScene({ children }: { children?: ReactNode }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);

  // ‎-0.5 … 0.5 — نسبة موضع المؤشّر من مركز القسم
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  useEffect(() => {
    if (reduced) return;
    const scene = box.current?.closest('section');
    if (!scene) return;

    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = scene.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    };
    const rest = () => { px.set(0); py.set(0); };

    scene.addEventListener('pointermove', move, { passive: true });
    scene.addEventListener('pointerleave', rest);
    return () => {
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('pointerleave', rest);
    };
  }, [reduced, px, py]);

  /** زنبرك ثقيل: المشهد جسم له كتلة، لا مؤشّر ثانٍ يلاحق الأول */
  const cfg = { stiffness: 110, damping: 26, mass: 0.9 };
  const sx = useSpring(px, cfg);
  const sy = useSpring(py, cfg);

  const rotY = useTransform(sx, [-0.5, 0.5], [2, -2]);
  const rotX = useTransform(sy, [-0.5, 0.5], [-1.5, 1.5]);
  const tx = useTransform(sx, [-0.5, 0.5], [10, -10]);
  const ty = useTransform(sy, [-0.5, 0.5], [7, -7]);

  // الهالة تنزلق عكس الجسم وبضعفٍ تقريباً — فيُقرأ الضوء ثابتاً
  const gx = useTransform(sx, [-0.5, 0.5], [-26, 26]);
  const gy = useTransform(sy, [-0.5, 0.5], [-14, 14]);

  // البطاقات أقرب إلى العين من الجهاز، فتسبقه قليلاً
  const cx = useTransform(sx, [-0.5, 0.5], [20, -20]);
  const cy = useTransform(sy, [-0.5, 0.5], [13, -13]);

  const live = reduced ? undefined : { x: cx, y: cy };

  return (
    <div ref={box} className="relative [perspective:1400px]">
      <motion.div style={live}>{children}</motion.div>

      <figure className="relative m-0 mx-auto w-full max-w-[560px] lg:max-w-none lg:-ms-[8%] lg:-me-[10%]">
        {/* هالة تحت المجسّم: تفصله عن أرضية الهيرو وتوهم بضوء
            يسقط عليه من المشهد لا بصورة مركّبة فوقه */}
        <motion.div
          aria-hidden
          style={reduced ? undefined : { x: gx, y: gy }}
          className="pointer-events-none absolute inset-x-[8%] bottom-[6%] -z-10 h-1/3
                     rounded-[50%] bg-shop/30 blur-[64px]"
        />
        {/* المنظور على الحاوية والدوران هنا — و`preserve-3d` ليست
            بينهما: لا ابن لهذه الطبقة له تحويل ثلاثي خاصّ به،
            فكلّ ما تفعله أن تُجبر المتصفّح على طبقة تركيب
            إضافية لصورة واحدة. */}
        <motion.div
          style={
            reduced
              ? undefined
              : { rotateX: rotX, rotateY: rotY, x: tx, y: ty }
          }
        >
          <Image
            src="/images/hero-laptop.png"
            alt="متجر RVIOS معروضاً على حاسوب محمول: واجهة عربية بمنتجات وتصنيفات"
            width={2000}
            height={1500}
            priority
            sizes="(min-width: 1280px) 860px, (min-width: 1024px) 62vw, 96vw"
            className="w-full drop-shadow-[0_40px_70px_rgba(0,0,0,.55)]"
          />
        </motion.div>
      </figure>
    </div>
  );
}
