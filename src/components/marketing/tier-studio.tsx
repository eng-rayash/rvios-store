'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { derivePalette, paletteStyle } from '@/lib/theme';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { cn } from '@/lib/utils';

/**
 * استوديو الدرجات.
 *
 * الحجّة التي تبيع الترقية ليست جملةً عن «تصميم أفضل»، بل أن
 * يرى التاجر **الدرجات الثلاث بلونه هو** جنباً إلى جنب. اللون
 * الذي يختاره يمرّ على `derivePalette` — المحرّك نفسه الذي
 * يصبغ متاجر التجّار — فتتبدّل المعاينات الثلاث معاً.
 *
 * ولهذا قيمة تنافسية محدّدة: بُروز يعرض معاينة نظام اشتراه من
 * غيره، وروابط معاينة إيلين تعطي صفحة مفقودة. وهذه معاينة
 * لمتجر الزائر نفسه.
 */
const SWATCHES: [string, string, string][] = [
  ['#9E2226', '#6E1519', 'أحمر أصيل'],
  ['#2F5D50', '#1E3E35', 'أخضر زيتي'],
  ['#1F4E79', '#143451', 'أزرق عميق'],
  ['#7A4B1E', '#513113', 'بنّي دافئ'],
  ['#5B2A6E', '#3C1B49', 'بنفسجي'],
  ['#0F766E', '#0A4F4A', 'أزرق مخضرّ'],
  ['#B45309', '#7C3A06', 'عنبري'],
  ['#8C1F4A', '#5E1432', 'توتي'],
];

export function TierStudio() {
  const [pick, setPick] = useState(SWATCHES[0]);
  const reduced = useReducedMotion();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
        <span className="text-xs font-bold text-soft">اختر لون علامتك</span>
        <div role="radiogroup" aria-label="لون متجرك" className="flex flex-wrap gap-2.5">
          {SWATCHES.map(([c, d, label]) => {
            const on = pick[0] === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                title={label}
                onClick={() => setPick([c, d, label])}
                style={{ background: c }}
                className={cn(
                  'relative size-8 rounded-full border-2 transition-transform duration-200',
                  'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.25)] hover:scale-110',
                  on ? 'scale-110 border-ink' : 'border-transparent',
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          /* ★ بلا `dark` — والمعاينة كانت تكذب بسببه.
             `derivePalette({ dark: true })` تقلب الأسطح كلها
             (`--cream` و`--paper` و`--ink`)، فكانت بطاقة «فاخر»
             تُعرض داكنة. وقشرة «فاخر» الحقيقية `bg-cream` فاتحة —
             والداكن مرتبط بالسكِن `midnight` وحده لا بالدرجة.
             فكان الزائر يشتري برو ويرى واجهةً غير التي عُرضت. */
          const palette = derivePalette(pick[0], { deep: pick[1] });
          return (
            <motion.article
              key={id}
              layout={!reduced}
              style={paletteStyle(palette)}
              className="group overflow-hidden rounded-xl border border-line bg-paper
                         transition-shadow duration-300 hover:shadow-lift"
            >
              <StorePreview tier={plan.design.id} />
              <div className="p-5">
                <span className="mb-2 inline-block rounded-pill bg-sand px-3 py-1
                                 text-2xs font-extrabold tracking-widest text-brass-deep">
                  {plan.name}
                </span>
                <h3 className="mb-1.5 font-heading text-h3 font-bold">{plan.design.name}</h3>
                <p className="text-sm leading-loose text-soft text-pretty">{plan.design.desc}</p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-soft">
        هذه معاينة حيّة — الألوان تُشتق باللون الذي اخترته بالمحرّك نفسه الذي يصبغ متجرك.
      </p>
    </div>
  );
}

/** واجهة متجر مصغّرة بدرجة التصميم المطلوبة */
function StorePreview({ tier }: { tier: string }) {
  const dark = tier === 'signature';
  const warm = tier === 'warm';

  return (
    <div
      aria-hidden
      className="border-b border-line p-4"
      style={{ background: 'var(--cream)' }}
    >
      {/* هيدر المتجر */}
      <div className="mb-3 flex items-center gap-2">
        <span className="size-6 rounded-lg" style={{ background: 'var(--shop)' }} />
        <span className="h-2 w-20 rounded" style={{ background: 'var(--line)' }} />
        <span className="ms-auto size-4 rounded" style={{ background: 'var(--sand)' }} />
      </div>

      {/* الهيرو: مسطّح · متدرّج · موهج */}
      <div
        className={cn('mb-3 h-14 rounded-lg transition-transform duration-500 group-hover:scale-[1.015]')}
        style={{
          background: dark
            ? 'linear-gradient(120deg, var(--shop), var(--shop-deep))'
            : warm
              ? 'linear-gradient(120deg, var(--shop), var(--shop-lift))'
              : 'var(--shop)',
          boxShadow: dark ? '0 0 28px -4px rgba(var(--shop-rgb),.85)' : undefined,
        }}
      />

      {/* شبكة المنتجات */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg border p-1.5 transition-transform duration-500',
              warm && 'group-hover:-translate-y-0.5',
            )}
            style={{
              borderColor: 'var(--line)',
              background: 'var(--paper)',
              boxShadow: warm ? '0 6px 14px -8px rgba(36,31,27,.4)' : undefined,
            }}
          >
            <span className="mb-1.5 block h-8 rounded" style={{ background: 'var(--sand)' }} />
            <span className="mb-1 block h-1.5 w-3/4 rounded" style={{ background: 'var(--line)' }} />
            <span className="block h-1.5 w-1/2 rounded" style={{ background: 'var(--shop)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
