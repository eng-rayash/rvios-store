'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { ar, cn, plural } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { useDash, useStore } from '@/components/dash/dash-context';
import { ProductForm } from '@/components/dash/product-form';

export interface VariantRow { id?: number; v1: string; v2?: string; qty: number; price: number }

export interface Product {
  id: number;
  name: string;
  summary: string;
  description: string;
  price: number;
  old_price: number | null;
  qty: number;
  live: 0 | 1;
  image: string | null;
  images?: string[];
  variant: string;
  category_id: number | null;
  categoryName: string;
  has_variants: 0 | 1;
  variants?: VariantRow[];
  opt1_name: string;
  opt2_name: string;
}

export interface Category { id: number; name: string; parent_id: number | null; sort: number; count: number }

export interface ProductCapacity {
  used: number;
  max: number | null;
  label: string;
  canAdd: boolean;
  imagesPerProduct: number;
  variantsPerProduct: number | null;
}

interface ProductsRes { products: Product[]; capacity: ProductCapacity }

/**
 * شاشة المنتجات.
 *
 * ★ جدولٌ على المكتب وبطاقاتٌ على الهاتف — لا جدولٌ يُمرَّر أفقياً.
 * `dash.css:319` كان يحوّل كل جدول تحت ٨٦٠px إلى
 * `overflow-x:auto; white-space:nowrap` — أي جدارٌ أفقي يبحث فيه
 * التاجر عن السعر بإصبعه. وهذا تعريف «سطح مكتب مضغوط» الذي
 * يفشل فيه أغلب المواقع الرخيصة. والبنيتان هنا مختلفتان فعلاً،
 * وواحدةٌ فقط مرئية في كل مقاس، فلا يسمع قارئ الشاشة تكراراً.
 */
