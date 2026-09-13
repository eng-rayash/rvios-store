'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { Heart } from 'lucide-react';
import type { ProductView } from '@/lib/store';
import { ar, cn } from '@/lib/utils';
import { useCurrency } from '../currency';
import { discountOf } from '../pro/pro-card';
import { useAtelier, splitAxes } from './context';

/**
 * بطاقة قطعة في قالب «أتولييه».
 *
 * ثلاثة فروق عن بطاقة «التوقيع»، وكلها من طبيعة المنتج لا من
 * الذوق:
 *
 * ١) الصورة **طولية ومقصوصة** (٣:٤ بـcover) لا مربّعة بـcontain.
 *    الملبوس يُقيَّم على عارضة: الطول والوقوع والانسدال لا تُرى
 *    في مربّع يترك هواءً حول القطعة.
 *
 * ٢) **صورة ثانية عند التمرير** — من صور الألوان حين توجد. ولا
 *    تُختلق: قطعةٌ بصورة واحدة تبقى بصورة واحدة، ولا نعوّضها
 *    بتكبيرٍ يوهم بأن هناك ما يُرى.
 *
 * ٣) **المقاسات والألوان على البطاقة**. اللون عيّنته صورته هو —
 *    لا مربّع لونٍ نترجم إليه «عنّابي» فنخطئ الدرجة. والمقاس
 *    النافد يبقى مشطوباً لا محذوفاً: أن تعرف أن مقاسك موجود
 *    ونفد غير أن تظنّه غير مصنوع.
 *
 * والنقر على مقاس يفتح الورقة عليه، ولا يضيف إلى السلة من
 * الشبكة: شراء مقاسٍ بلا مقارنته بجدول المقاسات هو أصل المرتجع.
 */
export function AtelierCard({ product: p, index = 0 }: {
  product: ProductView;
  index?: number;
}) {
  const { open, wished, wish } = useAtelier();
  const cur = useCurrency();
  const reduced = useReducedMotion();
  const { visual, plain } = splitAxes(p);

  // اللون المعروض على البطاقة — حالة محلية لا تغادرها
  const [shown, setShown] = useState<string>('');
  const picked = visual?.values.find((v) => v.value === shown) ?? null;

  const cover = picked?.image || p.image;
  // صورة التمرير: أي صورة أخرى للقطعة نفسها تختلف عمّا يُعرض.
  // لا نعرض لونًا آخر على أنه وجهٌ ثانٍ للمعروض — قطعةٌ بصورة
  // واحدة لهذا اللون تبقى بلا تمرير، وهذا أصدق من إيهامٍ بصور.
  const hover = p.altImages.find((i) => i !== cover) ?? '';

  const off = discountOf(p);
  const on = wished(p.id);
  const gone = p.stock === 'none';

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.6, delay: Math.min(index, 7) * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
      className="group relative"
    >
      <div className="relative overflow-hidden bg-sand">
        <button
          type="button"
          onClick={() => open(p, { [visual?.key ?? 'v2']: shown || undefined, cover })}
          aria-label={`افتح ${p.name}`}
          className="block w-full"
        >
          {cover ? (
            <Image
              src={cover} alt={p.name} width={720} height={960}
              className={cn(
                'aspect-[3/4] w-full object-cover transition-opacity duration-500',
                hover && 'group-hover:opacity-0 group-focus-within:opacity-0',
                gone && 'opacity-70',
              )}
            />
          ) : (
            <span className="grid aspect-[3/4] w-full place-items-center font-display text-4xl text-soft/40">
              {p.name.charAt(0)}
            </span>
          )}

          {/* الصورة الثانية لا تُركَّب إلا إذا وُجدت فعلاً */}
          {hover && (
            <Image
              src={hover} alt="" width={720} height={960} aria-hidden
              className="absolute inset-0 aspect-[3/4] w-full object-cover opacity-0
                         transition-opacity duration-500
                         group-hover:opacity-100 group-focus-within:opacity-100"
            />
          )}
        </button>

        {(off > 0 || gone) && (
          <span className="pointer-events-none absolute top-3 start-3 bg-ink/85 px-2.5 py-1
                           text-[10px] font-extrabold tracking-wide text-cream">
            {gone ? 'نفد' : `خصم ${ar(off)}٪`}
          </span>
        )}

        {/* القلب يُحفظ على الجهاز وحده ولا يُرسل إلى أي مكان */}
        <button
          type="button" onClick={() => wish(p.id)} aria-pressed={on}
          aria-label={on ? `أزل ${p.name} من المفضّلة` : `أضف ${p.name} إلى المفضّلة`}
          className={cn(
            'absolute top-3 end-3 grid size-9 place-items-center rounded-full transition-colors',
            on ? 'bg-shop text-on-shop' : 'bg-cream/80 text-ink hover:bg-cream',
          )}
        >
          <Heart className={cn('size-4', on && 'fill-current')} />
        </button>
      </div>

      {/* عيّنات اللون — صورة كل لون لا مربّع نخترع درجته */}
      {visual && visual.values.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visual.values.map((v) => (
            <button
              key={v.value} type="button"
              onClick={() => setShown((s) => (s === v.value ? '' : v.value))}
              title={v.value}
              aria-label={`${visual.name}: ${v.value}`}
              aria-pressed={shown === v.value}
              className={cn(
                'size-7 overflow-hidden rounded-full border transition-colors',
                shown === v.value ? 'border-ink' : 'border-line hover:border-soft',
                !v.inStock && 'opacity-45',
              )}
            >
              {v.image
                ? <Image src={v.image} alt="" width={56} height={56} className="size-full object-cover" />
                : <span className="grid size-full place-items-center bg-sand text-[9px]">{v.value.charAt(0)}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <h3 className="text-md font-bold leading-snug">
          <button type="button" onClick={() => open(p, { cover })} className="text-start hover:text-shop-text">
            {p.name}
          </button>
        </h3>

        {p.summary && (
          <p className="mt-1 line-clamp-1 text-xs text-soft">{p.summary}</p>
        )}

        <div className="mt-2 flex items-baseline gap-2">
          <span className="tabular text-md font-extrabold text-ink">{ar(p.price)}</span>
          <span className="text-2xs text-soft">{cur}</span>
          {p.oldPrice && p.oldPrice > p.price && (
            <s className="tabular text-xs text-soft/70">{ar(p.oldPrice)}</s>
          )}
        </div>

        {/* المقاسات: النافد مشطوب لا محذوف */}
        {plain && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {plain.values.map((v) => (
              <button
                key={v.value} type="button"
                onClick={() => open(p, { [plain.key]: v.value, cover })}
                disabled={!v.inStock}
                className={cn(
                  'tabular text-xs transition-colors',
                  v.inStock ? 'text-soft hover:text-ink' : 'text-soft/45 line-through',
                )}
              >
                {v.value}
              </button>
            ))}
          </div>
        )}

        {/* «متوفر» على كل بطاقة ضجيج — لا يُقال إلا ما يُفيد */}
        {p.stock !== 'ok' && (
          <p className={cn('mt-2 text-2xs font-bold', gone ? 'text-soft' : 'text-warn')}>
            {p.stockLabel}
          </p>
        )}
      </div>
    </motion.article>
  );
}
