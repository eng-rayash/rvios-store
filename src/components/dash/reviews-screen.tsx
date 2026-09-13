'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, Eye, EyeOff, MessageSquare, Star } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { when } from '@/lib/format';
import { ar, cn } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { Stat } from '@/components/dash/stat';

interface Review {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  rating: number;
  name: string;
  body: string;
  verified: boolean;
  hidden: boolean;
  reply: string;
  replyAt: string | null;
  createdAt: string;
}

interface Summary { count: number; average: number; hidden: number; low: number; unanswered: number }

interface ReviewsRes {
  reviews: Review[];
  total: number; page: number; per: number; pages: number;
  summary: Summary;
}

const FILTERS = [
  { id: '', label: 'الكل' },
  { id: 'unanswered', label: 'بلا ردّ' },
  { id: 'low', label: 'منخفضة' },
  { id: 'hidden', label: 'المخفيّة' },
] as const;

const VALID = new Set(FILTERS.map((f) => f.id));

/**
 * شاشة التقييمات.
 *
 * ★ المبدأ منقول من اللوحة القديمة ومكتوبٌ في الخادم أيضاً:
 * التاجر لا يحذف رأي عميل ولا يعدّله — يُخفي ويردّ. وحذفُ رأيٍ
 * يجعل التقييمات دعاية، والإخفاء يُبقي الصفّ في القاعدة فيبقى
 * للإدارة ما تحتكم إليه عند نزاع. والواجهة تقول هذا صراحةً بدل
 * أن يبحث التاجر عن زرّ حذفٍ لا وجود له.
 */
export function ReviewsScreen() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Reviews />
    </Suspense>
  );
}

