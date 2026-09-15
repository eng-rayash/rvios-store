'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ShoppingBag, Eye, Check, BarChart3 } from 'lucide-react';
import { ar } from '@/lib/utils';

/**
 * بطاقات الإشعار الطائرة فوق مشهد الهيرو.
 *
 * ليست زينة: هي أقصر طريقة لقول «هذا النظام يعمل الآن» بلا
 * جملة تسويقية واحدة. الزائر يرى طلباً يصل وزائراً يتصفّح،
 * فيفهم أن أمامه منتجاً حياً لا لقطة شاشة.
 *
 * الأرقام **مُعلَنة كعيّنة** في نصّ الصفحة المجاور: اختلاق
 * مبيعات وهمية وعرضها كأنها حقيقية خداع، لا تسويق.
 */
const NAMES = ['ليلى الحمدي', 'عمر خالد', 'أروى الشامي', 'محمد الوصابي', 'سمية القباطي'];

type Kind = 'order' | 'visit' | 'ok' | 'sale';

const ICONS: Record<Kind, React.ComponentType<{ className?: string }>> = {
  order: ShoppingBag,
  visit: Eye,
  ok: Check,
  sale: BarChart3,
};

const TONE: Record<Kind, string> = {
  order: 'bg-shop text-on-shop',
  visit: 'bg-ink text-cream',
  ok: 'bg-ok text-white',
  sale: 'bg-brass-deep text-white',
};

// العملة تتبع المتجر المعروض خلف البطاقات: بطاقة تقول «ر.ي»
// فوق متجر أردني تناقض ما تحتها مباشرةً
function build(shop: string, cur: string) {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const feed: { kind: Kind; title: string; sub: string }[] = [
    { kind: 'order', title: 'طلب جديد', sub: `من ${pick(NAMES)} · ${ar(4500 + Math.floor(Math.random() * 40) * 500)} ${cur}` },
    { kind: 'visit', title: 'زائر جديد', sub: `يتصفّح ${shop} الآن` },
    { kind: 'ok', title: 'طلب مؤكد', sub: 'أُرسل التأكيد عبر واتساب' },
    { kind: 'sale', title: 'مبيعات اليوم', sub: `${ar(60000 + Math.floor(Math.random() * 90) * 1000)} ${cur}` },
  ];
  return feed;
}

export function LiveChips({ shop, currency }: { shop: string; currency: string }) {
  const reduced = useReducedMotion();
  const [at, setAt] = useState(0);

  /**
   * البطاقات تُبنى بعد التركيب لا أثناء التصيير على الخادم.
   * محتواها عشوائي، فتوليده مرّتين يعطي نصّين مختلفين ويُفشل
   * الترطيب (hydration) — والخادم لا يعرف شيئاً يستحق تصييره
   * هنا أصلاً: القيمة كلها في الحركة.
   */
  const [feed, setFeed] = useState<ReturnType<typeof build> | null>(null);
  useEffect(() => { setFeed(build(shop, currency)); }, [shop, currency]);

  useEffect(() => {
    if (reduced || !feed) return;
    const t = setInterval(() => setAt((n) => n + 1), 3200);
    return () => clearInterval(t);
  }, [reduced, feed]);

  if (!feed) return null;

  // تقليل الحركة يعني بطاقة ثابتة واحدة، لا تعاقباً — والمعلومة تصل كما هي
  const shown = reduced ? [feed[0]] : [feed[at % feed.length]];

  return (
    <div
      className="pointer-events-none relative z-10 mx-auto mb-5 grid w-full max-w-[19rem] gap-3
                 sm:absolute sm:start-0 sm:top-[14%] sm:mx-0 sm:mb-0 sm:w-max sm:max-w-none"
      aria-hidden
    >
      <AnimatePresence mode="popLayout">
        {shown.map((item, i) => {
          const Icon = ICONS[item.kind];
          return (
            <motion.div
              key={`${at}-${i}`}
              initial={reduced ? false : { opacity: 0, x: -18, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -14, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="flex items-center gap-3 rounded-lg border border-line/70 bg-paper/95
                         px-3.5 py-2.5 shadow-lift backdrop-blur-md"
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-[9px] ${TONE[item.kind]}`}>
                <Icon className="size-4" />
              </span>
              <span className="grid leading-tight">
                <b className="text-2xs font-extrabold text-ink">{item.title}</b>
                <i className="text-2xs not-italic text-soft">{item.sub}</i>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
