'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Check, X } from 'lucide-react';

/**
 * «احجز رابطك» — المنتج نفسه داخل الهيرو، لا وعدٌ عنه.
 *
 * الحقل يستدعي نقطة الفحص الحقيقية التي يستخدمها تدفّق الإعداد،
 * والحرفنة العربية←اللاتينية تجري في الخادم (`slug.js`): مصدر
 * حقيقة واحد بدل نسخة تقريبية في الواجهة تتناقض معه لاحقاً،
 * فيرى الزائر رابطاً هنا ويحصل على غيره عند الإنشاء.
 */
type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'free'; slug: string }
  | { kind: 'taken'; reason: string; suggestion: string | null }
  | { kind: 'error' };

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

export function ClaimField({ onName }: { onName?: (name: string) => void }) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const seq = useRef(0);

  useEffect(() => {
    const raw = value.trim();
    onName?.(raw);

    if (!raw) { setState({ kind: 'idle' }); return; }
    setState({ kind: 'checking' });

    // مهلة قصيرة: الفحص عند كل حرف يُغرق الخادم ويُربك الزائر
    const t = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`${API}/api/slug/check?q=${encodeURIComponent(raw)}`);
        const d = await res.json();
        if (mine !== seq.current) return;            // ردّ متأخّر لكتابة أقدم
        setState(d.ok
          ? { kind: 'free', slug: d.slug }
          : { kind: 'taken', reason: d.reason, suggestion: d.suggestion ?? null });
      } catch {
        // تعذّر الفحص لا يعني أن الاسم محجوز — لا نُخيف الزائر
        if (mine === seq.current) setState({ kind: 'error' });
      }
    }, 340);

    return () => clearTimeout(t);
  }, [value, onName]);

  const href = value.trim()
    ? `/onboarding?store=${encodeURIComponent(value.trim())}`
    : '/onboarding';

  return (
    <form
      className="max-w-lg"
      onSubmit={(e) => { e.preventDefault(); window.location.href = href; }}
    >
      <label className="sr-only" htmlFor="claimName">اسم متجرك</label>

      <div className="flex items-center rounded-pill border-[1.5px] border-line bg-paper p-1.5
                      transition-[border-color,box-shadow] focus-within:border-shop
                      focus-within:shadow-[0_0_0_4px_rgba(var(--shop-rgb),.14)]">
        {/* ★ السابقة تختفي تحت ٣٦٠ بكسل.
            هي سياقٌ لا معلومة: النطاق كاملاً يظهر في سطر الحالة
            تحت الحقل («متاح: rviosstore.com/…»)، فلا يضيع شيء.
            وبقاؤها كان يأكل ٨٥ بكسل من أصل ٢٧٢، فينزل الحقل إلى
            ٦١ بكسل ويُقصّ «اسم متجرك» إلى «اسم م». */}
        <span dir="ltr" className="ps-3.5 text-xs whitespace-nowrap text-soft tabular max-[359px]:hidden">
          rviosstore.com/
        </span>
        {/* ★ ١٦ بكسل على الجوال قصدٌ لا سهو: سفاري iOS يُقرّب الصفحة
            تلقائياً عند التركيز على أي حقل أصغر من ١٦، فيقفز التخطيط
            ولا يعود إلى مكانه. والحجم يرجع إلى درجة السلّم (١٥) من
            md فصاعداً حيث لا تقريب. */}
        <input
          id="claimName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="اسم متجرك"
          maxLength={40}
          autoComplete="off"
          aria-describedby="claimState"
          className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[1rem] font-bold
                     text-ink outline-none placeholder:font-normal placeholder:text-soft/75
                     md:text-md"
        />
        <button
          type="submit"
          className="group inline-flex shrink-0 items-center gap-2 rounded-pill bg-shop px-5 py-2.5
                     text-sm font-bold text-on-shop transition-[filter,transform]
                     hover:brightness-110 active:scale-[.98]"
        >
          احجزه
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
        </button>
      </div>

      <div
        id="claimState"
        role="status"
        aria-live="polite"
        className="mt-2.5 flex min-h-[1.45em] items-center gap-2 px-1 text-xs font-bold"
      >
        {state.kind === 'checking' && (
          <span className="flex items-center gap-2 text-soft">
            <Loader2 className="size-3.5 animate-spin" />جارٍ الفحص…
          </span>
        )}
        {state.kind === 'free' && (
          <span className="flex items-center gap-2 text-ok">
            <Check className="size-3.5" />متاح: <b dir="ltr">rviosstore.com/{state.slug}</b>
          </span>
        )}
        {state.kind === 'taken' && (
          <span className="flex items-center gap-2 text-danger">
            <X className="size-3.5" />
            {state.reason}
            {state.suggestion && <> — جرّب <b dir="ltr">{state.suggestion}</b></>}
          </span>
        )}
      </div>
    </form>
  );
}
