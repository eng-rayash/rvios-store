import Link from 'next/link';
import { Check, Minus, ArrowLeft } from 'lucide-react';
import type { Plan } from '@/lib/plans';
import { ar, cn } from '@/lib/utils';
import { LumeSurface } from '@/components/ui/lume';

/**
 * بطاقة باقة.
 *
 * الفكرة التي تميّزها عن أي جدول أسعار آخر: **الباقة تشتري درجة
 * تصميم، فالبطاقة تعرض تلك الدرجة بدل أن تصفها.** المعاينة
 * الصغيرة أعلى كل بطاقة هي شكل متجر التاجر فعلاً في تلك الباقة
 * — مسطّح في «نقي»، متدرّج في «دافئ»، موهج في «فاخر».
 *
 * وقائمة «غير مشمول» ليست قسوة على الباقة الأدنى: إخفاؤها يجعل
 * الترقية تبدو بلا سبب، فيبقى التاجر حيث هو ويظنّ أنه لم يفوّت
 * شيئاً. الصدق هنا يبيع أكثر من الصمت.
 *
 * ★ والبطاقة تحمل ضوءاً يتبع المؤشّر (`LumeSurface`) لأن هذا
 *   حرفياً ما تشتريه باقة «برو»: «بطاقات بضوء يتبع المؤشّر» في
 *   وصف درجتها. فحين يمرّ التاجر بمؤشّره على بطاقة السعر يجرّب
 *   الميزة قبل أن يقرأ اسمها — وهذا أقوى من أي لقطة شاشة.
 */
export function PlanCard({
  plan,
  price,
  featured,
}: {
  plan: Plan;
  price: number | null;
  featured?: boolean;
}) {
  const free = plan.priceUsd === 0;

  return (
    <LumeSurface
      as="article"
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-paper',
        'transition-[transform,box-shadow,border-color] duration-300',
        'hover:-translate-y-1.5 hover:shadow-lift',
        featured ? 'border-shop/40 shadow-lift lg:-my-4' : 'border-line',
      )}
    >
      {featured && (
        <div className="bg-shop py-2 text-center text-2xs font-extrabold tracking-widest text-on-shop">
          الأكثر اختياراً
        </div>
      )}

      <TierPreview tier={plan.design.id} />

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-3xl font-bold leading-tight">{plan.name}</h3>
        <p className="mt-1.5 text-sm text-soft">{plan.desc}</p>

        <div className="my-6 flex items-end gap-2">
          {free ? (
            <span className="font-display text-price font-bold leading-tight text-ok">مجانية</span>
          ) : price === null ? (
            <>
              <span className="font-display text-price font-bold leading-tight text-soft">—</span>
              <span className="pb-1.5 text-xs text-soft">/ شهرياً</span>
            </>
          ) : (
            <>
              <span className="font-display text-price font-bold leading-tight tabular">{ar(price)}</span>
              <span className="pb-1.5 text-xs text-soft">ر.ي / شهرياً</span>
            </>
          )}
        </div>

        <div className="mb-5 rounded-lg border border-line bg-cream px-4 py-3">
          <p className="text-2xs font-extrabold tracking-widest text-brass-deep">درجة التصميم</p>
          <p className="mt-1 text-sm font-bold">{plan.design.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-soft">{plan.design.desc}</p>
        </div>

        <ul className="mb-6 grid flex-1 gap-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-3.5 shrink-0 text-ok" />
              <span>{f}</span>
            </li>
          ))}
          {/* ★ `text-soft` كاملاً لا `/70`.
              كان النصّ عند ٣٫٠:١ فوق الورق — دون حدّ AA. وهذه ليست
              زخرفة: «غير مشمول» هو **الفرق بين باقتين**، أي أهمّ ما
              يقرؤه من يوازن قبل الدفع. والتخفيت يبقى قائماً — `soft`
              أخفت من `ink` — لكن عند ٥٫٥٨:١ يُقرأ فعلاً. والشطب
              والأيقونة يحملان المعنى معاً، فلا يعتمد على اللون وحده. */}
          {plan.missing?.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-soft">
              <Minus className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-through decoration-soft/50">{f}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/onboarding"
          className={cn(
            'sheen group/btn inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3.5',
            'text-md font-bold transition-transform duration-200 active:scale-[.98]',
            featured ? 'bg-shop text-on-shop hover:brightness-110' : 'bg-ink text-cream hover:brightness-125',
          )}
        >
          {free ? 'ابدأ مجاناً' : 'اطلب الباقة'}
          <ArrowLeft className="size-4 transition-transform group-hover/btn:-translate-x-1" />
        </Link>
      </div>
    </LumeSurface>
  );
}

/**
 * معاينة درجة التصميم — نفس التصعيد الذي يراه عميل التاجر:
 * «نقي» مسطّح صريح · «دافئ» متدرّج وبطاقات مرفوعة ·
 * «فاخر» أرضية داكنة ووهج وحدّ نحاسي.
 */
function TierPreview({ tier }: { tier: string }) {
  const dark = tier === 'signature';
  return (
    <div
      aria-hidden
      className={cn(
        'grid h-28 grid-cols-2 grid-rows-[30px_1fr] gap-2 border-b border-line p-4',
        dark ? 'bg-ink' : 'bg-cream',
      )}
    >
      <span
        className={cn(
          'col-span-2 rounded-lg transition-transform duration-500 group-hover:scale-[1.02]',
          tier === 'clean' && 'bg-shop',
          tier === 'warm' && 'bg-gradient-to-l from-shop to-shop-lift',
          dark && 'bg-gradient-to-l from-shop to-brass shadow-[0_0_26px_-4px_rgba(var(--shop-rgb),.75)]',
        )}
      />
      {[0, 1].map((i) => (
        <span
          key={i}
          className={cn(
            'rounded-lg border transition-transform duration-500',
            dark ? 'border-brass/35 bg-cream/[.06]' : 'border-line bg-paper',
            tier === 'warm' && 'shadow-[0_6px_14px_-8px_rgba(36,31,27,.4)] group-hover:-translate-y-0.5',
          )}
        />
      ))}
    </div>
  );
}
