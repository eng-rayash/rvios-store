'use client';

import {
  useImperativeHandle, useRef,
  type ClipboardEvent, type KeyboardEvent, type RefObject,
} from 'react';
import { cn } from '@/lib/utils';

const LEN = 6;

/**
 * حقل رمز التحقّق — ستّ خانات تُقرأ خانةً واحدة.
 *
 * ★ `direction: ltr` على الحاوية قصدٌ لا سهو.
 * الرمز رقمٌ لا نصّ عربي: يُملأ من اليسار إلى اليمين كما يُرسل
 * في الرسالة وكما يُقرأ من الشاشة. وعكسه في صفحة `rtl` يجعل
 * التاجر يكتب الرقم مقلوباً وهو يظنّه صحيحاً.
 *
 * ★ والتقديم التلقائي يحتاج الثلاثة معاً لا واحداً:
 *   · `input`     — يتقدّم بعد كل رقم
 *   · `Backspace` — يرجع حين تكون الخانة فارغة أصلاً
 *   · `paste`     — يوزّع الرمز كاملاً على الخانات
 * وأشهرها نسياناً هو اللصق: أغلب الناس ينسخون الرمز من الرسالة
 * ولا يكتبونه. وبلا معالجٍ للّصق يسقط الرمز كلّه في خانة واحدة
 * فتُقصّ إلى رقم — ويبدو الحقل معطوباً وهو يعمل كما كُتب.
 */
/** ما يملكه الأب على الحقل: تفريغه وإعادة التركيز بعد خطأ */
export interface OtpHandle { clear: () => void }

export function OtpInput({
  onComplete,
  disabled,
  label = 'رمز التحقّق',
  ref,
}: {
  /** يُنادى حين تمتلئ الخانات الستّ — بلا زرّ وسيط */
  onComplete: (code: string) => void;
  disabled?: boolean;
  label?: string;
  /** في React 19 يمرّ `ref` كخاصية عادية — بلا `forwardRef` */
  ref?: RefObject<OtpHandle | null>;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const read = () => refs.current.map((el) => el?.value ?? '').join('');

  const fire = () => {
    const code = read();
    if (code.length === LEN) onComplete(code);
  };

  const onInput = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    el.value = el.value.replace(/\D/g, '').slice(0, 1);
    if (el.value && i < LEN - 1) refs.current[i + 1]?.focus();
    fire();
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !refs.current[i]?.value && i > 0) {
      refs.current[i - 1]?.focus();
    }
    /* الأسهم تتبع الخانات لا اتجاه الصفحة — الحاوية ltr */
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData('text') ?? '').replace(/\D/g, '').slice(0, LEN);
    digits.split('').forEach((d, k) => {
      const el = refs.current[k];
      if (el) el.value = d;
    });
    refs.current[Math.min(digits.length, LEN - 1)]?.focus();
    fire();
  };

  /* يُستدعى من الأب بعد خطأ: تُفرَّغ الخانات ويعود التركيز للأولى.
     ★ الخانات غير مُتحكَّم بها (uncontrolled) عمداً: حالةٌ في
     React لستّ خانات تعني ستّ إعادات تصيير لكل رقم يُكتب، لأجل
     قيمةٍ لا يقرؤها أحد قبل اكتمالها. فالقيمة تُقرأ عند الحاجة
     وحدها، والتفريغ يحتاج مقبضاً — وهذا هو. */
  useImperativeHandle(ref, () => ({
    clear() {
      refs.current.forEach((el) => { if (el) el.value = ''; });
      refs.current[0]?.focus();
    },
  }), []);

  return (
    <div dir="ltr" className="flex justify-start gap-2.5" role="group" aria-label={label}>
      {Array.from({ length: LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`الرقم ${i + 1}`}
          onInput={() => onInput(i)}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste}
          className={cn(
            'h-[60px] w-[52px] max-sm:h-[54px] max-sm:w-[44px]',
            'rounded-sm border-[1.5px] border-line bg-paper text-center',
            'font-body text-[24px] font-bold tabular max-sm:text-xl',
            'transition-colors duration-200',
            'focus-visible:border-shop focus-visible:outline-none',
            'focus-visible:ring-[3px] focus-visible:ring-shop/20',
            'disabled:cursor-not-allowed disabled:bg-sand disabled:text-soft',
          )}
        />
      ))}
    </div>
  );
}
