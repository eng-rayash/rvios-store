'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  LayoutGrid, Rows3, SlidersHorizontal, Star, X, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import type { ProductView } from '@/lib/store';
import { ar, cn, items } from '@/lib/utils';
import { useCurrency } from '../currency';
import { usePro } from './context';
import { ProCard, discountOf } from './pro-card';

const PER_PAGE = 12;

export type ShopQuery = {
  q: string;
  cat: number | null;
  brands: string[];
  min: number | null;
  max: number | null;
  rating: number;
  deals: boolean;
  wish: boolean;
  sort: SortId;
};

type SortId = 'new' | 'cheap' | 'dear' | 'rated' | 'off';

const SORTS: { id: SortId; name: string }[] = [
  { id: 'new', name: 'الأحدث أولاً' },
  { id: 'cheap', name: 'السعر: من الأقل' },
  { id: 'dear', name: 'السعر: من الأعلى' },
  { id: 'rated', name: 'الأعلى تقييماً' },
  { id: 'off', name: 'الأكبر خصماً' },
];

/**
 * صفحة «المتجر» — الشبكة الكاملة بمرشّحاتها.
 *
 * المرشّحات تعيش في **الرابط** لا في الذاكرة وحدها: العميل
 * يرسل ما وجده إلى صديقه، ويعود إليه من سجلّ متصفّحه، ويحدّث
 * الصفحة بلا أن يفقد اختياره. وهذا فرق صفحة متجرٍ عن لوحة
 * تحكّم — الأولى تُشارَك والثانية تُستعمل مرة.
 *
 * ولا يوجد مرشّح بلا مصدر في القاعدة: «العلامات التجارية» تظهر
 * حين يكتب التاجر ماركات، و«التقييم» يظهر حين يقيّم الناس
 * فعلاً. المرشّح الذي لا يرشّح شيئاً يُخفى بدل أن يُعرض معطّلاً.
 */
