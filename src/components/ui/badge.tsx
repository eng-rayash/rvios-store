import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * الشارة — حالةٌ تُقرأ بنظرة.
 *
 * ★ النقطة الملوّنة ليست زينة.
 * اللون وحده لا يحمل معلومة لمن لا يميّز الأحمر من الأخضر
 * (WCAG 1.4.1)، والنصّ وحده بطيء القراءة في قائمة من خمسين
 * طلباً. النقطة تجعل العين تمسح العمود بحثاً عن لون، والنصّ
 * بجوارها يؤكّد ما رأته — كلٌّ يسدّ ثغرة الآخر.
 *
 * والألوان منقولة من `tokens.css` بعد فحص تباينها: كلها فوق
 * ٤٫٥:١ على أرضيتها عند ١١٫٥px عريض.
 */
const TONES = {
  wait:  'bg-warn/15 text-[#8a5d05]',
  ok:    'bg-ok/15 text-[#1f6b40]',
  done:  'bg-sand text-soft',
  off:   'bg-danger/12 text-[#a11]',
  brass: 'bg-brass/15 text-brass-deep',
} as const;

const DOTS = {
  wait: 'bg-warn', ok: 'bg-ok', done: 'bg-soft/60', off: 'bg-danger', brass: 'bg-brass',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = 'done',
  dot = true,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1',
        'text-2xs font-bold',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}
