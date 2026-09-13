'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { Plus, Check } from 'lucide-react';
import type { ProductView } from '@/lib/store';
import { ar, cn } from '@/lib/utils';
import { useCurrency } from './currency';

/**
 * بطاقة منتج.
 *
 * ثلاثة قرارات تفصلها عن البطاقة الشائعة:
 *
 * ١) **لا نجوم تقييم.** لا نملك نظام مراجعات موثوقاً، وعرض
 *    تقييمات غير حقيقية يدمّر الثقة لحظة اكتشافه. البديل مؤشر
 *    توفّر صادق («بقي ٣ فقط») — يُقنع بلا كذب.
 *
 * ٢) **الصورة تكبر ببطء (٧٠٠ms) لا بسرعة.** الحركة السريعة
 *    تقول «موقع»، والبطيئة تقول «معرض». والفرق كله في المنحنى.
 *
 * ٣) **بلا ظلال.** الأسطح تُفصل بالحدود والأرضية الدافئة —
 *    وهو ما تفعله المتاجر الراقية فعلاً؛ الظلال تُشيخ الواجهة.
 */
export function ProductCard({
  product,
  onOpen,
  onAdd,
  added,
  index = 0,
  lift = false,
}: {
  product: ProductView;
  onOpen: (p: ProductView) => void;
  onAdd: (p: ProductView) => void;
  added?: boolean;
  index?: number;
  /**
   * البطاقة ترتفع عند التحويم — درجة «دافئ» وما فوقها.
   *
   * ★ هذا وعدٌ مكتوب لا زخرفة: `plans.ts` يبيع باقة «بلس» بعبارة
   * «بطاقات ترتفع» حرفياً، ولم يكن في أي بطاقة متجر `hover` واحد.
   * صفحةُ أسعارٍ تَعِد بما لا يُسلَّم تُبطل الثقة في بقيّة الصفحة.
   */
  lift?: boolean;
}) {
  const reduced = useReducedMotion();
  const cur = useCurrency();
  const out = product.stock === 'none';
  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 7) * 0.05, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn(
        'group relative flex flex-col',
        lift && [
          'transition-transform duration-300 ease-out-rv',
          'hover:-translate-y-1 motion-reduce:hover:translate-y-0',
        ],
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="relative mb-3.5 block w-full overflow-hidden rounded-2xl bg-sand
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shop"
        aria-label={`عرض ${product.name}`}
      >
        <span className="block aspect-square">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              width={520}
              height={520}
              className={cn(
                'size-full object-cover transition-transform duration-700 ease-out',
                'group-hover:scale-[1.06]',
                out && 'opacity-55 saturate-50',
              )}
            />
          ) : (
            <span className="grid size-full place-items-center text-soft">لا صورة</span>
          )}
        </span>

        {discount > 0 && !out && (
          <span className="absolute top-3 start-3 rounded-full bg-shop
                           px-2.5 py-1 text-[11px] font-extrabold text-on-shop">
            −{ar(discount)}٪
          </span>
        )}
        {out && (
          <span className="absolute top-3 start-3 rounded-full bg-ink/85
                           px-2.5 py-1 text-[11px] font-extrabold text-cream">
            نفد
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col">
        <h3 className="mb-1 text-[15px] font-bold leading-snug">
          <button type="button" onClick={() => onOpen(product)} className="text-start hover:text-shop-text">
            {product.name}
          </button>
        </h3>

        {(product.summary || product.variant) && (
          <p className="mb-2 line-clamp-1 text-xs text-soft">
            {product.summary || product.variant}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tabular text-shop-text">{ar(product.price)}</span>
              <span className="text-[11px] text-soft">{cur}</span>
              {discount > 0 && (
                <s className="text-[11px] text-soft/70 tabular">{ar(product.oldPrice!)}</s>
              )}
            </div>
            <p className={cn(
              'mt-0.5 text-[11px] font-bold',
              product.stock === 'ok' && 'text-ok',
              product.stock === 'low' && 'text-warn',
              out && 'text-soft',
            )}>
              {product.stockLabel}
            </p>
          </div>

          <button
            type="button"
            disabled={out}
            onClick={() => (product.hasVariants ? onOpen(product) : onAdd(product))}
            aria-label={product.hasVariants ? `اختر خيارات ${product.name}` : `أضف ${product.name} للسلة`}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-40',
              added
                ? 'bg-ok text-white'
                : 'bg-shop text-on-shop hover:brightness-110 active:scale-90',
            )}
          >
            {added ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
