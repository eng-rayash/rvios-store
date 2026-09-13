'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Truck, ShieldCheck, MessageCircle, BadgeCheck, ArrowLeft, Wallet,
} from 'lucide-react';
import type { CategoryView, ProductView } from '@/lib/store';
import { ar, cn, items } from '@/lib/utils';
import { useCurrency } from '../currency';
import { usePro } from './context';
import { ProCard, Stars, discountOf } from './pro-card';
import { SectionHead } from './pro-shell';

/**
 * واجهة متجر «برو» — الصفحة الأولى.
 *
 * كل قسم هنا مشدود إلى بيانات المتجر نفسه: التصنيفات تأخذ
 * صورها من أوّل منتج فيها، و«جديد» تعني أحدث ما أضافه التاجر
 * لا وسماً يدوياً، و«العروض» لا تظهر إلا حيث سُجِّل سعرٌ سابق.
 *
 * ولذلك لا يوجد في هذه الصفحة عدّاد تنازلي: القاعدة لا تحفظ
 * تاريخ انتهاء عرض، والعدّاد الذي يعيد نفسه كل يوم يكشف نفسه
 * في الزيارة الثانية ويأخذ معه مصداقية بقية الصفحة. مكانه
 * حقيقتان تُقنعان أكثر: كم يوفّر العميل، وكم بقي في المخزون.
 */
