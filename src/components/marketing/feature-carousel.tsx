'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BarChart3, ImageIcon, Layers, LayoutDashboard, Link2, MessageCircle, Palette, ShieldCheck, Star,
  type LucideIcon,
} from 'lucide-react';
import { ar, cn } from '@/lib/utils';
import {
  ChatArt, ColorArt, DashboardArt, ImagesArt, LinkArt, ReviewsArt, SecurityArt, StatsArt, VariantsArt,
} from './feature-art';

type Feature = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  art: ComponentType;
};

const FEATURES: Feature[] = [
  {
    id: 'link',
    title: 'رابط يخصّك وحدك',
    body: 'rviosstore.com باسم متجرك. تضعه في حالتك على واتساب أو وصف حسابك، ومن يفتحه يرى متجرك وحده.',
    icon: Link2,
    art: LinkArt,
  },
  {
    id: 'orders',
    title: 'طلباتك عبر واتساب',
    body: 'الطلب يُسجَّل عندنا برقم مرجعي، ثم يصلك جاهزاً على واتساب لتؤكّده كما تفعل اليوم تماماً.',
    icon: MessageCircle,
    art: ChatArt,
  },
  {
    id: 'reviews',
    title: 'تقييمات يكتبها عملاؤك',
    body: 'أي زائر يقيّم والتقييم يظهر فوراً، ومن اشترى فعلاً تظهر عليه شارة «مشترٍ موثَّق». وأنت تردّ وتُخفي المسيء من لوحتك.',
    icon: Star,
    art: ReviewsArt,
  },
  {
    id: 'color',
    title: 'لونك يصبغ المتجر كله',
    body: 'لست تختار لون زر. اللون الواحد يشتقّ لوحة كاملة — أسطحاً وحدوداً ونصوصاً — فيبدو المتجر ملكك.',
    icon: Palette,
    art: ColorArt,
  },
  {
    id: 'variants',
    title: 'خيارات لكل منتج',
    body: 'مقاسات وألوان وأحجام بأسعار مختلفة للمنتج الواحد، مع مؤشر توفّر صادق لكل خيار.',
    icon: Layers,
    art: VariantsArt,
  },
  {
    id: 'dashboard',
    title: 'لوحة تحكّم كاملة',
    body: 'منتجاتك وطلباتك وإعدادات متجرك في مكان واحد، من جوالك أو حاسوبك بلا تطبيق تُنزّله.',
    icon: LayoutDashboard,
    art: DashboardArt,
  },
  {
    id: 'stats',
    title: 'إحصائيات متجرك',
    body: 'زوّار متجرك، منتجاتك الأكثر طلباً، ومبيعاتك — أرقام حقيقية من متجرك أنت لا تقديرات.',
    icon: BarChart3,
    art: StatsArt,
  },
  {
    id: 'images',
    title: 'صور تُرفع مضغوطة',
    body: 'الصور تُهيَّأ قبل الرفع، فيفتح متجرك سريعاً على شبكة بطيئة وباقة بيانات محدودة.',
    icon: ImageIcon,
    art: ImagesArt,
  },
  {
    id: 'backup',
    title: 'أمان ونسخ احتياطي',
    body: 'ليست ميزة مدفوعة تُباع في الباقة الأعلى — هي حقّ في كل الباقات بما فيها المجانية.',
    icon: ShieldCheck,
    art: SecurityArt,
  },
];

/** مهلة التبديل التلقائي: أطول من ٣ ثوانٍ الشائعة لأن نصّ
 *  البطاقة سطران بالعربية، والقارئ يحتاج أن يُتمّهما لا أن يلحقهما. */
const AUTOPLAY = 5200;
const ROW = 64;

/** يطوي مسافةً إلى أقصر تمثيل لها على حلقة — فالعنصر البعيد
 *  سبع خطوات إلى الأمام هو نفسه خطوةً واحدة إلى الخلف. */
const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

