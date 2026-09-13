'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { Heart, ShoppingBag, Check, Star } from 'lucide-react';
import type { ProductView } from '@/lib/store';
import { ar, cn } from '@/lib/utils';
import { useLume } from '@/components/ui/lume';
import { useCurrency } from '../currency';
import { usePro } from './context';

/** نسبة الخصم من سعرٍ سابق مسجَّل — لا خصم بلا سعر سابق */
export const discountOf = (p: ProductView) =>
  p.oldPrice && p.oldPrice > p.price
    ? Math.round((1 - p.price / p.oldPrice) * 100)
    : 0;

/**
 * «جديد» ليست وسماً يدوياً بل موضعاً في الترتيب: أحدث ست قطع
 * أضافها التاجر. وسمٌ يُلصق باليد يبقى سنةً على منتج قديم.
 */
export const isFresh = (p: ProductView, freshIds: Set<number>) => freshIds.has(p.id);

/**
 * نجوم التقييم.
 *
 * تُعرض فقط حين توجد تقييمات فعلية في `product_reviews`. المنتج
 * الذي لم يقيّمه أحد يصمت — لا «٠ من ٥» ولا خمس نجوم رمادية
 * توحي بأن أحداً قيّم. وهذا ما يجعل النجمة تعني شيئاً حين تظهر.
 */
export function Stars({ value, count, size = 'sm' }: {
  value: number; count: number; size?: 'sm' | 'md';
}) {
  if (count <= 0) return null;
  const full = Math.round(value);

  return (
    <div className="flex items-center gap-1.5" title={`${value.toFixed(1)} من ٥`}>
      <div className="flex" aria-label={`التقييم ${value.toFixed(1)} من ٥`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              size === 'md' ? 'size-4' : 'size-3',
              i <= full ? 'fill-brass text-brass' : 'fill-line/60 text-line/60',
            )}
          />
        ))}
      </div>
      <span className={cn('tabular text-soft', size === 'md' ? 'text-xs' : 'text-[11px]')}>
        ({ar(count)})
      </span>
    </div>
  );
}

/**
 * بطاقة منتج في درجة «فاخر».
 *
 * تختلف عن بطاقة الدرجات الأدنى بثلاثة أشياء تُرى: قلبٌ يحفظ،
 * ونجومٌ حقيقية، وسعرٌ سابق مشطوب حين يوجد خصم مسجَّل. ويبقى
 * مؤشر التوفّر الصادق كما هو — النجوم أُضيفت إليه ولم تحلّ محلّه.
 */
