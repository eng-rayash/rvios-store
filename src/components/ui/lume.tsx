'use client';

import { useCallback, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * الضوء الذي يتبع المؤشّر داخل بطاقة.
 *
 * الحساب كله في CSS: الخطّاف لا يفعل إلا كتابة إحداثيَي المؤشّر
 * في `--mx/--my` على العنصر نفسه، والتدرّج في `.lume` يقرؤهما.
 * البديل الشائع — حالة React عند كل `pointermove` — يُعيد تصيير
 * الشجرة عشرات المرّات في الثانية لأجل تدرّج، وهو ثمن سخيف
 * لظلٍّ من ضوء.
 *
 * و`setProperty` على `style` لا يُبطل ذاكرة التخطيط: المتصفّح
 * يعيد الطلاء وحده ولا يعيد الحساب، فيبقى التمرير سلساً على
 * جهاز متوسط.
 *
 * ولا شيء يُربط على أجهزة اللمس: `pointermove` هناك لا يقع إلا
 * أثناء السحب، فالضوء يومض عند كل لمسة بلا معنى.
 */
export function useLume() {
  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);

  return { onPointerMove };
}

/**
 * سطح يحمل ذلك الضوء.
 *
 * ★ هو **البطاقة نفسها** لا غلافاً حولها. لو لُفّت البطاقة بغلاف
 *   يحمل `.lume` لاختفى الضوء خلف أرضيتها المعتمة — فالتدرّج
 *   يُطلى قبلها. ولهذا يقبل المكوّن الوسم المطلوب بدل أن
 *   يفترض `div`: بطاقةٌ هي `article` دلالةً يجب أن تبقى كذلك.
 */
export function LumeSurface({
  as: Tag = 'div',
  brass,
  className,
  children,
}: {
  as?: 'div' | 'article';
  /** على السطح الداكن يصير الوهج نحاسياً — الأحمر على الحبر يُقرأ بقعة */
  brass?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { onPointerMove } = useLume();
  return (
    <Tag onPointerMove={onPointerMove} className={cn('lume', brass && 'lume-brass', className)}>
      {children}
    </Tag>
  );
}