export function FeatureCarousel() {
  const len = FEATURES.length;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const goTo = useCallback(
    (next: number, focus = false) => {
      const i = ((next % len) + len) % len;
      setIndex(i);
      if (focus) tabs.current[i]?.focus();
    },
    [len],
  );

  /* التبديل التلقائي يتوقّف عند التحويم أو عند دخول لوحة
     المفاتيح القسمَ — ويُلغى كلياً مع تفضيل تقليل الحركة، إذ
     المحتوى المتحرّك تلقائياً هو أول ما يؤذي من طلب سكونه. */
  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % len), AUTOPLAY);
    return () => clearInterval(t);
  }, [paused, reduced, len]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index + 1,   // في RTL السهم الأيسر يتقدّم
      ArrowRight: index - 1,
      Home: 0,
      End: len - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    goTo(next, true);
  };

  const active = FEATURES[index];

  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-cream shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex flex-col lg:flex-row">
        {/* ══ قائمة الميزات ══
            سطح حبريّ لا أحمر: الأحمر هو العنصر البؤري داخل كل
            رسم، ولو صُبغ اللوح كله به لتنافس السطحُ والرسمُ على
            العين وضاعت البؤرة في كليهما. */}
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="ميزات المنصة"
          onKeyDown={onKeyDown}
          className="relative isolate flex w-full shrink-0 items-center justify-center
                     overflow-hidden bg-ink px-6 py-10 lg:w-[38%] lg:px-8 lg:py-14"
        >
          {/* الخامة نفسها التي على الهيرو والوصلة ولوح الختام —
              تحت المحتوى بـ`-z-10` لا فوقه */}
          <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 [--grain:.15]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-ink to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-ink to-transparent" />

          {reduced ? (
            /* بلا حركة: القائمة تُعرض كاملةً بترتيبها الطبيعي */
            <div className="grid w-full gap-2">
              {FEATURES.map((f, i) => (
                <Chip
                  key={f.id}
                  ref={(el) => { tabs.current[i] = el; }}
                  feature={f}
                  active={i === index}
                  onSelect={() => goTo(i)}
                />
              ))}
            </div>
          ) : (
            <div className="relative flex h-[340px] w-full items-center justify-center lg:h-[420px] lg:justify-start">
              {FEATURES.map((f, i) => {
                const d = wrap(-len / 2, len / 2, i - index);
                const far = Math.abs(d) >= 3;
                return (
                  <motion.div
                    key={f.id}
                    className="absolute"
                    style={{ height: ROW }}
                    animate={{ y: d * ROW, opacity: 1 - Math.abs(d) * 0.25 }}
                    transition={{ type: 'spring', stiffness: 90, damping: 22, mass: 1 }}
                  >
                    <Chip
                      ref={(el) => { tabs.current[i] = el; }}
                      feature={f}
                      active={i === index}
                      muted={far}
                      onSelect={() => goTo(i)}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══ البطاقة ══ */}
        <div className="flex flex-1 items-center justify-center border-t border-line bg-paper
                        px-6 py-12 lg:border-t-0 lg:border-s lg:px-10 lg:py-14">
          {/* كومة في خليّة شبكة واحدة لا `absolute inset-0`:
              الارتفاع يصير ارتفاع أطول بطاقة تلقائياً، فيأخذ الرسم
              نسبته ٣:٤ كاملةً بدل أن يُحشر في صندوق أفقي فيتقلّص
              إلى ثلثي العرض المتاح. */}
          <div className="grid w-full max-w-[320px] sm:max-w-[348px]">
            {FEATURES.map((f, i) => {
              const d = wrap(-len / 2, len / 2, i - index);
              const isActive = d === 0;
              if (reduced && !isActive) return null;

              const Art = f.art;
              /* في RTL القادم يأتي من جهة القراءة التالية — أي من
                 اليسار — والماضي ينزاح يميناً. */
              const x = isActive ? 0 : d === 1 ? -92 : d === -1 ? 92 : 0;

              return (
                <motion.article
                  key={f.id}
                  id={`feat-panel-${f.id}`}
                  role="tabpanel"
                  aria-labelledby={`feat-tab-${f.id}`}
                  aria-hidden={!isActive}
                  initial={false}
                  animate={{
                    x,
                    scale: isActive ? 1 : Math.abs(d) === 1 ? 0.86 : 0.72,
                    opacity: isActive ? 1 : Math.abs(d) === 1 ? 0.38 : 0,
                    rotate: isActive ? 0 : d === 1 ? -3 : d === -1 ? 3 : 0,
                    zIndex: isActive ? 20 : Math.abs(d) === 1 ? 10 : 0,
                    pointerEvents: isActive ? 'auto' : 'none',
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 260, damping: 25, mass: 0.8 }
                  }
                  className="col-start-1 row-start-1 flex flex-col overflow-hidden rounded-lg
                             border border-line bg-cream shadow-soft"
                >
                  <div className="aspect-[3/4] bg-paper">
                    <Art />
                  </div>
                  <div className="flex-1 border-t border-line px-6 py-5">
                    <p className="mb-2 flex items-center gap-2 text-2xs font-extrabold tracking-[.2em] text-brass-deep">
                      <span className="size-1.5 rounded-full bg-shop" />
                      {ar(i + 1)} من {ar(len)}
                    </p>
                    <h3 className="mb-1.5 font-display text-xl font-bold">{f.title}</h3>
                    <p className="text-sm leading-loose text-soft text-pretty">{f.body}</p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>

      {/* حالة القسم لقارئ الشاشة: التبديل التلقائي لا يُسمع */}
      <p aria-live="polite" className="sr-only">{active.title}</p>
    </div>
  );
}

/* ══════════ شريحة الميزة ══════════ */
function Chip({
  ref,
  feature,
  active,
  muted,
  onSelect,
}: {
  ref?: (el: HTMLButtonElement | null) => void;
  feature: Feature;
  active: boolean;
  muted?: boolean;
  onSelect: () => void;
}) {
  const Icon = feature.icon;
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`feat-tab-${feature.id}`}
      aria-selected={active}
      aria-controls={`feat-panel-${feature.id}`}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-pill border px-5 py-3.5 text-start transition-colors duration-500',
        'lg:w-auto lg:whitespace-nowrap',
        active
          ? 'border-cream bg-cream text-ink'
          : 'border-cream/20 bg-transparent text-cream/55 hover:border-cream/40 hover:text-cream',
        muted && 'pointer-events-none',
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', active ? 'text-shop-text' : 'text-cream/40')} />
      <span className="text-sm font-bold">{feature.title}</span>
    </button>
  );
}
