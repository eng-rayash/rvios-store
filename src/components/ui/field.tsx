import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * الحقل — تسمية وإدخال وشرح وخطأ، مربوطةً ببعضها فعلاً.
 *
 * ★ لماذا مكوّن لا `<label>` مكتوباً في كل موضع؟
 * لأن الربط هو ما يُنسى. في `contact-form.tsx` حقل الهاتف بلا
 * `id`، ورسالة خطئه في `role="alert"` منفصلة لا تربطها به
 * `aria-describedby`، وبلا `aria-invalid`. أي أن قارئ الشاشة
 * يقول «حقل الهاتف» ثم — في مكان آخر من الصفحة — «الرقم غير
 * صحيح»، ولا يعرف المستخدم أن الجملتين عن شيء واحد.
 *
 * هذا ليس نسياناً من كاتبه بل **خاصية الكتابة اليدوية**: أربعة
 * معرّفات متوافقة في كل حقل، مكتوبة بالحرف، في عشرين حقلاً.
 * فالنسيان مسألة وقت. و`useId` يولّدها ويربطها فلا تُنسى أصلاً.
 *
 * ★ و`aria-describedby` تحمل الشرح والخطأ معاً حين يوجدان:
 * قارئ الشاشة يقرؤهما بالترتيب، فلا يضيع الشرح لأن خطأً وقع.
 */
export function Field({
  label,
  hint,
  error,
  /** التسمية مرئية دائماً إلا حين يشرحها سياقها البصري تماماً */
  hideLabel = false,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  hideLabel?: boolean;
  className?: string;
  /** يتلقّى المعرّفات الجاهزة — فلا يكتبها المستدعي ولا ينساها */
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('mb-base', className)}>
      <label
        htmlFor={id}
        className={cn(
          'mb-1.5 block text-xs font-bold',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && !error && (
        <small id={hintId} className="mt-1.5 block text-2xs text-soft">{hint}</small>
      )}

      {/* ★ `role="alert"` على العنصر نفسه لا على حاوية دائمة:
          الحاوية الدائمة تُعلن فارغةً عند كل تصيير، والعنصر
          الذي يظهر عند الخطأ يُعلن مرّةً واحدة حين يقع. */}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * صندوق الإدخال — مظهرٌ واحد لكل حقول الواجهة.
 *
 * كان `tokens.css` يصبغ كل `input[type=…]` و`select` و`textarea`
 * بمحدّد عام واحد. وهو مريح وخطر معاً: أي حقل جديد يرث المظهر
 * بلا قرار، وأي حقل يريد غيره يحارب المحدّد العام. هنا المظهر
 * **يُطلَب** — والحقل الذي لا يطلبه لا يُشوَّه.
 */
/** القائمة المنسدلة — بمظهر صندوق الإدخال نفسه وسهمٍ يتبع اتجاه الصفحة */
export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5 pe-9',
          'transition-colors duration-200',
          'focus-visible:border-shop focus-visible:outline-none',
          'focus-visible:ring-[3px] focus-visible:ring-shop/20',
          'aria-invalid:border-danger',
          'disabled:cursor-not-allowed disabled:bg-sand disabled:text-soft',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {/* السهم مرسومٌ بحدّين مائلين — أخفّ من أيقونة، ولا يُلتقط بالنقر */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-soft"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      className={cn(
        'w-full rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5',
        'transition-colors duration-200',
        /* ★ حلقةٌ ناعمة لا مجرّد تلوين حدّ.
           `tokens.css` كان يُلغي الحدّ الخارجي ويكتفي بتغيير لون
           الحدّ — بكسل ونصف يتغيّر لونه هو كل ما يراه مستخدم
           لوحة المفاتيح ليعرف أين هو. والحلقة تُرى من طرف
           الشاشة، ولا تزيح شيئاً لأنها خارج التخطيط. */
        'focus-visible:border-shop focus-visible:outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-shop/20',
        /* ★ الخطأ يغلب التركيز صراحةً بمتغيّر مركّب.
           `aria-invalid:border-danger` وحده يخسر أمام
           `focus-visible:border-shop` بترتيب المتغيّرات، فينطفئ
           الأحمر في اللحظة التي يعود فيها المستخدم ليصحّح. */
        'aria-invalid:border-danger',
        'aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/20',
        'disabled:cursor-not-allowed disabled:bg-sand disabled:text-soft',
        className,
      )}
      {...rest}
    />
  );
}