export function ProShop({ products, initial }: {
  products: ProductView[];
  initial: ShopQuery;
}) {
  const { store, categories, brands, wished } = usePro();
  const cur = useCurrency();
  const reduced = useReducedMotion();

  const [f, setF] = useState<ShopQuery>(initial);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState(false);

  const bounds = useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [products]);

  // كم منتجاً وراء كل نجمة — الرقم بجوار المرشّح يمنع اختياراً
  // يقود إلى شبكة فارغة
  const ratingTally = useMemo(() => {
    const t = [0, 0, 0, 0, 0, 0];
    for (const p of products) if (p.reviewCount > 0) t[Math.round(p.rating)]++;
    return t;
  }, [products]);

  const hasRatings = products.some((p) => p.reviewCount > 0);

  const shown = useMemo(() => {
    const needle = f.q.trim();
    const out = products.filter((p) => {
      if (f.cat !== null && p.categoryId !== f.cat) return false;
      if (f.brands.length && !f.brands.includes(p.brand)) return false;
      if (f.min !== null && p.price < f.min) return false;
      if (f.max !== null && p.price > f.max) return false;
      if (f.rating > 0 && (p.reviewCount === 0 || p.rating < f.rating)) return false;
      if (f.deals && discountOf(p) === 0) return false;
      if (f.wish && !wished(p.id)) return false;
      if (needle && !(`${p.name} ${p.summary} ${p.variant} ${p.brand}`).includes(needle)) return false;
      return true;
    });

    const by: Record<SortId, (a: ProductView, b: ProductView) => number> = {
      new: () => 0,                                    // ترتيب التاجر كما هو
      cheap: (a, b) => a.price - b.price,
      dear: (a, b) => b.price - a.price,
      rated: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      off: (a, b) => discountOf(b) - discountOf(a),
    };
    return [...out].sort(by[f.sort]);
  }, [products, f, wished]);

  // أي تغيير في الترشيح يعيدنا إلى الصفحة الأولى — وإلا وقف
  // العميل على صفحة ٤ من نتيجة صارت صفحتين
  useEffect(() => { setPage(1); }, [f]);

  /** الحالة تُكتب في الرابط بلا إعادة تحميل ولا إضافة سجلّ لكل ضغطة */
  useEffect(() => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.cat !== null) p.set('cat', String(f.cat));
    for (const b of f.brands) p.append('brand', b);
    if (f.min !== null) p.set('min', String(f.min));
    if (f.max !== null) p.set('max', String(f.max));
    if (f.rating) p.set('rating', String(f.rating));
    if (f.deals) p.set('deals', '1');
    if (f.wish) p.set('wish', '1');
    if (f.sort !== 'new') p.set('sort', f.sort);
    if (page > 1) p.set('page', String(page));

    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [f, page]);

  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const at = Math.min(page, pages);
  const slice = shown.slice((at - 1) * PER_PAGE, at * PER_PAGE);
  const fresh = useMemo(() => new Set(products.slice(0, 6).map((p) => p.id)), [products]);

  const clean: ShopQuery = {
    q: '', cat: null, brands: [], min: null, max: null,
    rating: 0, deals: false, wish: false, sort: 'new',
  };

  const dirty = f.q !== '' || f.cat !== null || f.brands.length > 0
    || f.min !== null || f.max !== null || f.rating > 0 || f.deals || f.wish;

  const sidebar = (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">تصفية النتائج</h2>
        {dirty && (
          <button
            type="button" onClick={() => setF(clean)}
            className="text-[11px] font-bold text-shop-text hover:underline"
          >
            إعادة تعيين
          </button>
        )}
      </div>

      <Group title="الفئات">
        <Row
          on={f.cat === null} count={products.length}
          onClick={() => setF((v) => ({ ...v, cat: null }))}
        >
          جميع المنتجات
        </Row>
        {categories.map((c) => (
          <Row
            key={c.id} on={f.cat === c.id} count={c.count}
            onClick={() => setF((v) => ({ ...v, cat: v.cat === c.id ? null : c.id }))}
          >
            {c.name}
          </Row>
        ))}
      </Group>

      <Group title="السعر">
        <div className="flex items-center gap-2">
          <Money
            value={f.min} placeholder={ar(bounds.min)} label="أقلّ سعر"
            onChange={(n) => setF((v) => ({ ...v, min: n }))} cur={cur}
          />
          <span className="text-soft">—</span>
          <Money
            value={f.max} placeholder={ar(bounds.max)} label="أعلى سعر"
            onChange={(n) => setF((v) => ({ ...v, max: n }))} cur={cur}
          />
        </div>
      </Group>

      {brands.length > 0 && (
        <Group title="العلامات التجارية">
          {brands.map((b) => (
            <label
              key={b.name}
              className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="checkbox" checked={f.brands.includes(b.name)}
                  onChange={() => setF((v) => ({
                    ...v,
                    brands: v.brands.includes(b.name)
                      ? v.brands.filter((x) => x !== b.name)
                      : [...v.brands, b.name],
                  }))}
                  className="size-4 accent-[var(--color-shop)]"
                />
                <span className="font-bold">{b.name}</span>
              </span>
              <span className="tabular text-[11px] text-soft">({ar(b.count)})</span>
            </label>
          ))}
        </Group>
      )}

      {hasRatings && (
        <Group title="التقييم">
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n} type="button"
              onClick={() => setF((v) => ({ ...v, rating: v.rating === n ? 0 : n }))}
              aria-pressed={f.rating === n}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5',
                'transition-colors hover:bg-paper',
                f.rating === n && 'bg-shop-veil',
              )}
            >
              <span className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn('size-3.5', i <= n
                      ? 'fill-brass text-brass'
                      : 'fill-line/60 text-line/60')}
                  />
                ))}
              </span>
              <span className="tabular text-[11px] text-soft">({ar(ratingTally[n])})</span>
            </button>
          ))}
        </Group>
      )}

      <Group title="أخرى">
        <Row
          on={f.deals} count={products.filter((p) => discountOf(p) > 0).length}
          onClick={() => setF((v) => ({ ...v, deals: !v.deals }))}
        >
          العروض فقط
        </Row>
        <Row on={f.wish} onClick={() => setF((v) => ({ ...v, wish: !v.wish }))}>
          المفضّلة لديّ
        </Row>
      </Group>
    </div>
  );

  return (
    <main className="mx-auto w-[min(1280px,100%-2rem)] pt-6">
      {/* لافتة الصفحة */}
      <div className="relative overflow-hidden rounded-2xl bg-ink">
        {(store.showcase || store.banner) && (
          <Image
            src={store.showcase || store.banner} alt="" fill priority sizes="100vw"
            className="object-cover opacity-70"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-ink/70 to-ink" />
        <div className="relative p-8 sm:p-12">
          <h1 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold text-cream">
            المتجر
          </h1>
          <p className="mt-2 text-sm text-cream/75">
            {store.tagline || `اكتشف مجموعة مختارة من ${store.name}`}
          </p>
        </div>
      </div>

      {/* فتات الخبز */}
      <nav aria-label="المسار" className="flex items-center gap-2 py-5 text-[11px] text-soft">
        <Link href={`/${store.slug}`} className="hover:text-shop-text">الرئيسية</Link>
        <ChevronLeft className="size-3.5" />
        <span className="font-bold text-ink">المتجر</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        {/* الشريط الجانبي — على الجوال يفتح كدرج */}
        <aside className="hidden lg:block">
          <div className="sticky top-[7.5rem] rounded-2xl border border-line bg-paper p-6">
            {sidebar}
          </div>
        </aside>

        <div>
          {/* شريط الأدوات */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line
                          bg-paper px-4 py-3">
            <button
              type="button" onClick={() => setPanel(true)}
              className="flex items-center gap-2 rounded-lg border border-line bg-cream px-3.5
                         py-2 text-xs font-bold lg:hidden"
            >
              <SlidersHorizontal className="size-3.5" />
              تصفية
            </button>

            <label className="flex items-center gap-2 text-xs">
              <span className="sr-only">ترتيب النتائج</span>
              <select
                value={f.sort}
                onChange={(e) => setF((v) => ({ ...v, sort: e.target.value as SortId }))}
                className="rounded-lg border border-line bg-cream px-3 py-2 text-xs font-bold
                           outline-none focus:border-shop"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <p className="tabular text-xs text-soft">
              {shown.length === 0
                ? 'لا نتائج'
                : `عرض ${ar((at - 1) * PER_PAGE + 1)}–${ar(Math.min(at * PER_PAGE, shown.length))} من ${items(shown.length)}`}
            </p>

            <div className="ms-auto flex items-center gap-1 rounded-lg border border-line
                            bg-cream p-1">
              <ViewButton on={view === 'grid'} onClick={() => setView('grid')} label="عرض شبكي">
                <LayoutGrid className="size-4" />
              </ViewButton>
              <ViewButton on={view === 'list'} onClick={() => setView('list')} label="عرض قائمة">
                <Rows3 className="size-4" />
              </ViewButton>
            </div>
          </div>

          {/* رقائق الترشيح الفعّال */}
          {dirty && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {f.q && <Pill onClear={() => setF((v) => ({ ...v, q: '' }))}>بحث: {f.q}</Pill>}
              {f.cat !== null && (
                <Pill onClear={() => setF((v) => ({ ...v, cat: null }))}>
                  {categories.find((c) => c.id === f.cat)?.name}
                </Pill>
              )}
              {f.brands.map((b) => (
                <Pill key={b} onClear={() => setF((v) => ({
                  ...v, brands: v.brands.filter((x) => x !== b),
                }))}>
                  {b}
                </Pill>
              ))}
              {(f.min !== null || f.max !== null) && (
                <Pill onClear={() => setF((v) => ({ ...v, min: null, max: null }))}>
                  {ar(f.min ?? bounds.min)}–{ar(f.max ?? bounds.max)} {cur}
                </Pill>
              )}
              {f.rating > 0 && (
                <Pill onClear={() => setF((v) => ({ ...v, rating: 0 }))}>
                  {ar(f.rating)} نجوم فأكثر
                </Pill>
              )}
              {f.deals && <Pill onClear={() => setF((v) => ({ ...v, deals: false }))}>العروض فقط</Pill>}
              {f.wish && <Pill onClear={() => setF((v) => ({ ...v, wish: false }))}>المفضّلة</Pill>}
            </div>
          )}

          {/* الشبكة */}
          {slice.length === 0 ? (
            <div className="grid place-items-center gap-3 rounded-2xl border border-line
                            bg-paper py-24 text-center">
              <Search className="size-10 text-line" strokeWidth={1.2} />
              <p className="text-sm text-soft">
                {f.wish
                  ? 'لم تضِف شيئاً إلى المفضّلة بعد'
                  : 'لا منتجات تطابق هذا الترشيح'}
              </p>
              {dirty && (
                <button
                  type="button" onClick={() => setF(clean)}
                  className="text-xs font-bold text-shop-text underline underline-offset-4"
                >
                  اعرض كل المنتجات
                </button>
              )}
            </div>
          ) : (
            <div className={cn(
              view === 'grid'
                ? 'grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-4',
            )}>
              {slice.map((p, i) => (
                <ProCard
                  key={p.id} product={p} index={i}
                  fresh={fresh.has(p.id)} layout={view}
                />
              ))}
            </div>
          )}

          {/* التصفّح */}
          {pages > 1 && (
            <nav aria-label="صفحات النتائج" className="mt-10 flex items-center justify-center gap-2">
              <Page
                disabled={at === 1} onClick={() => setPage(at - 1)} label="السابق"
              >
                <ChevronRight className="size-4" />
              </Page>

              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n} type="button" onClick={() => setPage(n)}
                  aria-current={n === at ? 'page' : undefined}
                  className={cn(
                    'tabular grid size-10 place-items-center rounded-lg border text-xs font-bold',
                    'transition-colors',
                    n === at
                      ? 'border-shop bg-shop text-on-shop'
                      : 'border-line bg-cream hover:border-shop hover:text-shop-text',
                  )}
                >
                  {ar(n)}
                </button>
              ))}

              <Page
                disabled={at === pages} onClick={() => setPage(at + 1)} label="التالي"
              >
                <ChevronLeft className="size-4" />
              </Page>
            </nav>
          )}
        </div>
      </div>

      {/* درج الترشيح على الجوال */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.div
              initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              onClick={() => setPanel(false)}
              className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={reduced ? false : { x: '-100%' }} animate={{ x: 0 }}
              exit={reduced ? undefined : { x: '-100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              className="fixed inset-y-0 start-0 z-50 w-[min(20rem,88vw)] overflow-y-auto
                         bg-cream p-6 lg:hidden"
              role="dialog" aria-label="تصفية النتائج"
            >
              <button
                type="button" onClick={() => setPanel(false)} aria-label="إغلاق"
                className="mb-5 grid size-9 place-items-center rounded-full border border-line"
              >
                <X className="size-4" />
              </button>
              {sidebar}
              <button
                type="button" onClick={() => setPanel(false)}
                className="mt-8 w-full rounded-pill bg-shop py-3.5 text-sm font-bold text-on-shop"
              >
                عرض {ar(shown.length)} نتيجة
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── قطع صغيرة ──────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-extrabold">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ on, count, onClick, children }: {
  on: boolean; count?: number; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs',
        'transition-colors hover:bg-cream',
        on ? 'font-extrabold text-shop-text' : 'text-ink',
      )}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="tabular text-[11px] text-soft">({ar(count)})</span>
      )}
    </button>
  );
}

