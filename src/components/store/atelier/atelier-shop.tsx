'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ProductView } from '@/lib/store';
import { ar, cn, items } from '@/lib/utils';
import { useCurrency } from '../currency';
import { discountOf } from '../pro/pro-card';
import { useAtelier, splitAxes } from './context';
import { AtelierCard } from './atelier-card';

const PER_PAGE = 12;

export type AtelierQuery = {
  q: string;
  cat: number | null;
  sizes: string[];
  colors: string[];
  min: number | null;
  max: number | null;
  deals: boolean;
  wish: boolean;
  sort: SortId;
};

type SortId = 'new' | 'cheap' | 'dear' | 'off';

const SORTS: { id: SortId; name: string }[] = [
  { id: 'new', name: 'الأحدث أولاً' },
  { id: 'cheap', name: 'السعر: من الأقل' },
  { id: 'dear', name: 'السعر: من الأعلى' },
  { id: 'off', name: 'الأكبر خصماً' },
];

/**
 * صفحة التسوّق في قالب «أتولييه».
 *
 * ما يفصلها عن صفحة «التوقيع» ليس التنسيق بل **ترتيب الأسئلة**:
 * مشتري العباءة يسأل عن المقاس أولاً، فمرشّح المقاس في الرأس
 * ومفتوح، ثم اللون، ثم القسم والسعر. ومرشّح المقاس يعني «متاح
 * بهذا المقاس» فعلاً — لا يعرض قطعة نفد فيها المقاس المطلوب،
 * لأن نتيجةً تُفتح على «نفد» أسوأ من نتيجةٍ أقلّ.
 *
 * وقيم المرشّحين تُبنى من الكتالوج نفسه بترتيب ظهورها (وهو
 * ترتيب التاجر): مرشّحٌ بقيمة لا تُنتج نتيجة لا يُعرض أصلاً.
 *
 * ولا مبدّل «شبكة/قائمة»: صفٌّ أفقي من الملابس لا يُقرأ.
 * والحالة تعيش في الرابط كما في القالب الآخر — الرابط يُشارك.
 */
