'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, X } from 'lucide-react';
import { api, messageOf } from '@/lib/api';
import { readImageFile } from '@/lib/image';
import { ar, cn, plural } from '@/lib/utils';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type { Category, Product, ProductCapacity, VariantRow } from '@/components/dash/products-screen';

/**
 * نموذج المنتج — إضافةً وتعديلاً.
 *
 * ★ الحقول والتحقّقات منقولة عن `dashboard.js` بحرفها، ومفاتيح
 * الحمولة هي ما يقبله `productFields` في الخادم: `categoryId`
 * و`oldPrice` و`opt1Name` لا أسماء الأعمدة. وأي انحراف هنا
 * يُسقط الحقل صامتاً — الخادم يتجاهل ما لا يعرفه.
 */
export function ProductForm({
  open,
  product,
  categories,
  capacity,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** `null` يعني منتجاً جديداً */
  product: Product | null;
  categories: Category[];
  capacity: ProductCapacity;
  currency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [qty, setQty] = useState('');
  const [variant, setVariant] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [live, setLive] = useState(true);
  const [images, setImages] = useState<string[]>([]);

  const [hasVariants, setHasVariants] = useState(false);
  const [opt1Name, setOpt1Name] = useState('');
  const [opt2Name, setOpt2Name] = useState('');
  const [rows, setRows] = useState<VariantRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* يُملأ عند كل فتح — لا عند كل تصيير: تاجرٌ يكتب ثم يُعاد
     تصيير الأب (وصلت النظرة العامة مثلاً) يفقد ما كتبه */
  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setCategoryId(product?.category_id ? String(product.category_id) : '');
    setPrice(product ? String(product.price) : '');
    setOldPrice(product?.old_price ? String(product.old_price) : '');
    setQty(product ? String(product.qty) : '1');
    setVariant(product?.variant ?? '');
    setSummary(product?.summary ?? '');
    setDescription(product?.description ?? '');
    setLive(product ? !!product.live : true);
    setImages(product?.images?.length ? [...product.images] : product?.image ? [product.image] : []);
    setHasVariants(!!product?.has_variants);
    setOpt1Name(product?.opt1_name ?? '');
    setOpt2Name(product?.opt2_name ?? '');
    setRows((product?.variants ?? []).map((v) => ({ id: v.id, v1: v.v1, v2: v.v2, qty: v.qty, price: v.price })));
    setError(null);
  }, [open, product]);

  const maxImages = capacity.imagesPerProduct;
  const maxVariants = capacity.variantsPerProduct;
  const filled = rows.filter((r) => (r.v1 ?? '').trim() || (r.v2 ?? '').trim());
  /* الكمية تصير مجموعاً محسوباً حين تُفعَّل الخيارات — والخادم
     يتجاهل `qty` عندها ويحسبها من الشبكة */
  const derivedQty = filled.reduce((a, r) => a + (Number(r.qty) || 0), 0);

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = maxImages - images.length;
    if (room <= 0) {
      setError(`باقتك تسمح بـ${ar(maxImages)} ${plural(maxImages, ['صورة', 'صورتين', 'صور', 'صورة'])} لكل منتج`);
      return;
    }
    try {
      const next: string[] = [];
      for (const file of [...files].slice(0, room)) next.push(await readImageFile(file));
      setImages((prev) => [...prev, ...next]);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        categoryId: Number(categoryId) || 0,
        price: Number(price) || 0,
        oldPrice: Number(oldPrice) || 0,
        qty: Number(qty) || 0,
        variant: variant.trim(),
        opt1Name: opt1Name.trim(),
        opt2Name: opt2Name.trim(),
        /* مصفوفة فارغة تعني «ألغِ الخيارات» — والخادم يعيد qty
           ليكون مصدر الحقيقة عندها */
        variants: hasVariants ? filled : [],
        summary: summary.trim(),
        description: description.trim(),
        live,
        images,   // الأولى تصبح الغلاف في الخادم
      };

      if (!payload.name) throw new Error('اسم المنتج مطلوب');
      if (hasVariants && !payload.variants.length) {
        throw new Error('أضف قيمة واحدة على الأقل، أو أزل علامة «لهذا المنتج خيارات»');
      }
      if (hasVariants && !payload.opt1Name) throw new Error('سمِّ الخيار الأول (مثل: المقاس)');

      if (product) await api.patch(`/api/me/products/${product.id}`, payload);
      else await api.post('/api/me/products', payload);

      onSaved(product ? 'حُفظ المنتج' : 'أُضيف المنتج');
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
      title={product ? 'تعديل المنتج' : 'منتج جديد'}
      side="center"
      className="sm:w-[min(640px,94vw)]"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={save}>حفظ</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-base rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">
          {error}
        </p>
      )}

      {/* ── الصور ── */}
      <fieldset className="mb-base">
        <legend className="mb-1.5 text-xs font-bold">
          صور المنتج
          <span className="ms-1.5 font-normal text-soft">
            حتى {ar(maxImages)} · الأولى هي الغلاف
          </span>
        </legend>

        {images.length > 0 && (
          <ul className="mb-2.5 flex flex-wrap gap-2">
            {images.map((src, i) => (
              <li key={`${src.slice(-24)}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- قد تكون dataURL قبل الرفع */}
                <img
                  src={src}
                  alt=""
                  className={cn(
                    'size-[72px] rounded-sm border-[1.5px] bg-sand object-cover',
                    i === 0 ? 'border-shop' : 'border-line',
                  )}
                />
                {i === 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-shop py-0.5 text-center text-[10px] font-bold text-on-shop">
                    الغلاف
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((_, k) => k !== i))}
                  aria-label={`احذف الصورة ${ar(i + 1)}`}
                  className="absolute top-1 end-1 grid size-[18px] place-items-center rounded-full bg-ink/70 text-cream hover:bg-danger"
                >
                  <X className="size-3" aria-hidden />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages((p) => [p[i], ...p.filter((_, k) => k !== i)])}
                    aria-label={`اجعل الصورة ${ar(i + 1)} غلافاً`}
                    className="absolute top-1 start-1 grid size-[18px] place-items-center rounded-full bg-cream/90 text-soft hover:text-shop"
                  >
                    <Star className="size-3" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= maxImages}
          className="flex w-full flex-col items-center gap-1 rounded-sm border-[1.5px] border-dashed border-line bg-paper px-base py-4 text-center transition-colors enabled:hover:border-shop disabled:opacity-50"
        >
          <ImagePlus className="size-5 text-soft" aria-hidden />
          <b className="text-sm">أضف صورة</b>
          <small className="text-2xs text-soft">يُفضّل صورة مربّعة · تُصغَّر تلقائياً قبل الرفع</small>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { void addImages(e.target.files); e.target.value = ''; }}
        />
      </fieldset>

      <Field label="اسم المنتج">
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}
      </Field>

      <Field label="التصنيف">
        {(a) => (
          <Select {...a} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">بدون تصنيف</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
      </Field>

      <div className="grid gap-x-base sm:grid-cols-2">
        <Field label={`السعر (${currency})`}>
          {(a) => (
            <Input {...a} type="number" inputMode="numeric" min={0} className="tabular"
              value={price} onChange={(e) => setPrice(e.target.value)} />
          )}
        </Field>
        <Field label="السعر قبل الخصم" hint="اتركه فارغاً إن لم يكن هناك خصم">
          {(a) => (
            <Input {...a} type="number" inputMode="numeric" min={0} className="tabular"
              value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} />
          )}
        </Field>
      </div>

      <div className="grid gap-x-base sm:grid-cols-2">
        <Field
          label="الكمية"
          hint={hasVariants ? 'محسوبة من الخيارات' : undefined}
        >
          {(a) => (
            <Input {...a} type="number" inputMode="numeric" min={0} className="tabular"
              disabled={hasVariants}
              value={hasVariants ? String(derivedQty) : qty}
              onChange={(e) => setQty(e.target.value)} />
          )}
        </Field>
        <Field label="الحجم / الوحدة" hint="مثل: ١٠٠ مل">
          {(a) => <Input {...a} value={variant} onChange={(e) => setVariant(e.target.value)} maxLength={40} />}
        </Field>
      </div>

      {/* ── الخيارات ── */}
      <fieldset className="mb-base rounded-sm border-[1.5px] border-line bg-paper px-3.5 py-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => {
              setHasVariants(e.target.checked);
              if (e.target.checked && !rows.length) setRows([{ v1: '', v2: '', qty: 0, price: 0 }]);
            }}
            className="size-4 accent-shop"
          />
          لهذا المنتج خيارات (مقاسات أو ألوان)
        </label>

        {hasVariants && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="grid gap-x-base sm:grid-cols-2">
              <Field label="اسم الخيار الأول" hint="مثل: المقاس">
                {(a) => <Input {...a} value={opt1Name} onChange={(e) => setOpt1Name(e.target.value)} maxLength={24} />}
              </Field>
              <Field label="اسم الخيار الثاني (اختياري)" hint="مثل: اللون">
                {(a) => <Input {...a} value={opt2Name} onChange={(e) => setOpt2Name(e.target.value)} maxLength={24} />}
              </Field>
            </div>

            <ul className="space-y-2">
              {rows.map((row, i) => (
                <li key={i} className={cn('grid items-center gap-2', opt2Name ? 'grid-cols-[1fr_1fr_4.5rem_5.5rem_auto]' : 'grid-cols-[1.4fr_5rem_6rem_auto]')}>
                  <Input aria-label={`${opt1Name || 'الخيار الأول'} — الصفّ ${ar(i + 1)}`} value={row.v1}
                    onChange={(e) => setRows((p) => p.map((r, k) => k === i ? { ...r, v1: e.target.value } : r))} />
                  {opt2Name && (
                    <Input aria-label={`${opt2Name} — الصفّ ${ar(i + 1)}`} value={row.v2 ?? ''}
                      onChange={(e) => setRows((p) => p.map((r, k) => k === i ? { ...r, v2: e.target.value } : r))} />
                  )}
                  <Input type="number" min={0} inputMode="numeric" className="tabular"
                    aria-label={`الكمية — الصفّ ${ar(i + 1)}`} value={row.qty}
                    onChange={(e) => setRows((p) => p.map((r, k) => k === i ? { ...r, qty: Number(e.target.value) || 0 } : r))} />
                  <Input type="number" min={0} inputMode="numeric" className="tabular"
                    aria-label={`السعر — الصفّ ${ar(i + 1)}`} value={row.price}
                    onChange={(e) => setRows((p) => p.map((r, k) => k === i ? { ...r, price: Number(e.target.value) || 0 } : r))} />
                  <button type="button" onClick={() => setRows((p) => p.filter((_, k) => k !== i))}
                    aria-label={`احذف الصفّ ${ar(i + 1)}`}
                    className="grid size-7 place-items-center rounded-full bg-sand text-soft hover:bg-danger hover:text-white">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2.5 flex flex-wrap items-center gap-snug">
              <Button
                tone="line"
                size="sm"
                disabled={maxVariants !== null && filled.length >= maxVariants}
                onClick={() => setRows((p) => [...p, { v1: '', v2: '', qty: 0, price: 0 }])}
              >
                إضافة خيار
              </Button>
              <small className="text-2xs text-soft">
                {ar(filled.length)}
                {maxVariants !== null ? ` من ${ar(maxVariants)}` : ''} · السعر صفر يعني سعر المنتج الأساسي
              </small>
            </div>
          </div>
        )}
      </fieldset>

      <Field label="وصف مختصر" hint="يظهر تحت اسم المنتج في المتجر">
        {(a) => <Input {...a} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={120} />}
      </Field>

      <Field label="الوصف الكامل">
        {(a) => (
          <textarea
            {...a}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1200}
            rows={4}
            className="w-full resize-y rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5 leading-body transition-colors focus-visible:border-shop focus-visible:ring-[3px] focus-visible:ring-shop/20 focus-visible:outline-none"
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="size-4 accent-shop" />
        منشور في المتجر
      </label>
    </Sheet>
  );
}