export function ProHome({ products }: { products: ProductView[] }) {
  const { store, categories, brands } = usePro();

  const fresh = useMemo(
    () => new Set(products.slice(0, 6).map((p) => p.id)),
    [products],
  );

  const deals = useMemo(
    () => products.filter((p) => discountOf(p) > 0 && p.stock !== 'none')
      .sort((a, b) => discountOf(b) - discountOf(a)),
    [products],
  );

  const shopHref = `/${store.slug}/shop`;

  return (
    <main>
      <Hero products={products} deals={deals} />

      {categories.length > 0 && (
        <Section id="categories">
          <SectionHead title="الأقسام الرئيسية" href={shopHref} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.slice(0, 5).map((c, i) => (
              <CategoryCard key={c.id} cat={c} products={products} index={i} />
            ))}
          </div>
        </Section>
      )}

      {products.length > 0 && (
        <Section>
          <SectionHead title="منتجات جديدة" href={shopHref} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {products.slice(0, 5).map((p, i) => (
              <ProCard key={p.id} product={p} index={i} fresh={fresh.has(p.id)} />
            ))}
          </div>
        </Section>
      )}

      <PromoBand products={products} />

      {deals.length > 0 && (
        <Section id="deals">
          <SectionHead title="عروض مميزة" href={`${shopHref}?deals=1`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {deals.slice(0, 4).map((p, i) => <DealCard key={p.id} product={p} index={i} />)}
          </div>
        </Section>
      )}

      <TrustBar />

      {brands.length > 0 && (
        <Section>
          <SectionHead title="الماركات المتوفّرة" href={shopHref} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {brands.map((b) => (
              <Link
                key={b.name} href={`${shopHref}?brand=${encodeURIComponent(b.name)}`}
                className="group grid h-24 place-items-center rounded-xl border border-line
                           bg-cream transition-all duration-300 hover:border-shop-edge
                           hover:bg-shop-veil"
              >
                <span className="text-center">
                  <span className="block font-en text-lg font-bold tracking-wide text-ink
                                   transition-colors group-hover:text-shop-text">
                    {b.name}
                  </span>
                  <span className="mt-1 block text-[11px] text-soft">
                    {items(b.count)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Reach />
    </main>
  );
}

/* ── الهيرو ─────────────────────────────────────────────── */

/**
 * شرائح الهيرو تُبنى من المتجر لا من قائمة ثابتة: صورة الواجهة
 * أولاً، ثم أقوى خصمٍ فعليّ، ثم أغلى قطعة. متجرٌ بلا خصومات
 * يحصل على شريحتين، ولا يرى الزائر شريحةً فارغة.
 */
function Hero({ products, deals }: { products: ProductView[]; deals: ProductView[] }) {
  const { store } = usePro();
  const reduced = useReducedMotion();
  const cur = useCurrency();
  const shopHref = `/${store.slug}/shop`;

  const slides = useMemo(() => {
    const out: {
      key: string; image: string; contain: boolean;
      eyebrow?: string; title: string; note?: string; cta: string; href: string;
    }[] = [];

    const cover = store.showcase || store.banner;
    if (cover) {
      out.push({
        key: 'cover', image: cover, contain: false,
        eyebrow: store.city ? `من ${store.city}` : undefined,
        title: store.tagline || store.name,
        note: store.deliveryNote,
        cta: 'تسوّق الآن', href: shopHref,
      });
    }

    const top = deals[0];
    if (top) {
      out.push({
        key: `deal-${top.id}`, image: top.image, contain: true,
        eyebrow: `خصم ${ar(discountOf(top))}٪`,
        title: top.name,
        note: `${ar(top.price)} ${cur} بدلاً من ${ar(top.oldPrice!)} ${cur}`,
        cta: 'اغتنم العرض', href: `${shopHref}?deals=1`,
      });
    }

    const flagship = [...products].sort((a, b) => b.price - a.price)[0];
    if (flagship && flagship.id !== top?.id) {
      out.push({
        key: `top-${flagship.id}`, image: flagship.image, contain: true,
        // اسم المتجر لا اسمٌ مكتوب: الشريحة نفسها تُعرض على كل
        // متجر برو، فاسمٌ ثابت فيها يَنسب اختيار متجرٍ إلى غيره.
        eyebrow: flagship.brand || `اختيار ${store.name}`,
        title: flagship.name,
        note: flagship.summary,
        cta: 'اكتشف القطعة', href: shopHref,
      });
    }

    return out;
  }, [store, products, deals, cur, shopHref]);

  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);

  /**
   * التقدّم التلقائي يتوقّف عند المرور بالمؤشّر أو التركيز
   * بلوحة المفاتيح: شريحةٌ تنزلق تحت يد القارئ بينما يقرأ
   * عنوانها تُفقده مكانه — ومَن يتنقّل بالمفاتيح تُفلته تماماً.
   * ويحترم كذلك تفضيل تقليل الحركة فلا يتحرّك أصلاً.
   */
  useEffect(() => {
    if (reduced || held || slides.length < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [reduced, held, slides.length]);

  if (slides.length === 0) return null;
  const s = slides[Math.min(at, slides.length - 1)];

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-6">
      <div
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocusCapture={() => setHeld(true)}
        onBlurCapture={() => setHeld(false)}
        className="relative min-h-[clamp(19rem,36vw,27rem)] overflow-hidden rounded-2xl
                   bg-gradient-to-l from-ink via-shop-deep to-ink"
      >
        {/*
          الشريحة طبقةٌ واحدة تحمل صورتها ونصّها معاً، والطبقات
          تتقاطع بالتلاشي لا بالتناوب: `mode="wait"` كان يُخرج
          الشريحة قبل أن تدخل التالية، فيرى الزائر لوحةً فارغة كل
          ستّ ثوانٍ. والتقاطع يبقي شيئاً معروضاً دائماً.

          وللشريحة طبيعتان: غلاف المتجر يملأ اللوحة كخلفية، وصورة
          المنتج تقف في نصفها كقطعة معروضة. معاملتهما معاملةً
          واحدة تُنتج إمّا منتجاً ممطوطاً أو غلافاً مقصوصاً.
        */}
        <AnimatePresence initial={false}>
          <motion.div
            key={s.key}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-0"
          >
            <div className={cn(
              'absolute inset-y-0',
              s.contain ? 'end-0 w-[52%] p-6 sm:p-10' : 'inset-x-0',
            )}>
              <div className="relative size-full">
                <Image
                  src={s.image} alt="" fill priority sizes="100vw"
                  className={cn(s.contain
                    ? 'object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,.5)]'
                    : 'object-cover')}
                />
              </div>
            </div>

            {/* التدرّج داكن عند جهة النص (البداية في RTL) وشفّاف
                عند جهة الصورة — فيبقى العنوان مقروءاً بلا أن
                تُطفأ الصورة */}
            <div className={cn(
              'absolute inset-0',
              s.contain
                ? 'bg-gradient-to-l from-ink/95 via-ink/60 to-transparent'
                : 'bg-gradient-to-l from-ink/90 via-ink/45 to-ink/5',
            )} />

            <div className="relative flex h-full items-center">
              <div className="w-full p-8 sm:p-12 lg:w-[56%]">
                {s.eyebrow && (
                  <span className="mb-4 inline-block rounded-pill bg-shop px-3.5 py-1.5
                                   text-[11px] font-extrabold text-on-shop">
                    {s.eyebrow}
                  </span>
                )}

                <h2 className="max-w-[18ch] font-display text-[clamp(2rem,4.6vw,3.4rem)]
                               font-bold leading-[1.2] text-cream">
                  {s.title}
                </h2>

                {s.note && (
                  <p className="mt-3 max-w-[46ch] text-sm text-cream/75">{s.note}</p>
                )}

                <Link
                  href={s.href}
                  className="mt-7 inline-flex items-center gap-2 rounded-pill bg-shop px-7 py-3.5
                             text-sm font-bold text-on-shop transition-all hover:brightness-110
                             active:scale-95"
                >
                  {s.cta}
                  <ArrowLeft className="size-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {slides.map((sl, i) => (
              <button
                key={sl.key} type="button" onClick={() => setAt(i)}
                aria-label={`الشريحة ${i + 1}`}
                aria-current={i === at}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === at ? 'w-7 bg-cream' : 'w-1.5 bg-cream/45 hover:bg-cream/70',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── الأقسام ────────────────────────────────────────────── */

function CategoryCard({ cat, products, index }: {
  cat: CategoryView; products: ProductView[]; index: number;
}) {
  const { store } = usePro();
  const reduced = useReducedMotion();
  // صورة القسم = أوّل منتج فيه. لا صورة قسم مرفوعة في القاعدة،
  // والبديل الوحيد أيقونة عامة تجعل الأقسام الستة متشابهة.
  const cover = products.find((p) => p.categoryId === cat.id && p.image)?.image;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
    >
      <Link
        href={`/${store.slug}/shop?cat=${cat.id}`}
        className="group flex flex-col items-center gap-3 rounded-2xl border border-line
                   bg-paper p-5 text-center transition-all duration-300
                   hover:border-shop-edge hover:bg-cream hover:shadow-soft"
      >
        <span className="grid size-24 place-items-center overflow-hidden rounded-xl bg-cream">
          {cover ? (
            <Image
              src={cover} alt="" width={200} height={200}
              className="size-full object-contain p-2 transition-transform duration-500
                         group-hover:scale-110"
            />
          ) : (
            <span className="text-xs text-soft">{cat.name}</span>
          )}
        </span>
        <span>
          <span className="block text-sm font-bold transition-colors group-hover:text-shop-text">
            {cat.name}
          </span>
          <span className="mt-0.5 block text-[11px] text-soft">{items(cat.count)}</span>
        </span>
      </Link>
    </motion.div>
  );
}

/* ── الشريط الترويجي ────────────────────────────────────── */

function PromoBand({ products }: { products: ProductView[] }) {
  const { store, categories } = usePro();
  // القسم الأغزر منتجاتٍ هو ما يستحقّ شريطاً كاملاً
  const top = [...categories].sort((a, b) => b.count - a.count)[0];
  if (!top) return null;

  const hero = products.find((p) => p.categoryId === top.id && p.image);
  if (!hero) return null;

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l
                      from-shop-deep via-shop to-shop-deep">
        <div className="absolute inset-0 opacity-30
                        [background:radial-gradient(60%_120%_at_20%_50%,#fff3,transparent)]" />

        <div className="relative flex flex-col items-center gap-6 p-8 sm:flex-row sm:p-12">
          <div className="flex-1 text-center sm:text-start">
            <h2 className="max-w-[16ch] font-display text-[clamp(1.7rem,3.4vw,2.6rem)]
                           font-bold leading-[1.25] text-on-shop">
              {top.name} مختارة بعناية
            </h2>
            <p className="mt-2.5 max-w-[44ch] text-sm text-on-shop/80">
              {items(top.count)} في قسم {top.name} — كلّها مُجرَّبة قبل عرضها.
            </p>
            <Link
              href={`/${store.slug}/shop?cat=${top.id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-pill bg-cream px-7 py-3.5
                         text-sm font-bold text-shop-text transition-transform active:scale-95"
            >
              تسوّق {top.name}
              <ArrowLeft className="size-4" />
            </Link>
          </div>

          <div className="relative size-48 shrink-0 sm:size-60">
            <Image src={hero.image} alt="" fill sizes="240px" className="object-contain
                                                                        drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── العروض ────────────────────────────────────────────── */

function DealCard({ product: p, index }: { product: ProductView; index: number }) {
  const cur = useCurrency();
  const reduced = useReducedMotion();
  const { open, add, flashed } = usePro();
  const off = discountOf(p);
  const saved = (p.oldPrice ?? p.price) - p.price;

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-ink text-cream"
    >
      <span className="absolute top-4 start-4 z-10 rounded-md bg-shop px-2.5 py-1
                       text-[10px] font-extrabold text-on-shop">
        خصم {ar(off)}٪
      </span>

      <button
        type="button" onClick={() => open(p)} aria-label={`عرض ${p.name}`}
        className="relative block aspect-[4/3] w-full overflow-hidden"
      >
        <Image
          src={p.image} alt={p.name} fill sizes="(max-width:640px) 100vw, 300px"
          className="object-contain p-6 transition-transform duration-700 group-hover:scale-110"
        />
      </button>

      <div className="flex flex-1 flex-col gap-3 border-t border-cream/10 p-5">
        <h3 className="text-md font-bold leading-snug">
          <button type="button" onClick={() => open(p)} className="text-start hover:text-shop-lift">
            {p.name}
          </button>
        </h3>

        <Stars value={p.rating} count={p.reviewCount} />

        <div className="flex items-baseline gap-2">
          <span className="tabular text-xl font-extrabold text-shop-lift">{ar(p.price)}</span>
          <span className="text-[11px] text-cream/60">{cur}</span>
          <s className="tabular text-[11px] text-cream/45">{ar(p.oldPrice!)}</s>
        </div>

        {/*
          موضع العدّاد التنازلي في التصاميم الشائعة — وهنا حقيقتان
          بدله: ما يوفّره العميل فعلاً، وما بقي في المخزون. كلاهما
          يصمد في الزيارة الثانية، والعدّاد لا يصمد.
        */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t
                        border-cream/10 pt-3 text-[11px] font-bold">
          <span className="text-ok">توفّر {ar(saved)} {cur}</span>
          <span className={cn(p.stock === 'low' ? 'text-warn' : 'text-cream/60')}>
            {p.stockLabel}
          </span>
        </div>

        <button
          type="button" onClick={() => add(p)}
          className={cn(
            'rounded-pill py-3 text-xs font-bold transition-all active:scale-95',
            flashed === p.id
              ? 'bg-ok text-white'
              : 'bg-shop text-on-shop hover:brightness-110',
          )}
        >
          {flashed === p.id ? 'أُضيف إلى السلة' : 'أضف إلى السلة'}
        </button>
      </div>
    </motion.article>
  );
}

/* ── شريط الثقة ─────────────────────────────────────────── */

/**
 * كل بند هنا مقروء من إعدادات التاجر — لا وعود عامة كتبها
 * القالب. متجر بلا سياسة إرجاع لا يعرض «إرجاع مجاني»، ومتجر
 * غير موثّق لا يعرض شارة توثيق.
 */
function TrustBar() {
  const { store } = usePro();
  const cur = store.currency;

  const items = [
    {
      icon: Truck, title: 'توصيل إلى بابك',
      note: store.deliveryFreeOver
        ? `مجاناً فوق ${ar(store.deliveryFreeOver)} ${cur}`
        : store.deliveryFee ? `${ar(store.deliveryFee)} ${cur} للطلب` : 'توصيل مجاني',
    },
    store.payMethods.includes('cod') && {
      icon: Wallet, title: 'الدفع عند الاستلام',
      note: 'تدفع حين تستلم طلبك بيدك',
    },
    store.whatsapp && {
      icon: MessageCircle, title: 'طلبك عبر واتساب',
      note: store.hours || 'نردّ عليك مباشرة',
    },
    store.verified
      ? { icon: BadgeCheck, title: 'متجر موثّق', note: 'وثّقته منصة RVIOS Store' }
      : { icon: ShieldCheck, title: 'منتجات أصلية', note: 'مختارة ومُجرَّبة قبل عرضها' },
  ].filter(Boolean) as { icon: typeof Truck; title: string; note: string }[];

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line
                      bg-line sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-3.5 bg-paper p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full
                             bg-shop-veil text-shop-text">
              <it.icon className="size-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-bold">{it.title}</span>
              <span className="mt-0.5 block text-[11px] text-soft">{it.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── التواصل ────────────────────────────────────────────── */

/**
 * موضع «النشرة البريدية» في التصاميم الشائعة.
 *
 * المتجر لا يملك قائمة بريدية ولا جدولاً يحفظ المشتركين، وحقلُ
 * بريدٍ لا يذهب إلى مكان أسوأ من غيابه: يجمع عنواناً ثم يهمله.
 * وقناة هذا المتجر واتساب أصلاً — فالزرّ يفتحها فعلاً.
 */
function Reach() {
  const { store } = usePro();
  if (!store.whatsapp) return null;

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="relative overflow-hidden rounded-2xl bg-shop px-6 py-14 text-center">
        <div aria-hidden className="absolute inset-0 opacity-25
                        [background:radial-gradient(50%_100%_at_50%_0%,#fff5,transparent)]" />

        <div className="relative">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-full
                           bg-on-shop/15 text-on-shop">
            <MessageCircle className="size-5" />
          </span>

          <h2 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] font-bold text-on-shop">
            اسأل قبل أن تشتري
          </h2>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-sm text-on-shop/80">
            راسلنا على واتساب لتأكيد التوفّر أو المقاس أو موعد التوصيل — نردّ
            {store.hours ? ` خلال ساعات العمل (${store.hours})` : ' في أسرع وقت'}.
          </p>

          <a
            href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
              `مرحباً ${store.name}، عندي سؤال عن أحد المنتجات.`,
            )}`}
            target="_blank" rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-pill bg-cream px-8 py-3.5
                       text-sm font-bold text-shop-text transition-transform active:scale-95"
          >
            <MessageCircle className="size-4" />
            تواصل معنا
          </a>
        </div>
      </div>
    </section>
  );
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      {children}
    </section>
  );
}
