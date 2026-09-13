'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * أسئلة شائعة.
 *
 * مبنيّ على `<button>` و`aria-expanded` لا على `<details>`:
 * الأخير لا يُحرَّك ارتفاعه بثبات عبر المتصفحات، والغرض هنا
 * أن يفتح السؤال بسلاسة لا أن يقفز. وكل الأسئلة تبقى في DOM
 * فيجدها بحث المتصفح ومحرّكات البحث.
 */
export interface QA { q: string; a: string }

export function Faq({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={cn(
              'overflow-hidden rounded-lg border bg-paper transition-colors',
              isOpen ? 'border-shop/35' : 'border-line',
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 px-5 py-4 text-start"
            >
              <span className="flex-1 text-md font-bold">{item.q}</span>
              <Plus
                className={cn(
                  'size-4 shrink-0 text-shop-text transition-transform duration-300',
                  isOpen && 'rotate-45',
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-loose text-soft text-pretty">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
