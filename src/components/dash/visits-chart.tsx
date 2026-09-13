import { useId } from 'react';
import { ar } from '@/lib/utils';

export type ChartDay = { day: string; visits: number; orders: number };

const W = 560;
const H = 180;
const PAD = 10;

/**
 * الزيارات والطلبات — آخر سبعة أيام.
 *
 * ★ الزمن يجري من اليمين إلى اليسار.
 * النسخة القديمة كانت ترسم الأقدم عند x=0 (يساراً)، بينما صفّ
 * أسماء الأيام تحتها `flex` داخل صفحة `rtl` يضع أوّل عنصر
 * **يميناً**. فكانت تسمية «السبت» تقف تحت نقطة «الجمعة» —
 * منحنى صحيح بتسميات معكوسة، ولا شيء يكسر فلا أحد يلاحظ.
 * هنا يُرسم الأقدم يميناً، والتسميات تتبع اتجاه الصفحة نفسه،
 * فيتّفق الاثنان لأنهما يقرآن من الجهة ذاتها.
 *
 * ★ ولكل خطٍّ مقياسه، والرقم الحقيقي مكتوبٌ بجانبه.
 * كانت الطلبات تُضرب في ٨ لتُرى على محور الزيارات — تضخيمٌ
 * لا يُعلَن، فيبدو يومٌ بطلبين كأنه ينافس يوماً بعشرين زيارة.
 * والآن يملأ كلُّ خطٍّ ارتفاعه ليُقرأ **شكل** أسبوعه، والمجموع
 * الفعلي في المفتاح يقول **حجمه**. شكلٌ بلا حجم يضلّل، وحجمٌ
 * بلا شكل جدول — والاثنان معاً قراءة.
 *
 * ★ والرسم مخفيّ عن قارئ الشاشة، وجدولٌ حقيقي مكانه.
 * `role="img"` بوصفٍ عامّ يقول «هنا رسم» ولا يقول ما فيه.
 */
export function VisitsChart({ rows }: { rows: ChartDay[] }) {
  const gid = useId();
  const n = rows.length;
  if (!n) return null;

  const x = (i: number) => (n < 2 ? W / 2 : W - PAD - (i * (W - PAD * 2)) / (n - 1));
  const scaleOf = (key: 'visits' | 'orders') => {
    const max = Math.max(...rows.map((r) => r[key]), 1);
    return (v: number) => H - PAD - (v / max) * (H - PAD * 2 - 8);
  };
  const yv = scaleOf('visits');
  const yo = scaleOf('orders');

  const line = (y: (v: number) => number, key: 'visits' | 'orders') =>
    rows.map((r, i) => `${x(i)},${y(r[key])}`).join(' ');

  const area = `${x(0)},${H - PAD} ${line(yv, 'visits')} ${x(n - 1)},${H - PAD}`;
  const totals = {
    visits: rows.reduce((a, r) => a + r.visits, 0),
    orders: rows.reduce((a, r) => a + r.orders, 0),
  };

  const dayName = (iso: string, i: number) =>
    i === n - 1 ? 'اليوم' : new Date(iso).toLocaleDateString('ar-EG', { weekday: 'short' });

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
        className="h-[180px] w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="text-shop" stopColor="currentColor" stopOpacity=".16" />
            <stop offset="100%" className="text-shop" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon points={area} fill={`url(#${gid})`} />
        <polyline
          points={line(yo, 'orders')}
          className="fill-none stroke-brass"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line(yv, 'visits')}
          className="fill-none stroke-shop"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* اليوم وحده نقطةٌ أكبر بحلقة ورقية — العين تبدأ من «الآن» */}
        <circle cx={x(n - 1)} cy={yv(rows[n - 1].visits)} r={4.5} className="fill-shop stroke-paper" strokeWidth={2} />
      </svg>

      <div className="mt-2 flex justify-between text-2xs text-soft" aria-hidden>
        {rows.map((r, i) => (
          <span key={r.day} className={i === n - 1 ? 'font-bold text-ink' : undefined}>
            {dayName(r.day, i)}
          </span>
        ))}
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-roomy gap-y-1 text-xs text-soft">
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="block h-[2.5px] w-3 rounded-full bg-shop" />
          الزيارات <b className="tabular font-semibold text-ink">{ar(totals.visits)}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="block h-[2.5px] w-3 rounded-full bg-brass" />
          الطلبات <b className="tabular font-semibold text-ink">{ar(totals.orders)}</b>
        </span>
      </figcaption>

      <table className="sr-only">
        <caption>الزيارات والطلبات لآخر سبعة أيام</caption>
        <thead>
          <tr><th scope="col">اليوم</th><th scope="col">الزيارات</th><th scope="col">الطلبات</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.day}>
              <th scope="row">{dayName(r.day, i)}</th>
              <td>{ar(r.visits)}</td>
              <td>{ar(r.orders)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
