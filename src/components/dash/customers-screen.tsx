'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { when } from '@/lib/format';
import { ar, cn, plural } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Stat } from '@/components/dash/stat';
import { useStore } from '@/components/dash/dash-context';

interface Customer {
  id: number;
  phone: string;
  name: string;
  address: string;
  first_at: string;
  last_at: string;
  orders_count: number;
  spent: number;
  last_order: string | null;
}

interface CustomersRes { customers: Customer[]; total: number; returning: number }

/** الخادم يقصر القائمة على هذا العدد — نقولها للتاجر بدل أن يظنّ أن عملاءه نقصوا */
const SERVER_LIMIT = 300;

/**
 * شاشة العملاء.
 *
 * ★ «العائدون» مؤشّرٌ أوّل لا عمودٌ في جدول.
 * تعليق الخادم يسمّيهم «الحجّة البيعية الحقيقية للتاجر» — ومع
 * ذلك كانت اللوحة القديمة تعرض العدد الكلّي وحده في شارةٍ صغيرة.
 * وعميلٌ اشترى مرّتين يقول عن المتجر ما لا تقوله مئة زيارة.
 */
export function CustomersScreen() {
  const { store } = useStore();
  const [data, setData] = useState<CustomersRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<CustomersRes>('/api/me/customers'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.customers ?? [];

  return (
    <div className="space-y-base">
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <dl className="grid grid-cols-2 gap-base">
        <Stat label="عملاء المتجر" value={data ? ar(data.total) : '—'} icon={<Users />} />
        <Stat
          label="عملاء عادوا وطلبوا مجدداً"
          value={data ? ar(data.returning) : '—'}
          hot={!!data && data.returning > 0}
          icon={<Users />}
        />
      </dl>

      <Plaque as="section" aria-label="قائمة العملاء" aria-busy={loading} className="overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : rows.length ? (
          <>
            <table className="hidden w-full border-collapse md:table">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">العميل</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">الجوال</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">الطلبات</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">إجمالي المشتريات</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">آخر طلب</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line transition-colors last:border-0 hover:bg-cream">
                    <td className="px-5 py-3"><Name customer={c} /></td>
                    <td className="px-5 py-3"><Phone phone={c.phone} /></td>
                    <td className="px-5 py-3 text-sm tabular">{ar(c.orders_count)}</td>
                    <td className="px-5 py-3"><Spent value={c.spent} currency={store.currency} /></td>
                    <td className="px-5 py-3 text-xs text-soft">{c.last_order ? when(c.last_order) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((c) => (
                <li key={c.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-base">
                    <span className="min-w-0 flex-1"><Name customer={c} /></span>
                    <Spent value={c.spent} currency={store.currency} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-base gap-y-1 text-xs text-soft">
                    <Phone phone={c.phone} />
                    <span className="tabular">{ar(c.orders_count)} {plural(c.orders_count, ['طلب', 'طلبان', 'طلبات', 'طلباً'])}</span>
                    {c.last_order && <span>آخر طلب {when(c.last_order)}</span>}
                  </div>
                </li>
              ))}
            </ul>

            {rows.length >= SERVER_LIMIT && (
              <p className="border-t border-line px-5 py-3 text-xs text-soft">
                تُعرض آخر <span className="tabular">{ar(SERVER_LIMIT)}</span> عميلاً نشاطاً.
              </p>
            )}
          </>
        ) : (
          <EmptyState icon={<Users className="size-6" aria-hidden />} title="لا عملاء بعد">
            يُسجَّل العميل هنا تلقائياً مع أوّل طلب يرسله من متجرك.
          </EmptyState>
        )}
      </Plaque>
    </div>
  );
}

function Name({ customer: c }: { customer: Customer }) {
  return (
    <span className="block min-w-0">
      <b className="block truncate text-sm">{c.name || 'عميل'}</b>
      {c.orders_count > 1 && (
        <Badge tone="brass" dot={false} className="mt-1">عميل عائد</Badge>
      )}
      {c.address && <small className="mt-0.5 block truncate text-2xs text-soft">{c.address}</small>}
    </span>
  );
}

/**
 * ★ رقمٌ قابل للاتصال لا نصّاً يُنسخ يدوياً.
 * التاجر يتابع طلباً فيحتاج الرقم في يده — و`tel:` تفتح المتصل
 * على الهاتف مباشرةً. و`bdi` تعزل الرقم اللاتيني داخل سطرٍ عربي.
 */
function Phone({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} className="text-xs text-soft underline-offset-2 hover:text-ink hover:underline">
      <bdi className="tabular">{phone}</bdi>
    </a>
  );
}

function Spent({ value, currency }: { value: number; currency: string }) {
  return (
    <span className="whitespace-nowrap text-sm font-semibold tabular">
      {ar(value)} <span className="text-2xs font-normal text-soft">{currency}</span>
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="جارٍ تحميل العملاء">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-base px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
