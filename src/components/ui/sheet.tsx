'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

type Side = 'bottom' | 'end' | 'center';

/**
 * النافذة المنبثقة — درجٌ سفلي أو جانبي أو نافذة وسطى.
 *
 * كانت كل نوافذ الواجهة (ورقة المنتج، درج السلة، درج الترشيح)
 * بلا حصر تركيز ولا قفل تمرير. فمستخدم لوحة المفاتيح يضغط Tab
 * فيخرج من النافذة إلى الصفحة **خلفها** دون أن يراها، والتمرير
 * على الهاتف يُحرّك الصفحة تحت النافذة لا النافذة. هذه الأربعة
 * — الحصر، والقفل، وEscape، وإعادة التركيز — مكتوبة مرّةً هنا.
 *
 * ★ الانزلاق منطقيّ لا فيزيائي.
 * الدرج القديم كان يُرسى بـ`inset-inline-start` (منطقي) ويتحرّك
 * بـ`translateX(100%)` (فيزيائي). في `rtl` تنقلب الأولى ولا تنقلب
 * الثانية، فيبدأ الدرج **داخل الشاشة** مُزاحاً بعرضه ثم ينزلق —
 * لا من خارج الحافّة. هنا اتجاه الإزاحة يُقرأ من اتجاه المستند.
 *
 * ★ في بوّابة إلى `body` لا داخل الشجرة.
 * نافذةٌ داخل عنصرٍ عليه `transform` أو `overflow:hidden` تُقصّ
 * أو تُحبس في سياق تراصّه مهما علا `z-index` — وهي علّةٌ لا تظهر
 * إلا حين يُركّبها أحد داخل بطاقةٍ متحرّكة بعد أشهر.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'bottom',
  className,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: Side;
  className?: string;
  children: ReactNode;
  /**
   * أفعالٌ تبقى ظاهرة مهما طال المحتوى.
   * نموذج المنتج أطول من الشاشة، وزرّ «حفظ» في آخره يعني أن
   * التاجر يمرّر إلى القاع بعد كل تعديل ليحفظ — أو يظنّ أن
   * النموذج بلا حفظ أصلاً.
   */
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [dir, setDir] = useState<1 | -1>(-1);

  /* `onClose` في مرجع: الأب يمرّره غالباً دالّةً سهمية جديدة عند
     كل تصيير، ولو كان في اعتماديات الأثر لأُعيد القفل والتركيز
     مع كل ضغطة مفتاح داخل النافذة. */
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    setMounted(true);
    setDir(document.documentElement.dir === 'rtl' ? -1 : 1);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    /* بعد الرسم: العنصر لم يُركَّب بعد في هذه اللحظة */
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel.current)?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;

      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      root.style.overflow = prevOverflow;
      /* التركيز يعود إلى الزرّ الذي فتح النافذة — لا إلى أعلى الصفحة */
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  const hidden = {
    bottom: { y: '100%' },
    end: { x: `${dir * -100}%` },
    center: { opacity: 0, scale: 0.97 },
  }[side];
  const shown = { bottom: { y: 0 }, end: { x: 0 }, center: { opacity: 1, scale: 1 } }[side];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="veil"
            aria-hidden
            onClick={() => closeRef.current()}
            className="fixed inset-0 z-[var(--z-overlay)] bg-ink/50"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
          <motion.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              'fixed z-[var(--z-sheet)] flex flex-col bg-cream text-ink shadow-lift focus:outline-none',
              side === 'bottom' && [
                'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl',
                'pb-[max(1rem,env(safe-area-inset-bottom))]',
              ],
              side === 'end' && 'inset-y-0 end-0 w-[min(420px,92vw)]',
              side === 'center' && 'inset-0 m-auto h-fit max-h-[90dvh] w-[min(560px,94vw)] rounded-2xl',
              className,
            )}
            initial={reduced ? false : hidden}
            animate={shown}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : hidden}
            transition={{ type: 'tween', ease: [0.22, 0.61, 0.36, 1], duration: 0.32 }}
          >
            {/* مقبض السحب — إشارةٌ بصرية أن الدرج يُغلق بالنزول */}
            {side === 'bottom' && (
              <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-line" />
            )}

            <div className="flex shrink-0 items-center justify-between gap-base px-roomy pt-base pb-snug">
              <h2 id={titleId} className="font-heading text-lg font-bold">{title}</h2>
              <button
                type="button"
                onClick={() => closeRef.current()}
                aria-label="إغلاق"
                className="grid size-9 place-items-center rounded-full text-soft transition-colors hover:bg-sand hover:text-ink"
              >
                <X className="size-4.5" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-roomy pb-roomy">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-line bg-cream px-roomy py-base">{footer}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
