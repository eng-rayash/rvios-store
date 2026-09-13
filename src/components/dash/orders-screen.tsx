'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, Receipt, ShoppingCart } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { needsReview, ORDER_STATES, type OrderStatus } from '@/lib/format';
import { ar, cn } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { useDash, useStore } from '@/components/dash/dash-context';
import { OrderRow, type Order } from '@/components/dash/order-row';

type Filter = OrderStatus | 'all';

interface OrdersPage {
  orders: Order[];
  page: number;
  pages: number;
  total: number;
  counts: Record<OrderStatus, number>;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  ...(Object.keys(ORDER_STATES) as OrderStatus[]).map((id) => ({ id, label: ORDER_STATES[id].label })),
];

/**
 * شاشة الطلبات.
 *
 * ★ التصفية في الرابط (`?status=wait`) لا في حالةٍ داخلية.
 * كانت اللوحة القديمة تحفظها في متغيّر: زرّ الرجوع يُخرج التاجر من
 * اللوحة كلها بدل أن يعيده إلى «الكل»، ولا يمكنه أن يرسل لشريكه
 * رابط «الطلبات المعلّقة». والرابط يحمل الحالتين مجّاناً.
 *
 * `useSearchParams` يحتاج حدَّ Suspense، فالشاشة ملفوفة به.
 */