function Reviews() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get('filter') ?? '';
  const filter = VALID.has(raw as typeof FILTERS[number]['id']) ? raw : '';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState<Omit<ReviewsRes, 'reviews'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [replying, setReplying] = useState<Review | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (page = 1) => {
    const id = ++seq.current;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (filter) q.set('filter', filter);
      const { reviews: rows, ...rest } = await api.get<ReviewsRes>(`/api/me/reviews?${q}`);
      if (id !== seq.current) return;
      setReviews((prev) => (page === 1 ? rows : [...prev, ...rows]));
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

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function patch(review: Review, body: { hidden?: boolean; reply?: string }, message: string) {
    setBusyId(review.id);
    setError(null);
    try {
      await api.patch(`/api/me/reviews/${review.id}`, body);
      setNotice(message);
      await load(1);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
      setReplying(null);
    }
  }

  const s = meta?.summary;

  return (
    <div className="space-y-base">
      <dl className="grid grid-cols-2 gap-base lg:grid-cols-3">
        <Stat
          label="متوسّط التقييم"
          value={s ? (s.count ? s.average.toLocaleString('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—') : '—'}
          unit={s?.count ? `من ٥` : undefined}
          icon={<Star />}
        />
        <Stat label="عدد التقييمات" value={s ? ar(s.count) : '—'} icon={<MessageSquare />} />
        <Stat
          label="بانتظار ردّك"
          value={s ? ar(s.unanswered) : '—'}
          hot={!!s && s.unanswered > 0}
          icon={<MessageSquare />}
          className="max-lg:col-span-2"
        />
      </dl>

      <Plaque className="px-5 py-3.5">
        <p className="text-xs leading-loose text-soft">
          التقييمات تُنشر فور كتابتها. <b className="text-ink">لا يمكنك تعديل رأي عميل ولا حذفه</b> —
          تُخفي المسيء وتردّ على الباقي، والردّ العلني أنفع لك من الإخفاء.
        </p>
      </Plaque>

      <div
        role="group"
        aria-label="تصفية التقييمات"
        className="-mx-base flex gap-2 overflow-x-auto px-base pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const n = f.id === '' ? s?.count : f.id === 'unanswered' ? s?.unanswered : f.id === 'low' ? s?.low : s?.hidden;
          return (
            <button
              key={f.id || 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => router.replace(f.id ? `${pathname}?filter=${f.id}` : pathname, { scroll: false })}
              className={cn(
                'shrink-0 rounded-pill border px-3.5 py-1.5 text-sm font-bold transition-colors',
                on ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-soft hover:border-ink hover:text-ink',
              )}
            >
              {f.label}
              {n !== undefined && <span className={cn('ms-1.5 tabular font-semibold', on ? 'text-cream/70' : 'text-soft')}>{ar(n)}</span>}
            </button>
          );
        })}
      </div>

      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <Plaque as="section" aria-label="قائمة التقييمات" aria-busy={loading} className="overflow-hidden">
        {loading && !reviews.length ? (
          <ListSkeleton bare />
        ) : reviews.length ? (
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className={cn('px-5 py-4', r.hidden && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-x-snug gap-y-1.5">
                  <Stars rating={r.rating} />
                  <b className="text-sm">{r.name}</b>
                  {r.verified && (
                    <Badge tone="ok" dot={false}>
                      <BadgeCheck className="size-3" aria-hidden />
                      مشترٍ موثّق
                    </Badge>
                  )}
                  {r.hidden && <Badge tone="done">مخفي</Badge>}
                  <time dateTime={r.createdAt} className="ms-auto text-xs text-soft">{when(r.createdAt)}</time>
                </div>

                <p className="mt-1 text-2xs text-soft">على «{r.productName}»</p>

                {r.body
                  ? <p className="mt-2 text-sm leading-body">{r.body}</p>
                  : <p className="mt-2 text-sm text-soft italic">قيّم بلا تعليق.</p>}

                {r.reply && (
                  <div className="mt-2.5 rounded-sm border-s-2 border-shop bg-sand px-3 py-2.5">
                    <b className="block text-2xs text-shop-text">ردّك</b>
                    <p className="mt-0.5 text-sm leading-body">{r.reply}</p>
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button tone="line" size="sm" onClick={() => setReplying(r)} disabled={busyId !== null}>
                    {r.reply ? 'عدّل ردّك' : 'ردّ'}
                  </Button>
                  <Button
                    tone="ghost"
                    size="sm"
                    busy={busyId === r.id}
                    onClick={() => patch(r, { hidden: !r.hidden }, r.hidden ? 'أُظهر التقييم' : 'أُخفي التقييم')}
                    icon={r.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  >
                    {r.hidden ? 'أظهره' : 'أخفِه'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Star className="size-6" aria-hidden />}
            title={filter ? 'لا تقييمات في هذه التصفية' : 'لا تقييمات بعد'}
          >
            {filter ? 'غيّر التصفية لترى البقية.' : 'يكتب العميل تقييمه من صفحة المنتج بعد شرائه.'}
          </EmptyState>
        )}
      </Plaque>

      {meta && reviews.length > 0 && meta.page < meta.pages && (
        <div className="flex justify-center pt-1">
          <Button tone="line" busy={loadingMore} onClick={() => load(meta.page + 1)}>عرض المزيد</Button>
        </div>
      )}

      <ReplySheet
        review={replying}
        busy={busyId !== null}
        onClose={() => setReplying(null)}
        onSave={(text) => replying && patch(replying, { reply: text }, text ? 'نُشر ردّك' : 'حُذف ردّك')}
      />
    </div>
  );
}

function ReplySheet({
  review, busy, onClose, onSave,
}: { review: Review | null; busy: boolean; onClose: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState('');

  useEffect(() => { if (review) setText(review.reply ?? ''); }, [review]);

  return (
    <Sheet
      open={review !== null}
      onClose={onClose}
      title="الردّ على التقييم"
      side="center"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={() => onSave(text.trim())}>انشر الردّ</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {review && (
        <>
          <blockquote className="mb-base rounded-sm bg-sand px-3.5 py-3">
            <Stars rating={review.rating} />
            <p className="mt-1.5 text-sm leading-body">{review.body || 'قيّم بلا تعليق.'}</p>
          </blockquote>
          <label htmlFor="reply-text" className="mb-1.5 block text-xs font-bold">ردّك العلني</label>
          <textarea
            id="reply-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={600}
            rows={5}
            className="w-full resize-y rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5 leading-body transition-colors focus-visible:border-shop focus-visible:ring-[3px] focus-visible:ring-shop/20 focus-visible:outline-none"
          />
          <small className="mt-1.5 block text-2xs text-soft">
            يظهر ردّك تحت التقييم في صفحة المنتج. وتفريغ الحقل يحذف الردّ.
          </small>
        </>
      )}
    </Sheet>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${ar(rating)} من ٥`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden className={cn('size-3.5', i < rating ? 'fill-brass text-brass' : 'fill-line text-line')} />
      ))}
    </span>
  );
}

function ListSkeleton({ bare = false }: { bare?: boolean }) {
  const rows = (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="جارٍ تحميل التقييمات">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="space-y-2 px-5 py-4">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-full max-w-md" />
          <Skeleton className="h-3 w-2/3" />
        </li>
      ))}
    </ul>
  );
  return bare ? rows : <Plaque className="overflow-hidden">{rows}</Plaque>;
}