export function AtelierShop({ products, initial }: {
  products: ProductView[];
  initial: AtelierQuery;
}) {
  const { store, categories, wished } = useAtelier();
  const cur = useCurrency();
  const reduced = useReducedMotion();

  const [f, setF] = useState<AtelierQuery>(initial);
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState(false);

  const bounds = useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [products]);

  /**
   * قيم المحورين عبر الكتالوج كله، بترتيب أول ظهور.
   * ولا تُرتَّب أبجدياً: «٥٢ ٥٤ ٥٦» ترتيبٌ كتبه التاجر ويعرفه
   * الزبون، وفرزٌ نصّي يبعثره.
   */
  const facets = useMemo(() => {
    const size = new Map<string, number>();
    const color = new Map<string, { count: number; image: string }>();
    // اسم المحور كما كتبه التاجر — من أول قطعة تحمله
    let sizeName = '';
    let colorName = '';

    for (const p of products) {
      const { visual, plain } = splitAxes(p);
      if (plain) {
        sizeName ||= plain.name;
        for (const v of plain.values) {
          if (v.inStock) size.set(v.value, (size.get(v.value) ?? 0) + 1);
        }
      }
      if (visual) {
        colorName ||= visual.name;
        for (const v of visual.values) {
          if (!v.inStock) continue;
          const had = color.get(v.value);
          if (had) { had.count++; if (!had.image && v.image) had.image = v.image; }
          else color.set(v.value, { count: 1, image: v.image });
        }
      }
    }

    return {
      sizes: [...size.entries()].map(([value, count]) => ({ value, count })),
      colors: [...color.entries()].map(([value, v]) => ({ value, ...v })),
      sizeName: sizeName || 'المقاس',
      colorName: colorName || 'اللون',
    };
  }, [products]);

  const shown = useMemo(() => {
    const needle = f.q.trim();

    /** هل في القطعة قيمةٌ متاحة من المطلوب على هذا المحور؟ */
    const fits = (p: ProductView, want: string[], which: 'plain' | 'visual') => {
      if (want.length === 0) return true;
      const axis = splitAxes(p)[which];
      if (!axis) return false;
      return axis.values.some((v) => v.inStock && want.includes(v.value));
    };

    const out = products.filter((p) => {
      if (f.cat !== null && p.categoryId !== f.cat) return false;
      if (f.min !== null && p.price < f.min) return false;
      if (f.max !== null && p.price > f.max) return false;
      if (f.deals && discountOf(p) === 0) return false;
      if (f.wish && !wished(p.id)) return false;
      if (!fits(p, f.sizes, 'plain')) return false;
      if (!fits(p, f.colors, 'visual')) return false;
      if (needle && !(`${p.name} ${p.summary} ${p.variant} ${p.brand}`).includes(needle)) return false;
      return true;
    });

    const by: Record<SortId, (a: ProductView, b: ProductView) => number> = {
      new: () => 0,                                  // ترتيب التاجر كما هو
      cheap: (a, b) => a.price - b.price,
      dear: (a, b) => b.price - a.price,
      off: (a, b) => discountOf(b) - discountOf(a),
    };
    return [...out].sort(by[f.sort]);
  }, [products, f, wished]);

  useEffect(() => { setPage(1); }, [f]);

  /** الحالة تُكتب في الرابط بلا إعادة تحميل ولا سجلّ لكل ضغطة */
  useEffect(() => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.cat !== null) p.set('cat', String(f.cat));
    for (const s of f.sizes) p.append('size', s);
    for (const c of f.colors) p.append('color', c);
    if (f.min !== null) p.set('min', String(f.min));
    if (f.max !== null) p.set('max', String(f.max));
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

  const clean: AtelierQuery = {
    q: '', cat: null, sizes: [], colors: [], min: null, max: null,
    deals: false, wish: false, sort: 'new',
  };

  const dirty = f.q !== '' || f.cat !== null || f.sizes.length > 0 || f.colors.length > 0
    || f.min !== null || f.max !== null || f.deals || f.wish;

  const toggle = (key: 'sizes' | 'colors', value: string) =>
    setF((v) => ({
      ...v,
      [key]: v[key].includes(value) ? v[key].filter((x) => x !== value) : [...v[key], value],
    }));

  const sidebar = (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xs font-extrabold tracking-[.22em]">التصفية</h2>
        {dirty && (
          <button
            type="button" onClick={() => setF(clean)}
            className="text-[11px] font-bold text-shop-text hover:underline"
          >
            إعادة تعيين
          </button>
        )}
      </div>

      {/* المقاس أولاً ومفتوحاً — هو السؤال الأول في متجر ملابس */}
      {facets.sizes.length > 0 && (
        <Group title={facets.sizeName}>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s.value} type="button" onClick={() => toggle('sizes', s.value)}
                aria-pressed={f.sizes.includes(s.value)}
                title={`${ar(s.count)} قطعة`}
                className={cn(
                  'tabular min-w-11 border px-3 py-2 text-xs font-bold transition-colors',
                  f.sizes.includes(s.value)
                    ? 'border-ink bg-ink text-cream'
                    : 'border-line bg-cream hover:border-ink',
                )}
              >
                {s.value}
              </button>
            ))}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title={facets.colorName}>
          <div className="space-y-1">
            {facets.colors.map((c) => (
              <button
                key={c.value} type="button" onClick={() => toggle('colors', c.value)}
                aria-pressed={f.colors.includes(c.value)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-1.5 py-1.5 text-xs transition-colors',
                  f.colors.includes(c.value) ? 'font-extrabold text-ink' : 'text-soft hover:text-ink',
                )}
              >
                <span className={cn(
                  'size-7 shrink-0 overflow-hidden rounded-full border',
                  f.colors.includes(c.value) ? 'border-ink' : 'border-line',
                )}>
                  {c.image
                    ? <Image src={c.image} alt="" width={56} height={56} className="size-full object-cover" />
                    : <span className="grid size-full place-items-center bg-sand text-[9px]">{c.value.charAt(0)}</span>}
                </span>
                <span className="flex-1 text-start">{c.value}</span>
                <span className="tabular text-[11px] text-soft">({ar(c.count)})</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      {categories.length > 0 && (
        <Group title="الأقسام">
          <Row on={f.cat === null} count={products.length}
               onClick={() => setF((v) => ({ ...v, cat: null }))}>
            كل القطع
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
      )}

      <Group title="السعر">
        <div className="flex items-center gap-2">
          <Money value={f.min} placeholder={ar(bounds.min)} label="أقلّ سعر" cur={cur}
                 onChange={(n) => setF((v) => ({ ...v, min: n }))} />
          <span className="text-soft">—</span>
          <Money value={f.max} placeholder={ar(bounds.max)} label="أعلى سعر" cur={cur}
                 onChange={(n) => setF((v) => ({ ...v, max: n }))} />
        </div>
      </Group>

      <Group title="أخرى">
        <Row
          on={f.deals} count={products.filter((p) => discountOf(p) > 0).length}
          onClick={() => setF((v) => ({ ...v, deals: !v.deals }))}
        >
          المخفّضة فقط
        </Row>
        <Row on={f.wish} onClick={() => setF((v) => ({ ...v, wish: !v.wish }))}>
          المفضّلة لديّ
        </Row>
      </Group>
    </div>
  );

  return (
    <main className="mx-auto w-[min(1280px,100%-2rem)] pt-8">
      <nav aria-label="المسار" className="flex items-center gap-2 pb-6 text-[11px] text-soft">
        <Link href={`/${store.slug}`} className="hover:text-ink">الواجهة</Link>
        <ChevronLeft className="size-3.5" />
        <span className="font-bold text-ink">كل القطع</span>
      </nav>

      <header className="border-b border-line pb-6">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] font-bold leading-tight">
          {f.cat !== null ? categories.find((c) => c.id === f.cat)?.name : 'كل القطع'}
        </h1>
        <p className="mt-2 text-xs text-soft">
          {store.tagline || `مجموعة ${store.name}`}
        </p>
      </header>

      <div className="grid gap-10 pt-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[10rem]">{sidebar}</div>
        </aside>

        <div>
          <div className="mb-7 flex flex-wrap items-center gap-3">
            <button
              type="button" onClick={() => setPanel(true)}
              className="flex items-center gap-2 border border-line px-4 py-2 text-xs font-bold lg:hidden"
            >
              <SlidersHorizontal className="size-3.5" />
              التصفية
            </button>

            <p className="tabular text-xs text-soft">
              {shown.length === 0
                ? 'لا نتائج'
                : `${ar((at - 1) * PER_PAGE + 1)}–${ar(Math.min(at * PER_PAGE, shown.length))} من ${items(shown.length)}`}
            </p>

            <label className="ms-auto flex items-center gap-2 text-xs">
              <span className="sr-only">ترتيب النتائج</span>
              <select
                value={f.sort}
                onChange={(e) => setF((v) => ({ ...v, sort: e.target.value as SortId }))}
                className="border border-line bg-cream px-3 py-2 text-xs font-bold outline-none
                           focus:border-ink"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>

          {dirty && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {f.q && <Pill onClear={() => setF((v) => ({ ...v, q: '' }))}>بحث: {f.q}</Pill>}
              {f.cat !== null && (
                <Pill onClear={() => setF((v) => ({ ...v, cat: null }))}>
                  {categories.find((c) => c.id === f.cat)?.name}
                </Pill>
              )}
              {f.sizes.map((s) => (
                <Pill key={s} onClear={() => toggle('sizes', s)}>{facets.sizeName}: {s}</Pill>
              ))}
              {f.colors.map((c) => (
                <Pill key={c} onClear={() => toggle('colors', c)}>{c}</Pill>
              ))}
              {(f.min !== null || f.max !== null) && (
                <Pill onClear={() => setF((v) => ({ ...v, min: null, max: null }))}>
                  {ar(f.min ?? bounds.min)}–{ar(f.max ?? bounds.max)} {cur}
                </Pill>
              )}
              {f.deals && <Pill onClear={() => setF((v) => ({ ...v, deals: false }))}>المخفّضة</Pill>}
              {f.wish && <Pill onClear={() => setF((v) => ({ ...v, wish: false }))}>المفضّلة</Pill>}
            </div>
          )}

          {slice.length === 0 ? (
            <div className="grid place-items-center gap-3 border border-line py-24 text-center">
              <Search className="size-9 text-line" strokeWidth={1.2} />
              <p className="text-sm text-soft">
                {f.wish ? 'لم تضيفي شيئاً إلى المفضّلة بعد' : 'لا قطع تطابق هذه التصفية'}
              </p>
              {dirty && (
                <button
                  type="button" onClick={() => setF(clean)}
                  className="text-xs font-bold text-shop-text underline underline-offset-4"
                >
                  اعرضي كل القطع
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 lg:grid-cols-3">
              {slice.map((p, i) => <AtelierCard key={p.id} product={p} index={i} />)}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="صفحات النتائج" className="mt-14 flex items-center justify-center gap-2">
              <Page disabled={at === 1} onClick={() => setPage(at - 1)} label="السابق">
                <ChevronRight className="size-4" />
              </Page>

              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n} type="button" onClick={() => setPage(n)}
                  aria-current={n === at ? 'page' : undefined}
                  className={cn(
                    'tabular grid size-10 place-items-center border text-xs font-bold transition-colors',
                    n === at ? 'border-ink bg-ink text-cream' : 'border-line bg-cream hover:border-ink',
                  )}
                >
                  {ar(n)}
                </button>
              ))}

              <Page disabled={at === pages} onClick={() => setPage(at + 1)} label="التالي">
                <ChevronLeft className="size-4" />
              </Page>
            </nav>
          )}
        </div>
      </div>

      {/* درج التصفية على الجوال */}
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
              className="fixed inset-y-0 start-0 z-50 w-[min(20rem,88vw)] overflow-y-auto bg-cream p-6 lg:hidden"
              role="dialog" aria-label="تصفية النتائج"
            >
              <button
                type="button" onClick={() => setPanel(false)} aria-label="إغلاق"
                className="mb-6 grid size-9 place-items-center border border-line"
              >
                <X className="size-4" />
              </button>
              {sidebar}
              <button
                type="button" onClick={() => setPanel(false)}
                className="mt-8 w-full bg-ink py-3.5 text-sm font-bold text-cream"
              >
                اعرضي {ar(shown.length)} نتيجة
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
      <h3 className="mb-3 text-2xs font-extrabold tracking-[.18em] text-soft">{title}</h3>
      {children}
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
        'flex w-full items-center justify-between gap-2 px-1.5 py-1.5 text-xs transition-colors',
        on ? 'font-extrabold text-ink' : 'text-soft hover:text-ink',
      )}
    >
      <span>{children}</span>
      {count !== undefined && <span className="tabular text-[11px] text-soft">({ar(count)})</span>}
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
        inputMode="numeric" value={value ?? ''} placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '');
          onChange(raw === '' ? null : Number(raw));
        }}
        className="tabular w-full border border-line bg-cream py-2 ps-3 pe-9 text-xs
                   outline-none focus:border-ink"
      />
      <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2
                       text-[10px] text-soft">
        {cur}
      </span>
    </label>
  );
}

function Pill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-[11px] font-bold">
      {children}
      <button type="button" onClick={onClear} aria-label="أزيلي هذا المرشّح">
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
      className="grid size-10 place-items-center border border-line bg-cream transition-colors
                 hover:border-ink disabled:cursor-not-allowed disabled:opacity-35
                 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
