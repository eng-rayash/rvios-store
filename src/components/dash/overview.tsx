'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, ExternalLink, Eye, Package, RotateCw, ShoppingCart } from 'lucide-react';
import { ar, cn } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useDash, useStore } from '@/components/dash/dash-context';
import { Stat } from '@/components/dash/stat';
import { OrderRow } from '@/components/dash/order-row';
import { CapacityMeter } from '@/components/dash/capacity-meter';
import { VisitsChart } from '@/components/dash/visits-chart';

/**
 * النظرة العامة.
 *
 * ★ الترتيب يتبع المبدأ المكتوب في رأس `dashboard.js`:
 * «أول مؤشر يراه التاجر هو الطلبات المنتظرة، لأن سرعة ردّه هي
 * عنق الزجاجة الحقيقي في تدفّق واتساب». واللوحة القديمة كتبت
 * المبدأ ثم وضعت **الرسم البياني** قبل الطلبات. هنا الطلبات
 * ثانياً بعد المؤشّرات مباشرةً، والرسم آخراً — على كل المقاسات،
 * وبترتيب المصدر نفسه، فقارئ الشاشة يسمع الأولويّة ذاتها.
 *
 * ★ وعلى الهاتف يمتدّ المؤشّران الأهمّ عرضاً كاملاً.
 * «الطلبات المعلّقة» لأنها تتطلّب فعلاً الآن، و«المبيعات» لأن
 * مبلغها بسبعة أرقام لا يتّسع في نصف عرض هاتف. والاثنان
 * الآخران معلومةٌ تُقرأ بنظرة، فيتقاسمان صفّاً — تكوينٌ للهاتف
 * لا شبكة المكتب مضغوطة.
 */
export function OverviewScreen() {
  const { store, plan } = useStore();
  const { overview, reloadOverview } = useDash();
  const { data, error } = overview;

  if (!data && error) {
    return (
      <EmptyState
        icon={<RotateCw className="size-6" aria-hidden />}
        title="تعذّر تحميل النظرة العامة"
        action={<Button tone="line" onClick={reloadOverview}>حاول مجدداً</Button>}
      >
        {error}
      </EmptyState>
    );
  }

  if (!data) return <OverviewSkeleton />;

  const { kpis, chart, capacity, recent } = data;

  return (
    <div className="space-y-base">
      <dl className="grid grid-cols-2 gap-base lg:grid-cols-4">
        <Stat
          hot={kpis.pending > 0}
          label="طلبات قيد التأكيد"
          value={ar(kpis.pending)}
          icon={<ShoppingCart />}
          className="col-span-2 lg:col-span-1"
        />
        <Stat label="زيارات هذا الأسبوع" value={ar(kpis.visits)} icon={<Eye />} />
        <Stat label="المنتجات المنشورة" value={ar(kpis.products)} icon={<Package />} />
        <Stat
          label="مبيعات مؤكّدة هذا الشهر"
          value={ar(kpis.confirmed)}
          unit={store.currency}
          icon={<Banknote />}
          className="col-span-2 lg:col-span-1"
        />
      </dl>

      <div className="grid items-start gap-base lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Plaque as="section" aria-labelledby="recent-h" className="overflow-hidden">
          <header className="flex items-center gap-snug border-b border-line px-5 py-3.5">
            <h2 id="recent-h" className="font-heading flex-1 text-md font-bold">أحدث الطلبات</h2>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-1 text-sm font-bold text-shop-text hover:underline"
            >
              عرض الكل <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          </header>

          {recent.length ? (
            <div className="divide-y divide-line">
              {recent.map((o) => <OrderRow key={o.id} order={o} currency={store.currency} />)}
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingCart className="size-6" aria-hidden />}
              title="لا طلبات بعد"
              action={
                <a
                  href={`/${store.slug}`}
                  target="_blank"
                  rel="noopener"
                  className={cn(buttonVariants({ tone: 'line', size: 'sm' }))}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  افتح متجرك
                </a>
              }
            >
              شارك رابط متجرك في حالة واتساب أو مجموعاتك — أوّل طلب يصل يظهر هنا.
            </EmptyState>
          )}
        </Plaque>

        <CapacityMeter planName={plan.name} cap={capacity} />
      </div>

      <Plaque as="section" aria-labelledby="chart-h" className="px-5 pt-4 pb-5">
        <h2 id="chart-h" className="font-heading mb-base text-md font-bold">الزيارات والطلبات — آخر سبعة أيام</h2>
        <VisitsChart rows={chart} />
      </Plaque>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-base" aria-busy="true" aria-label="جارٍ تحميل النظرة العامة">
      <div className="grid grid-cols-2 gap-base lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={cn('h-[92px] rounded-lg', (i === 0 || i === 3) && 'col-span-2 lg:col-span-1')} />
        ))}
      </div>
      <div className="grid gap-base lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
