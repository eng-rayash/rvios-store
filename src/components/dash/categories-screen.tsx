'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { ar, cn, items as itemsOf } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/field';
import type { Category } from '@/components/dash/products-screen';

/**
 * شاشة التصنيفات.
 *
 * ★ نموذجٌ حقيقي بدل `prompt()`.
 * اللوحة القديمة كانت تسأل عن اسم التصنيف بـ`prompt` المتصفّح —
 * صندوقٌ لا يُنسَّق، ولا يقبل حقلاً ثانياً (الترتيب)، وتحجبه بعض
 * المتصفّحات داخل إطارات أو بعد نقرات متكرّرة. والنموذج هنا
 * يعرض الحقلين معاً ويُظهر خطأ الخادم في مكانه.
 */
export function CategoriesScreen() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCats(await api.get<Category[]>('/api/me/categories'));
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

  async function remove(c: Category) {
    setBusy(true);
    try {
      await api.del(`/api/me/categories/${c.id}`);
      setNotice(`حُذف تصنيف «${c.name}»`);
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  /** خريطة الأسماء للأب — لعرض التصنيف الفرعي تحت أبيه */
  const nameOf = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-base">
      <div className="flex flex-wrap items-center gap-snug">
        <p className="flex-1 text-sm text-soft">
          التصنيفات تُرتّب متجرك للعميل — والمنتج بلا تصنيف يبقى ظاهراً في «كل المنتجات».
        </p>
        <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
          أضف تصنيفاً
        </Button>
      </div>

      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <Plaque as="section" aria-label="قائمة التصنيفات" aria-busy={loading} className="overflow-hidden">
        {loading ? (
          <div className="divide-y divide-line" aria-busy="true" aria-label="جارٍ تحميل التصنيفات">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-base px-5 py-4">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="ms-auto h-3 w-20" />
              </div>
            ))}
          </div>
        ) : cats.length ? (
          <ul className="divide-y divide-line">
            {cats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-base gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-cream">
                <span className={cn('min-w-0 flex-1', c.parent_id && 'ps-5')}>
                  <b className="block truncate text-sm">
                    {c.parent_id && <span className="text-soft" aria-hidden>↳ </span>}
                    {c.name}
                  </b>
                  {c.parent_id && nameOf[c.parent_id] && (
                    <small className="block text-2xs text-soft">تحت «{nameOf[c.parent_id]}»</small>
                  )}
                </span>
                <span className="text-xs text-soft">{itemsOf(c.count)}</span>
                <span className="text-2xs text-soft">ترتيب <span className="tabular">{ar(c.sort)}</span></span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setEditing(c); setFormOpen(true); }}
                    aria-label={`عدّل «${c.name}»`}
                    className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    aria-label={`احذف «${c.name}»`}
                    className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-danger hover:bg-danger/5 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ListTree className="size-6" aria-hidden />}
            title="لا تصنيفات بعد"
            action={
              <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
                أضف أوّل تصنيف
              </Button>
            }
          >
            متجرٌ بعشرة منتجات لا يحتاجها. ومتجرٌ بمئة يحتاجها ليجد العميل ما جاء لأجله.
          </EmptyState>
        )}
      </Plaque>

      <CategoryForm
        open={formOpen}
        category={editing}
        nextSort={cats.length + 1}
        onClose={() => setFormOpen(false)}
        onSaved={async (message) => { setFormOpen(false); setNotice(message); await load(); }}
      />

      <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title="حذف التصنيف؟" side="center">
        {deleting && (
          <>
            {/* النصّ منقول عن اللوحة القديمة: التاجر يخاف أن يحذف
                التصنيف فيفقد منتجاته — ونقولها له قبل أن يسأل */}
            <p className="text-sm leading-loose text-soft">
              سيُحذف تصنيف <b className="text-ink">«{deleting.name}»</b>، و
              <b className="text-ink">تبقى منتجاته كما هي</b> بلا تصنيف.
            </p>
            <div className="mt-roomy flex flex-wrap gap-snug">
              <Button busy={busy} onClick={() => remove(deleting)} className="bg-danger text-white enabled:hover:bg-[#a11]">
                احذف التصنيف
              </Button>
              <Button tone="line" onClick={() => setDeleting(null)} disabled={busy}>تراجع</Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function CategoryForm({
  open, category, nextSort, onClose, onSaved,
}: {
  open: boolean;
  category: Category | null;
  nextSort: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [sort, setSort] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setSort(String(category?.sort ?? nextSort));
    setError(null);
  }, [open, category, nextSort]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = { name: name.trim(), sort: Number(sort) || 0 };
      if (!payload.name) throw new Error('اسم التصنيف مطلوب');
      if (category) await api.patch(`/api/me/categories/${category.id}`, payload);
      else await api.post('/api/me/categories', payload);
      onSaved(category ? 'حُدّث التصنيف' : 'أُضيف التصنيف');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? 'تعديل التصنيف' : 'تصنيف جديد'}
      side="center"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={save}>حفظ</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-base rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>
      )}
      <Field label="اسم التصنيف">
        {(a) => (
          <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
        )}
      </Field>
      <Field label="الترتيب" hint="الأصغر يظهر أولاً في المتجر">
        {(a) => (
          <Input {...a} type="number" inputMode="numeric" min={0} className="tabular"
            value={sort} onChange={(e) => setSort(e.target.value)} />
        )}
      </Field>
    </Sheet>
  );
}