export function OrdersScreen() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const { store } = useStore();
  const { reloadOverview } = useDash();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get('status');
  /* `Object.hasOwn` لا `in`: `'toString' in ORDER_STATES` صحيحٌ
     بالوراثة، فرابطٌ مثل ?status=toString كان سيُقبل حالةً */
  const filter: Filter = raw && Object.hasOwn(ORDER_STATES, raw) ? (raw as OrderStatus) : 'all';

  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<Omit<OrdersPage, 'orders'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Order | null>(null);
  const seq = useRef(0);

  /**
   * ★ الترقيم والتصفية على الخادم — والعدّاد يمنع الردّ المتأخّر.
   * تعليق `dashboard.js` نفسه يشرح لماذا لا تُصفّى محلياً: «لعرضنا
   * المؤكَّدة من الصفحة الحالية فقط، فيظنّ التاجر أن لديه ٣ بينما
   * لديه ٤٠». والعدّاد: تاجرٌ يضغط «عرض المزيد» ثم يغيّر التبويب
   * قبل أن تصل الصفحة الثانية — فتُلحق طلبات التبويب القديم بالجديد.
   */
  const load = useCallback(async (page = 1) => {
    const id = ++seq.current;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (filter !== 'all') q.set('status', filter);
      const { orders: rows, ...rest } = await api.get<OrdersPage>(`/api/me/orders?${q}`);
      if (id !== seq.current) return;
      setOrders((prev) => (page === 1 ? rows : [...prev, ...rows]));
      setMeta(rest);
    } catch (e) {
      if (id !== seq.current) return;
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(messageOf(e));
    } finally {
      if (id === seq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [filter]);

  useEffect(() => { void load(1); }, [load]);

  /* الإشعار يخبو بعد أن يُقرأ — لا يبقى فوق القائمة إلى الأبد */
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  function pick(next: Filter) {
    if (next === filter) return;
    router.replace(next === 'all' ? pathname : `${pathname}?status=${next}`, { scroll: false });
  }

  async function advance(order: Order, to: OrderStatus) {
    setBusyId(order.id);
    setError(null);
    try {
      await api.patch(`/api/me/orders/${order.id}`, { status: to });
      setNotice(`${to === 'off' ? 'أُلغي' : 'حُدّث'} الطلب ${order.ref} — ${ORDER_STATES[to].label}`);
      /* النظرة العامة معها: شارة «معلّقة» في الشريط تُقرأ منها */
      await Promise.all([load(1), reloadOverview()]);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  }

  /**
   * تأكيد الدفع أو رفضه.
   *
   * ★ الرفض لا يُلغي الطلب ولا يُصفّر الدفع — يُعيده إلى «بانتظار
   * التحويل». وهو سلوك الخادم نفسه، وتعليقه يشرح السبب: «العميل
   * قد يرفع إيصالاً صحيحاً بعد خاطئ، ولا يبدأ من جديد».
   */
  async function setPayment(order: Order, paid: boolean) {
    setBusyId(order.id);
    setError(null);
    try {
      await api.patch(`/api/me/orders/${order.id}/payment`, { paid });
      setNotice(paid
        ? `أُكّد دفع الطلب ${order.ref}`
        : `أُعيد الطلب ${order.ref} إلى «بانتظار التحويل»`);
      await load(1);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  }

  const all = meta ? Object.values(meta.counts).reduce((a, n) => a + n, 0) : undefined;

  return (
    <div className="space-y-base">
      <div
        role="group"
        aria-label="تصفية حسب الحالة"
        className="-mx-base flex gap-2 overflow-x-auto px-base pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const n = f.id === 'all' ? all : meta?.counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => pick(f.id)}
              className={cn(
                'shrink-0 rounded-pill border px-3.5 py-1.5 text-sm font-bold transition-colors',
                on ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-soft hover:border-ink hover:text-ink',
              )}
            >
              {f.label}
              {n !== undefined && (
                <span className={cn('ms-1.5 tabular font-semibold', on ? 'text-cream/70' : 'text-soft')}>{ar(n)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* منطقةٌ حيّة مركّبة دائماً — وإلا لم يُعلَن الإشعار الأوّل */}
      <p
        role="status"
        className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}
      >
        {notice}
      </p>

      {error && (
        <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>
      )}

      <Plaque as="section" aria-label="قائمة الطلبات" aria-busy={loading} className="overflow-hidden">
        {loading && !orders.length ? (
          <ListSkeleton bare />
        ) : orders.length ? (
          <div className="divide-y divide-line">
            {orders.map((o) => {
              const state = ORDER_STATES[o.status];
              const busy = busyId === o.id;
              return (
                <OrderRow
                  key={o.id}
                  order={o}
                  currency={store.currency}
                  showItems
                  actions={
                    <>
                      {o.wa && (
                        <a
                          href={o.wa}
                          target="_blank"
                          rel="noopener"
                          className={buttonVariants({ tone: 'wa', size: 'sm' })}
                        >
                          <MessageCircle className="size-3.5" aria-hidden />
                          واتساب
                          <span className="sr-only"> (يُفتح في نافذة جديدة)</span>
                        </a>
                      )}
                      {/* ★ مراجعة الإيصال: تظهر حين يكون الدور على
                          التاجر وحده (`pending`)، ومعها الإيصال نفسه
                          — قرارٌ لا يُتّخذ دون رؤية ما يُقرَّر فيه. */}
                      {needsReview(o.pay_status) && (
                        <>
                          {o.pay_proof && (
                            <a
                              href={o.pay_proof}
                              target="_blank"
                              rel="noopener"
                              className={buttonVariants({ tone: 'line', size: 'sm' })}
                            >
                              <Receipt className="size-3.5" aria-hidden />
                              الإيصال
                              <span className="sr-only"> (يُفتح في نافذة جديدة)</span>
                            </a>
                          )}
                          <Button size="sm" busy={busy} onClick={() => setPayment(o, true)}>
                            أكّد الدفع
                          </Button>
                          <Button
                            tone="ghost"
                            size="sm"
                            disabled={busyId !== null}
                            onClick={() => setPayment(o, false)}
                          >
                            الإيصال غير صحيح
                          </Button>
                        </>
                      )}

                      {state.next && (
                        <Button tone="line" size="sm" busy={busy} onClick={() => advance(o, state.next!.to)}>
                          {state.next.label}
                        </Button>
                      )}
                      {state.cancellable && (
                        <Button
                          tone="ghost"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => setConfirming(o)}
                          className="text-danger enabled:hover:bg-danger/10 enabled:hover:text-danger"
                        >
                          إلغاء
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ShoppingCart className="size-6" aria-hidden />}
            title={filter === 'all' ? 'لا طلبات بعد' : `لا طلبات «${ORDER_STATES[filter].label}»`}
          >
            {filter === 'all'
              ? 'حين يطلب عميلٌ من متجرك يظهر طلبه هنا.'
              : 'غيّر التصفية لترى بقية الطلبات.'}
          </EmptyState>
        )}
      </Plaque>

      {meta && orders.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-1">
          {meta.page < meta.pages && (
            <Button tone="line" busy={loadingMore} onClick={() => load(meta.page + 1)}>
              عرض المزيد
            </Button>
          )}
          <small className="text-xs text-soft">
            <span className="tabular">{ar(orders.length)}</span> من <span className="tabular">{ar(meta.total)}</span>
          </small>
        </div>
      )}

      {/* ★ الإلغاء يُؤكَّد — وكان يُنفَّذ من أوّل نقرة.
          الإلغاء نهائي (لا انتقال بعده في `ORDER_STATES` بالخادم)
          ويُعيد الكمّيات إلى المخزون. ونقرةٌ خاطئة على هاتفٍ في
          اليد تُلغي طلب عميلٍ حقيقي بلا رجعة. والتركيز الأوّل في
          النافذة يقع على «إغلاق» لا على زرّ الإلغاء — فضغطةُ Enter
          المتسرّعة لا تُكمل ما بدأته النقرة الخاطئة. */}
      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title="إلغاء الطلب؟" side="center">
        {confirming && (
          <>
            <p className="text-sm leading-loose text-soft">
              سيُلغى الطلب <bdi className="font-bold tabular text-ink">{confirming.ref}</bdi>
              {' '}من {confirming.cust_name || 'العميل'}، وتعود كمّياته إلى المخزون.
              {' '}<b className="text-ink">لا يمكن التراجع عن الإلغاء.</b>
            </p>
            <div className="mt-roomy flex flex-wrap gap-snug">
              <Button
                busy={busyId === confirming.id}
                onClick={() => advance(confirming, 'off')}
                className="bg-danger text-white enabled:hover:bg-[#a11]"
              >
                ألغِ الطلب
              </Button>
              <Button tone="line" onClick={() => setConfirming(null)} disabled={busyId === confirming.id}>
                تراجع
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function ListSkeleton({ bare = false }: { bare?: boolean }) {
  const rows = (
    <div className="divide-y divide-line" aria-busy="true" aria-label="جارٍ تحميل الطلبات">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-base px-5 py-4">
          <Skeleton className="h-4 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-pill" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
  return bare ? rows : <Plaque className="overflow-hidden">{rows}</Plaque>;
}