export function ProCard({ product: p, index = 0, fresh, layout = 'grid' }: {
  product: ProductView;
  index?: number;
  fresh?: boolean;
  layout?: 'grid' | 'list';
}) {
  const reduced = useReducedMotion();
  /* الإحداثيان يُكتبان في `--mx/--my` على العنصر نفسه، والتدرّج في
     `.lume` يقرؤهما — بلا حالة React ولا إعادة تصيير عند كل حركة */
  const { onPointerMove } = useLume();
  const cur = useCurrency();
  const { open, add, flashed, wished, wish } = usePro();

  const out = p.stock === 'none';
  const off = discountOf(p);
  const added = flashed === p.id;
  const on = wished(p.id);

  const media = (
    <button
      type="button" onClick={() => open(p)}
      aria-label={`عرض ${p.name}`}
      className={cn(
        'group/img relative block overflow-hidden rounded-xl bg-paper',
        layout === 'grid' ? 'w-full' : 'w-[9.5rem] shrink-0 sm:w-[12rem]',
      )}
    >
      <span className="block aspect-square">
        {p.image ? (
          <Image
            src={p.image} alt={p.name} width={560} height={560}
            className={cn(
              'size-full object-contain p-4 transition-transform duration-700 ease-out',
              'group-hover/img:scale-[1.07]',
              out && 'opacity-50 saturate-50',
            )}
          />
        ) : (
          <span className="grid size-full place-items-center text-xs text-soft">لا صورة</span>
        )}
      </span>

      <span className="absolute top-3 start-3 flex flex-col items-start gap-1.5">
        {out ? (
          <Tag tone="ink">نفد</Tag>
        ) : (
          <>
            {off > 0 && <Tag tone="shop">خصم {ar(off)}٪</Tag>}
            {fresh && off === 0 && <Tag tone="shop">جديد</Tag>}
          </>
        )}
      </span>
    </button>
  );

  const body = (
    <div className={cn('flex flex-1 flex-col', layout === 'list' && 'py-1')}>
      {p.brand && (
        <p className="mb-1 text-[10px] font-bold tracking-[.18em] text-soft">{p.brand}</p>
      )}

      <h3 className={cn('font-bold leading-snug', layout === 'list' ? 'text-lg' : 'text-md')}>
        <button type="button" onClick={() => open(p)} className="text-start hover:text-shop-text">
          {p.name}
        </button>
      </h3>

      {(p.summary || p.variant) && (
        <p className={cn(
          'mt-1 text-xs text-soft',
          layout === 'grid' ? 'line-clamp-1' : 'line-clamp-2 max-w-[60ch]',
        )}>
          {p.summary || p.variant}
        </p>
      )}

      {layout === 'list' && p.description && (
        <p className="mt-2 line-clamp-2 max-w-[70ch] text-xs leading-[1.9] text-soft">
          {p.description}
        </p>
      )}

      <div className="mt-2">
        <Stars value={p.rating} count={p.reviewCount} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-lg font-extrabold text-shop-text">{ar(p.price)}</span>
            <span className="text-[11px] text-soft">{cur}</span>
            {off > 0 && <s className="tabular text-[11px] text-soft/70">{ar(p.oldPrice!)}</s>}
          </div>
          <p className={cn(
            'mt-0.5 text-[11px] font-bold',
            p.stock === 'ok' && 'text-ok',
            p.stock === 'low' && 'text-warn',
            out && 'text-soft',
          )}>
            {p.stockLabel}
          </p>
        </div>

        <button
          type="button" disabled={out} onClick={() => add(p)}
          aria-label={p.hasVariants ? `اختر خيارات ${p.name}` : `أضف ${p.name} للسلة`}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full transition-all duration-200',
            'disabled:cursor-not-allowed disabled:opacity-40',
            added ? 'bg-ok text-white' : 'bg-shop text-on-shop hover:brightness-110 active:scale-90',
          )}
        >
          {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 7) * 0.05, ease: [0.22, 0.61, 0.36, 1] }}
      onPointerMove={onPointerMove}
      className={cn(
        /* ★ `lume` — الضوء الذي يتبع المؤشّر داخل البطاقة.
           `plans.ts:105` يبيع باقة «برو» بعبارة «بطاقات بضوء يتبع
           المؤشر»، والأداة معرَّفة في `globals.css` منذ البداية
           ومستعملة في صفحة الهبوط بوصفها «برهاناً على ما نبيعه» —
           ولم تكن مستعملة في أي بطاقة متجر. أي أن المنصة كانت
           تعرض على صفحتها ما لا يحصل عليه من يشتريه. */
        'lume group relative rounded-2xl border border-line bg-cream p-3 transition-all duration-300',
        'hover:border-shop-edge hover:shadow-soft',
        layout === 'grid' ? 'flex flex-col' : 'flex gap-5',
      )}
    >
      {/* القلب يحفظ محلياً على الجهاز ولا يُرسل إلى أي مكان */}
      <button
        type="button" onClick={() => wish(p.id)}
        aria-pressed={on}
        aria-label={on ? `أزل ${p.name} من المفضّلة` : `أضف ${p.name} إلى المفضّلة`}
        className={cn(
          'absolute top-5 end-5 z-10 grid size-8 place-items-center rounded-full',
          'border transition-colors',
          on
            ? 'border-shop bg-shop text-on-shop'
            : 'border-line bg-cream/90 text-soft hover:border-shop hover:text-shop-text',
        )}
      >
        <Heart className={cn('size-3.5', on && 'fill-current')} />
      </button>

      {media}
      <div className={cn(layout === 'grid' ? 'flex flex-1 flex-col px-1 pt-4' : 'flex flex-1')}>
        {body}
      </div>
    </motion.article>
  );
}

function Tag({ tone, children }: { tone: 'shop' | 'ink'; children: React.ReactNode }) {
  return (
    <span className={cn(
      'rounded-md px-2.5 py-1 text-[10px] font-extrabold',
      tone === 'shop' ? 'bg-shop text-on-shop' : 'bg-ink/85 text-cream',
    )}>
      {children}
    </span>
  );
}
