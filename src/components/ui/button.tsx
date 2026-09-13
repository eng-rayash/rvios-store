import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * الزرّ — نسخة واحدة لكل الواجهة.
 *
 * كان لدينا زرّان لا واحد: `.btn/.btn-fill/.btn-dark/.btn-line`
 * في `tokens.css` للنظام القديم، وسلسلةُ أصناف Tailwind مكرّرة
 * ستّ مرّات في مكوّنات التسويق (`rounded-pill bg-ink … ArrowLeft
 * group-hover:-translate-x-1`). زرٌّ في اللوحة وزرٌّ في الرئيسية
 * لم يشتركا في سطر واحد — وهو أوضح ما يجعل الموقع يُقرأ
 * «عالمين» لا منتجاً واحداً.
 *
 * ★ الانزلاق (`.sheen`) على المتغيّرين المصمتين وحدهما.
 * الضوء الذي يعبر السطح مرّةً يُقرأ صقلاً؛ وعلى زرٍّ شبحيّ بلا
 * أرضية يُقرأ عطلاً. والخامة تُطبَّق حيث تعني شيئاً لا حيثما
 * أمكن — وهذا الفرق بين صنعة وزينة.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-hair whitespace-nowrap',
    'font-bold text-sm rounded-sm',
    'transition-[transform,background-color,color,border-color] duration-200 ease-out-rv',
    'enabled:hover:-translate-y-px',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0',
    /* الحركة تسقط مع تفضيل السكون — الإزاحة لا تُبطّأ بل تُلغى */
    'motion-reduce:hover:translate-y-0',
  ],
  {
    variants: {
      tone: {
        /** الفعل الرئيسي — بلون المنصة أو المتجر حسب اللوحة المحقونة */
        fill: 'sheen bg-shop text-on-shop enabled:hover:bg-shop-deep',
        /** فعل رئيسي محايد عن لون المتجر — للمنصة نفسها */
        dark: 'sheen bg-ink text-cream enabled:hover:bg-black',
        /** فعل ثانوي */
        line: 'border-[1.5px] border-line bg-paper enabled:hover:border-ink',
        /** واتساب — لونه لونه، ولا يُشتقّ من لوحة أحد */
        wa: 'bg-[#1FA855] text-white enabled:hover:bg-[#178043]',
        /** بلا أرضية — للأفعال الهامشية داخل الصفوف والجداول */
        ghost: 'text-soft enabled:hover:text-ink enabled:hover:bg-sand',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-snug py-2.5',
        lg: 'px-roomy py-3 text-md',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { tone: 'fill', size: 'md' },
  },
);

export function Button({
  tone,
  size,
  block,
  busy = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: {
  /**
   * أثناء تنفيذ الفعل.
   *
   * ★ يُعطّل الزرّ ويستبدل الأيقونة بدوّار — لا يُخفي النصّ.
   * زرٌّ يفرغ من نصّه أثناء الانتظار يقفز عرضه، فيتحرّك ما حوله
   * ويظنّ الضاغط أنه أخطأ الهدف. والعرض يبقى لأن الدوّار يحلّ
   * محلّ الأيقونة بالمقاس نفسه.
   */
  busy?: boolean;
  icon?: ReactNode;
  children: ReactNode;
} & VariantProps<typeof buttonVariants>
  & Omit<ComponentPropsWithoutRef<'button'>, 'children'>) {
  return (
    <button
      className={cn(buttonVariants({ tone, size, block }), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
