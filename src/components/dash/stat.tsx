import type { ReactNode } from 'react';
import { Plaque } from '@/components/ui/plaque';
import { cn } from '@/lib/utils';

/**
 * بطاقة مؤشّر — رقمٌ واحد وما يعنيه.
 *
 * ★ `dt/dd` لا `small/b`.
 * الأصل كان `<small>العنوان</small><b>الرقم</b>` — وقارئ الشاشة
 * يقرؤهما جملتين منفصلتين لا زوجاً. وقائمة التعريف تقول صراحةً
 * «هذا اسمٌ وهذه قيمته»، فيُعلن «طلبات قيد التأكيد: ٣» لا
 * «طلبات قيد التأكيد. ثلاثة.». ولذا يُركَّب داخل `<dl>`.
 *
 * ★ والمؤشّر «الساخن» يُتوَّج بلون المتجر لا بشريطٍ جانبي.
 * كان `.kpi.hot::after` خطّاً عمودياً بثلاثة بكسلات — مفردةً لا
 * توجد في أي مكان آخر من الواجهة. والتاج هو مفردة اللوح المعلّق
 * نفسها: «هنا ما يستحقّ نظرتك أوّلاً»، بلغةٍ تتكرّر فتُفهم.
 */
export function Stat({
  label,
  value,
  unit,
  icon,
  hot = false,
  className,
}: {
  label: string;
  /** منسَّق مسبقاً بأرقام عربية — المكوّن لا يعرف هل هو عدد أم مبلغ */
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  /** المؤشّر الذي يتطلّب فعلاً من التاجر الآن */
  hot?: boolean;
  className?: string;
}) {
  return (
    <Plaque crest={hot} className={cn('px-5 pt-4 pb-4.5', className)}>
      <dt className="flex items-center gap-hair text-xs text-soft">
        {icon && <span aria-hidden className="[&>svg]:size-3.5">{icon}</span>}
        {label}
      </dt>
      <dd className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-stat leading-tight font-semibold tabular text-ink">{value}</span>
        {unit && <span className="text-xs text-soft">{unit}</span>}
      </dd>
    </Plaque>
  );
}
