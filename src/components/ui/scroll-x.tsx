import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * منطقة تُمرَّر أفقياً — بمقبضٍ لمن لا فأرة له.
 *
 * ★ `tabIndex` هنا ليس تفصيلاً تجميلياً بل إصلاح WCAG 2.1.1.
 * صندوقٌ عليه `overflow-x:auto` يُمرَّر بالإصبع وبعجلة الفأرة،
 * ولا يُمرَّر بلوحة المفاتيح إطلاقاً ما لم يكن **قابلاً للتركيز**
 * — لأن مفاتيح الأسهم تُحرّك ما عليه التركيز. فجدول المقارنة
 * عرضه ٥٦٠ بكسل على شاشة ٣٧٥: من يتصفّح بلوحة المفاتيح يرى
 * عمود «الميزة» وعمود «أساسي» ولا سبيل له إلى «بلس» و«برو»
 * أبداً. سطرٌ واحد يفتح ثلث الجدول المحجوب.
 *
 * و`role="region"` مع اسمٍ صريح شرط الأول لا زينة: منطقة مركَّزة
 * بلا اسم يقف عليها قارئ الشاشة فيقول «مجموعة» ولا يقول ماذا.
 *
 * ★ التلميح مرئيّ على الجوّال فقط.
 * على المكتب الجدول كامل الظهور، فسطر «مرّر أفقياً» هناك يصف
 * شيئاً لا يحدث — وأسوأ من غياب الإرشاد إرشادٌ يكذب.
 * وهو `aria-hidden` لأن قارئ الشاشة أُخبر بالأمر فعلاً عبر
 * الدور والاسم، فتكراره ضجيج.
 */
export function ScrollX({
  label,
  hint,
  className,
  children,
}: {
  /** اسم المنطقة لقارئ الشاشة — «جدول مقارنة الباقات» لا «جدول» */
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className={cn('overflow-x-auto overscroll-x-contain', className)}
      >
        {children}
      </div>
      {hint && (
        <p aria-hidden className="text-2xs text-soft sm:hidden">
          {hint}
        </p>
      )}
    </div>
  );
}
