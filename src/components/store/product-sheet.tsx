'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import type { ProductView, StoreView } from '@/lib/store';
import type { CartLine } from './use-cart';
import { ar, cn } from '@/lib/utils';

/**
 * ورقة المنتج — التفاصيل واختيار الخيارات.
 *
 * الخيارات (المقاسات والألوان) تُجلب عند الفتح لا مع الشبكة:
 * شبكة بمئة منتج لا تحتاج خيارات كلٍّ منها، وجلبها يعني مئة
 * استعلام مقابل لا شيء يُعرض.
 *
 * والقيمة النافدة **تبقى ظاهرة مشطوبة** لا تختفي: العميل يعرف
 * أن المقاس موجود في المتجر ونفد، لا أنه غير مصنوع أصلاً —
 * وهذا فرق يقرّر عودته من عدمها.
 */
interface Variant {
  id: number; v1: string; v2: string;
  price: number | null; qty: number;
}

export function ProductSheet({
  store, product, onClose, onAdd, media = 'square', preset, cover,
}: {
  store: StoreView;
  product: ProductView | null;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'qty'>) => void;
  /**
   * نسبة الصورة. مربّعة افتراضياً كما كانت، وطولية في قالب
   * «أتولييه»: الملبوس يُقاس طوله ووقوعه، وكلاهما يُقصّ في
   * المربّع. والقيمة الافتراضية تُبقي المستدعين القدامى كما هم.
   */
  media?: 'square' | 'portrait';
  /** خيار مختار مسبقاً — مقاسٌ نُقر في الشبكة */
  preset?: { v1?: string; v2?: string };
  /** صورة اللون الذي كان معروضاً على البطاقة */
  cover?: string;
}) {
  const reduced = useReducedMotion();
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [opts, setOpts] = useState<{ v1: string; v2: string }>({ v1: '', v2: '' });
  const [axes, setAxes] = useState<{ key: 'v1' | 'v2'; name: string; values: string[] }[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * الخيار المبدئي يُقرأ عبر مرجع لا عبر تبعية: هو كائن جديد
   * في كل تصيير، وإدخاله في مصفوفة التبعيات يعيد جلب الخيارات
   * بلا نهاية. ويكفي أنه يُقرأ لحظة فتح المنتج — وهي اللحظة
   * التي يُضبط فيها.
   */
  const seed = useRef(preset);
  seed.current = preset;

  useEffect(() => {
    setOpts({ v1: seed.current?.v1 ?? '', v2: seed.current?.v2 ?? '' });
    setVariants(null);
    setAxes([]);
    if (!product?.hasVariants) return;

    let alive = true;
    setLoading(true);
    fetch(`/api/shop/${encodeURIComponent(store.slug)}/products/${product.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setVariants(d.product?.variants ?? []);
        setAxes(d.product?.axes ?? []);
      })
      .catch(() => { if (alive) setVariants([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [product, store.slug]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);

  if (!product) return null;

  const picked = variants?.find((v) =>
    (!axes.some((a) => a.key === 'v1') || v.v1 === opts.v1) &&
    (!axes.some((a) => a.key === 'v2') || v.v2 === opts.v2));

  const needs = axes.filter((a) => !opts[a.key]);
  const price = picked?.price ?? product.price;
  const stock = product.hasVariants ? (picked?.qty ?? 0) : product.qty;
  const ready = product.hasVariants ? Boolean(picked && picked.qty > 0) : product.qty > 0;

  /** هل توجد قطعة متاحة بهذه القيمة على هذا المحور؟ */
  const available = (key: 'v1' | 'v2', value: string) =>
    (variants ?? []).some((v) => {
      if (v[key] !== value) return false;
      const other = key === 'v1' ? 'v2' : 'v1';
      if (axes.some((a) => a.key === other) && opts[other] && v[other] !== opts[other]) return false;
      return v.qty > 0;
    });

  const label = picked
    ? [axes[0] && `${axes[0].name}: ${picked.v1}`, axes[1] && `${axes[1].name}: ${picked.v2}`]
      .filter(Boolean).join(' · ')
    : product.variant;

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={product.name}
            initial={reduced ? false : { opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed inset-0 z-50 m-auto grid h-fit max-h-[92dvh] w-[min(56rem,100%-1.5rem)]
                       grid-cols-1 overflow-y-auto rounded-3xl border border-line
                       bg-cream md:grid-cols-2"
          >
            <button type="button" onClick={onClose} aria-label="إغلاق"
                    className="absolute top-4 end-4 z-10 grid size-10 place-items-center
                               rounded-full bg-cream/85 backdrop-blur hover:bg-sand">
              <X className="size-5" />
            </button>

            <div className="bg-sand">
              {(cover || product.image) && (
                <Image src={cover || product.image} alt={product.name} width={720} height={960}
                       className={cn(
                         'size-full object-cover',
                         media === 'portrait' ? 'aspect-[3/4]' : 'aspect-square',
                       )} />
              )}
            </div>

            <div className="flex flex-col p-6 md:p-8">
              <h2 className="mb-2 font-display text-3xl font-bold leading-[1.25]">
                {product.name}
              </h2>

              <div className="mb-4 flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold tabular text-shop-text">{ar(price)}</span>
                <span className="text-xs text-soft">{store.currency}</span>
                {product.oldPrice && product.oldPrice > price && (
                  <s className="text-sm text-soft/70 tabular">{ar(product.oldPrice)}</s>
                )}
              </div>

              {product.description && (
                <p className="mb-5 text-sm leading-[1.95] text-soft">{product.description}</p>
              )}

              {/* منتقي الخيارات */}
              {product.hasVariants && (
                <div className="mb-5 grid gap-4">
                  {loading && (
                    <p className="flex items-center gap-2 text-xs text-soft">
                      <Loader2 className="size-3.5 animate-spin" />جارٍ جلب الخيارات…
                    </p>
                  )}
                  {axes.map((axis) => (
                    <div key={axis.key} className="grid gap-2">
                      <span className="text-xs font-bold text-soft">{axis.name}</span>
                      <div className="flex flex-wrap gap-2">
                        {axis.values.map((val) => {
                          const on = opts[axis.key] === val;
                          const gone = !available(axis.key, val);
                          return (
                            <button
                              key={val} type="button" disabled={gone && !on}
                              onClick={() => setOpts((o) => ({ ...o, [axis.key]: on ? '' : val }))}
                              className={cn(
                                'min-w-11 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors',
                                on && 'border-shop bg-shop text-on-shop',
                                !on && !gone && 'border-line bg-paper hover:border-shop',
                                gone && !on && 'border-dashed border-line text-soft/65 line-through',
                              )}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className={cn(
                'mb-5 text-xs font-bold',
                stock <= 0 ? 'text-soft' : stock <= 5 ? 'text-warn' : 'text-ok',
              )}>
                {needs.length
                  ? `اختر ${needs.map((a) => a.name).join(' و')}`
                  : stock <= 0 ? 'نفد المخزون'
                    : stock <= 5 ? `بقي ${ar(stock)} فقط` : 'متوفر'}
              </p>

              <div className="mt-auto grid gap-2.5">
                <button
                  type="button" disabled={!ready}
                  onClick={() => onAdd({
                    id: product.id,
                    variantId: picked?.id ?? 0,
                    name: product.name,
                    variant: label,
                    price, image: product.image, max: stock,
                  })}
                  className="rounded-full bg-shop py-4 font-bold text-on-shop
                             transition-[filter,transform] hover:brightness-110 active:scale-[.99]
                             disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {ready ? 'أضف للسلة' : needs.length ? 'اختر الخيارات' : 'غير متوفر'}
                </button>
                {store.whatsapp && (
                  <a
                    // الرقم مخزَّن E.164 فلا يُسبق برمز دولة ثانٍ
                    href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`مرحباً، أود الاستفسار عن: ${product.name}`)}`}
                    target="_blank" rel="noopener"
                    className="rounded-full border border-line py-3.5 text-center text-sm font-bold
                               transition-colors hover:border-shop hover:text-shop-text"
                  >
                    اسأل عن المنتج
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