export function ProductsScreen() {
  const { store } = useStore();
  const { reloadOverview } = useDash();

  const [data, setData] = useState<ProductsRes | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, cats] = await Promise.all([
        api.get<ProductsRes>('/api/me/products'),
        api.get<Category[]>('/api/me/categories'),
      ]);
      setData(products);
      setCategories(cats);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function remove(p: Product) {
    setBusy(true);
    try {
      await api.del(`/api/me/products/${p.id}`);
      setNotice(`حُذف «${p.name}»`);
      await Promise.all([load(), reloadOverview()]);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  function openNew() { setEditing(null); setFormOpen(true); }
  function openEdit(p: Product) { setEditing(p); setFormOpen(true); }

  async function afterSave(message: string) {
    setFormOpen(false);
    setNotice(message);
    await Promise.all([load(), reloadOverview()]);
  }

  const cap = data?.capacity;
  const products = data?.products ?? [];

  return (
    <div className="space-y-base">
      <div className="flex flex-wrap items-center gap-snug">
        {cap && <p className="flex-1 text-sm text-soft">{cap.label}</p>}
        <Button
          icon={<Plus className="size-4" />}
          onClick={openNew}
          disabled={!cap?.canAdd}
          title={cap && !cap.canAdd ? 'بلغتَ حدّ باقتك' : undefined}
        >
          أضف منتجاً
        </Button>
      </div>

      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <Plaque as="section" aria-label="قائمة المنتجات" aria-busy={loading} className="overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : products.length ? (
          <>
            {/* ── المكتب: جدول حقيقي ── */}
            <table className="hidden w-full border-collapse md:table">
              <thead>
                <tr className="border-b border-line text-start">
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">المنتج</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">التصنيف</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">السعر</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">المخزون</th>
                  <th scope="col" className="px-5 py-3 text-start text-xs font-bold text-soft">الحالة</th>
                  <th scope="col" className="px-5 py-3"><span className="sr-only">أفعال</span></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line transition-colors last:border-0 hover:bg-cream">
                    <td className="px-5 py-3"><NameCell product={p} /></td>
                    <td className="px-5 py-3 text-sm">{p.categoryName || '—'}</td>
                    <td className="px-5 py-3"><Price product={p} currency={store.currency} /></td>
                    <td className="px-5 py-3"><Stock product={p} /></td>
                    <td className="px-5 py-3"><Status product={p} /></td>
                    <td className="px-5 py-3">
                      <Actions product={p} onEdit={openEdit} onDelete={setDeleting} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── الهاتف: بطاقة لكل منتج ── */}
            <ul className="divide-y divide-line md:hidden">
              {products.map((p) => (
                <li key={p.id} className="px-4 py-3.5">
                  <NameCell product={p} />
                  <div className="mt-2 flex flex-wrap items-center gap-x-base gap-y-1.5">
                    <Price product={p} currency={store.currency} />
                    <Stock product={p} />
                    <Status product={p} />
                    <span className="ms-auto"><Actions product={p} onEdit={openEdit} onDelete={setDeleting} /></span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            icon={<Package className="size-6" aria-hidden />}
            title="لا منتجات بعد"
            action={<Button icon={<Plus className="size-4" />} onClick={openNew}>أضف أوّل منتج</Button>}
          >
            أضف منتجاً بصورته وسعره، ويظهر في متجرك فوراً.
          </EmptyState>
        )}
      </Plaque>

      {cap && (
        <ProductForm
          open={formOpen}
          product={editing}
          categories={categories}
          capacity={cap}
          currency={store.currency}
          onClose={() => setFormOpen(false)}
          onSaved={afterSave}
        />
      )}

      <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title="حذف المنتج؟" side="center">
        {deleting && (
          <>
            <p className="text-sm leading-loose text-soft">
              سيُحذف <b className="text-ink">«{deleting.name}»</b> من متجرك مع صوره وخياراته.
              {' '}<b className="text-ink">لا يمكن التراجع.</b>
            </p>
            <div className="mt-roomy flex flex-wrap gap-snug">
              <Button busy={busy} onClick={() => remove(deleting)} className="bg-danger text-white enabled:hover:bg-[#a11]">
                احذف المنتج
              </Button>
              <Button tone="line" onClick={() => setDeleting(null)} disabled={busy}>تراجع</Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function NameCell({ product: p }: { product: Product }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-sand">
        {p.image
          /* eslint-disable-next-line @next/next/no-img-element -- صور التجّار، مضغوطة عند الرفع */
          ? <img src={p.image} alt="" loading="lazy" className="size-full object-cover" />
          : <Package className="size-4 text-line-strong" aria-hidden />}
      </span>
      <span className="min-w-0">
        <b className="block truncate text-sm">{p.name}</b>
        {p.summary && <small className="block truncate text-xs text-soft">{p.summary}</small>}
      </span>
    </div>
  );
}

function Price({ product: p, currency }: { product: Product; currency: string }) {
  return (
    <span className="whitespace-nowrap text-sm font-semibold tabular">
      {ar(p.price)} <span className="text-2xs font-normal text-soft">{currency}</span>
      {p.old_price ? <s className="ms-1.5 text-2xs font-normal text-soft">{ar(p.old_price)}</s> : null}
    </span>
  );
}

function Stock({ product: p }: { product: Product }) {
  if (p.has_variants) {
    const n = p.variants?.length ?? 0;
    return <span className="text-xs text-soft">{ar(p.qty)} · {ar(n)} خيار</span>;
  }
  /* «قطع» لا «منتجات»: هذا مخزون منتجٍ واحد، و«٥ منتجات» في عمود
     المخزون تُقرأ عدد المنتجات في المتجر لا الكمّية المتبقّية */
  return (
    <span className={cn('text-sm tabular', p.qty === 0 ? 'font-bold text-danger' : p.qty <= 5 ? 'font-bold text-warn' : '')}>
      {ar(p.qty)} {plural(p.qty, ['قطعة', 'قطعتان', 'قطع', 'قطعة'])}
    </span>
  );
}

function Status({ product: p }: { product: Product }) {
  return p.live
    ? <Badge tone="ok">منشور</Badge>
    : <Badge tone="done">مخفي</Badge>;
}

function Actions({ product: p, onEdit, onDelete }: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  return (
    <span className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onEdit(p)}
        aria-label={`عدّل «${p.name}»`}
        className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-ink hover:text-ink"
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onDelete(p)}
        aria-label={`احذف «${p.name}»`}
        className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-danger hover:bg-danger/5 hover:text-danger"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="جارٍ تحميل المنتجات">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-16 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
