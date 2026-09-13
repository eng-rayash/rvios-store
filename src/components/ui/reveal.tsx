'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * ظهور تدريجي عند التمرير.
 *
 * البديل الشائع (فئة CSS + IntersectionObserver) يفشل فشلاً
 * صامتاً: العنصر يبدأ بـ`opacity:0`، فإن لم يعمل المراقب —
 * تبويب غير مرسوم، أو JS مُعطَّل — اختفت الصفحة كلها تحت
 * الطيّة بلا خطأ واحد. هنا `whileInView` من Motion يضمن
 * الحالة النهائية، و`once` يمنع إعادة التشغيل عند كل تمرير.
 *
 * ومع `prefers-reduced-motion` يُلغى التحريك كلياً — لا يُبطّأ.
 *
 * ★ المنحنى `(.16,1,.3,1)` هو نفسه منحنى صعود كلمات العنوان في
 *   `ui/words.tsx`، والمسافة قصُرت من ٢٢ إلى ١٦ بكسل بينما
 *   طالت المدّة. المجموع: حركة تبدأ بسرعة ثم **تستقرّ** بدل أن
 *   تصل. الفارق بين الاثنين هو الفارق بين جسمٍ له كتلة وعنصرٍ
 *   تنتهي مدّته — والعين تعرفه ولو لم تسمّه.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px' }}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * عنوان قسم موحّد — نبرة واحدة عبر الصفحة كلها.
 *
 * كان الثلاثة يظهرون **كتلةً واحدة**: سطر علوي وعنوان ومقدّمة
 * ينزلقون معاً بمقدار واحد في لحظة واحدة. وهذا أرخص ما في
 * الحركة — لأنه يقول إن العناصر الثلاثة شيء واحد رُسم دفعة.
 *
 * صاروا يتتابعون بفارق تسعين جزءاً من الثانية بينهم: يقرأ
 * الزائر السطر العلوي، فيصل العنوان وقد استعدّ له، ثم تلحق
 * المقدّمة. الترتيب هو ترتيب القراءة نفسه — لا زخرفة تُضاف بل
 * **إخراج** لما هو موجود أصلاً. ولا عنصر جديد على الصفحة.
 */
export function SectionHead({
  kick,
  title,
  lede,
  tone = 'ink',
}: {
  kick: string;
  title: string;
  lede?: string;
  tone?: 'ink' | 'cream';
}) {
  const muted = tone === 'cream' ? 'text-cream/65' : 'text-soft';
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <Reveal y={10}>
        <p className={`mb-3.5 text-xs font-extrabold tracking-[.2em] ${tone === 'cream' ? 'text-brass' : 'text-brass-deep'}`}>
          {kick}
        </p>
      </Reveal>
      <Reveal delay={0.09}>
        <h2 className="font-display text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.28] font-bold text-balance">
          {title}
        </h2>
      </Reveal>
      {lede && (
        <Reveal delay={0.18} y={12}>
          <p className={`mt-4 text-md leading-[1.85] text-pretty ${muted}`}>{lede}</p>
        </Reveal>
      )}
    </div>
  );
}

/**
 * خطّ ينمو من جهة القراءة حين يدخل الشاشة.
 *
 * وُضِع للخيط الذي يربط خطوات «كيف يعمل». كان خطّاً ثابتاً
 * يقول إن البطاقات الثلاث مرتبطة؛ وصار **يُرسم** أمام الزائر
 * من اليمين إلى اليسار فيقول إنها متتابعة — وهو ما يعنيه
 * «١ ثم ٢ ثم ٣» أصلاً. المعنى نفسه، بلا عنصر جديد على الصفحة.
 *
 * وهو زينة خالصة: أسوأ ما يقع إن لم تعمل الحركة أن يظهر الخطّ
 * كاملاً كما كان.
 */
export function GrowRule({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn('origin-right', className)}
      initial={reduced ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '0px 0px -80px' }}
      transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