function Money({ value, placeholder, label, onChange, cur }: {
  value: number | null; placeholder: string; label: string;
  onChange: (n: number | null) => void; cur: string;
}) {
  return (
    <label className="relative flex-1">
      <span className="sr-only">{label}</span>
      <input
        inputMode="numeric"
        value={value ?? ''} placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '');
          onChange(raw === '' ? null : Number(raw));
        }}
        className="tabular w-full rounded-lg border border-line bg-cream py-2 ps-3 pe-9
                   text-xs outline-none focus:border-shop"
      />
      <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2
                       text-[10px] text-soft">
        {cur}
      </span>
    </label>
  );
}

function ViewButton({ on, onClick, label, children }: {
  on: boolean; onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} aria-pressed={on}
      className={cn(
        'grid size-8 place-items-center rounded-md transition-colors',
        on ? 'bg-shop text-on-shop' : 'text-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Pill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-pill border border-shop-edge
                     bg-shop-veil px-3 py-1.5 text-[11px] font-bold text-shop-text">
      {children}
      <button type="button" onClick={onClear} aria-label="أزل هذا المرشّح">
        <X className="size-3" />
      </button>
    </span>
  );
}

function Page({ disabled, onClick, label, children }: {
  disabled: boolean; onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button" disabled={disabled} onClick={onClick} aria-label={label}
      className="grid size-10 place-items-center rounded-lg border border-line bg-cream
                 transition-colors hover:border-shop hover:text-shop-text
                 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
