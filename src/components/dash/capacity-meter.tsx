import Link from 'next/link';
import { Plaque } from '@/components/ui/plaque';
import { buttonVariants } from '@/components/ui/button';
import { ar, cn, items } from '@/lib/utils';

export type Capacity = { used: number; max: number | null; label: string; pct: number };

/** العتبة التي يُقترح عندها الترقية — منقولة من اللوحة القديمة */
const NEAR = 70;

/**
 * سعة الباقة — كم بقي قبل أن يُرفض المنتج التالي.
 *
 * ★ الشريط يصير كهرمانياً عند ٧٠٪ لا عند ١٠٠٪.
 * كان بلون المتجر في كل الحالات، فشريطٌ ممتلئ ٩٥٪ يبدو بالضبط
 * كشريطٍ ممتلئ ١٠٪ بطولٍ مختلف. والتاجر لا يقيس الأطوال — يرى
 * لوناً. واللون الذي يتغيّر قبل الحدّ يعطيه وقتاً ليقرّر، بدل
 * أن يكتشف الحدّ حين يُرفض منتجٌ كتب وصفه ورفع صوره.
 *
 * ★ `role="meter"` لا `progressbar`: هذا مقدارٌ ضمن مدى معروف،
 * لا مهمّةٌ تتقدّم نحو اكتمال. والفرق يُعلَن لقارئ الشاشة.
 */
export function CapacityMeter({ planName, cap }: { planName: string; cap: Capacity }) {
  const bounded = cap.max !== null;
  const near = bounded && cap.pct >= NEAR;

  return (
    <Plaque className="flex flex-col px-5 py-4.5">
      <h2 className="font-heading text-sm font-bold">سعة باقة {planName}</h2>
      <p className="mt-1.5 text-stat leading-tight font-semibold tabular">{cap.label}</p>

      <div
        role="meter"
        aria-label={`سعة باقة ${planName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={cap.pct}
        aria-valuetext={cap.label}
        className="mt-3 h-2 overflow-hidden rounded-sm bg-sand"
      >
        <span
          className={cn(
            'block h-full rounded-sm transition-[width] duration-700 ease-out-rv',
            near ? 'bg-warn' : 'bg-shop',
          )}
          style={{ width: `${cap.pct}%` }}
        />
      </div>

      <p className="mt-2 flex justify-between text-xs text-soft">
        <span>{bounded ? `بقي ${items(cap.max! - cap.used)}` : 'بلا حدّ'}</span>
        {bounded && <span className="tabular">{ar(cap.pct)}٪</span>}
      </p>

      {near && (
        <Link
          href="/dashboard/plan"
          className={cn(buttonVariants({ tone: 'fill', size: 'sm', block: true }), 'mt-4')}
        >
          رقِّ باقتك
        </Link>
      )}
    </Plaque>
  );
}
