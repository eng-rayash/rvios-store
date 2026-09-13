'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Truck, Wallet, MessageCircle, BadgeCheck, ShieldCheck } from 'lucide-react';
import type { CategoryView, ProductView } from '@/lib/store';
import { ar, cn } from '@/lib/utils';
import { discountOf } from '../pro/pro-card';
import { useAtelier } from './context';
import { SectionHead } from './atelier-shell';
import { AtelierCard } from './atelier-card';

/**
 * واجهة قالب «أتولييه» — الصفحة الأولى.
 *
 * لا شرائح تتبدّل في الواجهة: هيرو يتحرّك كل ستّ ثوانٍ يقاطع
 * القراءة، وحملة الأزياء المصوّرة تُقنع بثباتها لا بدورانها.
 * وصورة واحدة كبيرة أصدق من ثلاث شرائح ثانيتها مُلفَّقة من
 * «أقوى خصم» وثالثتها من «أغلى قطعة».
 *
 * وكل قسم أدناه مشدود إلى بيانات المتجر: الأقسام تأخذ صورها من
 * أوّل قطعة فيها، و«وصل حديثاً» تعني أحدث ما أضافه التاجر،
 * و«قطع مخفّضة» لا تظهر إلا حيث سُجِّل سعرٌ سابق فعلاً.
 */
export function AtelierHome({ products }: { products: ProductView[] }) {
  const { store, categories } = useAtelier();

  const deals = useMemo(
    () => products.filter((p) => discountOf(p) > 0 && p.stock !== 'none')
      .sort((a, b) => discountOf(b) - discountOf(a)),
    [products],
  );

  const shopHref = `/${store.slug}/shop`;

  return (
    <main>
      <Hero products={products} />

      {categories.length > 0 && (
        <Section id="collections">
          <SectionHead title="المجموعات" href={shopHref} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categories.slice(0, 4).map((c, i) => (
              <CollectionCard key={c.id} cat={c} products={products} index={i} />
            ))}
          </div>
        </Section>
      )}

      {products.length > 0 && (
        <Section id="new">
          <SectionHead
            title="وصل حديثاً" href={shopHref}
            note="أحدث ما دخل الرفّ — بترتيب إضافته"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {products.slice(0, 8).map((p, i) => (
              <AtelierCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </Section>
      )}

      <Editorial products={products} />

      {deals.length > 0 && (
        <Section id="deals">
          <SectionHead
            title="قطع مخفّضة" href={`${shopHref}?deals=1`}
            note="السعر السابق مسجَّل، والخصم محسوب منه"
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {deals.slice(0, 4).map((p, i) => (
              <AtelierCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </Section>
      )}

      <Care />
      <Reach />
    </main>
  );
}

/* ── الهيرو ─────────────────────────────────────────────── */

/**
 * صورة واحدة بملء الشاشة، واسم البيت فوقها، وسطر واحد.
 *
 * تُقرأ الحملة أولاً ثم يُقرأ الاسم — وهذا ترتيب متجر الأزياء.
 * وإن لم يرفع التاجر صورة واجهة ولا غلافاً، تسقط إلى أول قطعة
 * في الكتالوج: صفحة أزياء بلا صورة ليست صفحة أزياء.
 */
function Hero({ products }: { products: ProductView[] }) {
  const { store } = useAtelier();
  const reduced = useReducedMotion();
  const shot = store.showcase || store.banner || products[0]?.image || '';

  return (
    <section className="relative isolate">
      {shot ? (
        <Image
          src={shot} alt={store.name} width={2000} height={1200} priority
          className="h-[min(78dvh,44rem)] w-full object-cover"
        />
      ) : (
        <div className="h-[min(60dvh,32rem)] w-full bg-sand" />
      )}

      {/* تعتيم متدرّج من الأسفل — النصّ يُقرأ فوق أي صورة */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 mx-auto w-[min(1280px,100%-2rem)] pb-12 text-cream"
      >
        <h1 className="font-display text-[clamp(2.2rem,6vw,4.2rem)] font-bold leading-[1.05]">
          {store.name}
        </h1>
        {store.tagline && (
          <p className="mt-3 max-w-[46ch] text-md text-cream/85">{store.tagline}</p>
        )}
        <Link
          href={`/${store.slug}/shop`}
          className="mt-7 inline-block border border-cream px-9 py-3.5 text-xs font-bold
                     tracking-[.18em] text-cream transition-colors hover:bg-cream hover:text-ink"
        >
          تسوّقي المجموعة
        </Link>
      </motion.div>
    </section>
  );
}

/* ── المجموعات ──────────────────────────────────────────── */

/** صورة القسم من أوّل قطعة فيه — لا صورة قسمٍ منفصلة في القاعدة */
function CollectionCard({ cat, products, index }: {
  cat: CategoryView; products: ProductView[]; index: number;
}) {
  const { store } = useAtelier();
  const reduced = useReducedMotion();
  const shot = products.find((p) => p.categoryId === cat.id)?.image ?? '';

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px' }}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <Link href={`/${store.slug}/shop?cat=${cat.id}`} className="group block">
        <div className="relative overflow-hidden bg-sand">
          {shot ? (
            <Image
              src={shot} alt={cat.name} width={640} height={854}
              className="aspect-[3/4] w-full object-cover transition-transform duration-700
                         group-hover:scale-[1.04]"
            />
          ) : (
            <div className="aspect-[3/4] w-full" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/65 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-cream">
            <span className="block font-display text-lg font-bold leading-tight">{cat.name}</span>
            <span className="tabular mt-0.5 block text-2xs text-cream/75">{ar(cat.count)} قطعة</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── الشريط التحريري ────────────────────────────────────── */

/**
 * حكاية البيت بصورتين — تحلّ محلّ الشريط الترويجي الملوّن في
 * القالب الآخر. النصّ من `about` وحده، فإن لم يكتبه التاجر لا
 * يُخترع له نصّ ولا يُعرض قسم فارغ.
 */
function Editorial({ products }: { products: ProductView[] }) {
  const { store } = useAtelier();
  const reduced = useReducedMotion();
  if (!store.about) return null;

  const shots = [store.banner, ...products.map((p) => p.image)]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -60px' }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <span className="text-2xs font-extrabold tracking-[.22em] text-soft">عن البيت</span>
          <p className="mt-5 max-w-[46ch] font-display text-[clamp(1.15rem,2.2vw,1.6rem)]
                        leading-[1.85] text-ink">
            {store.about}
          </p>
          {store.city && (
            <p className="mt-6 text-xs text-soft">{store.city}{store.address ? ` — ${store.address}` : ''}</p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {shots.map((src, i) => (
            <Image
              key={src} src={src} alt="" width={640} height={854} aria-hidden
              className={cn(
                'w-full object-cover',
                i === 0 ? 'aspect-[3/4]' : 'aspect-[3/4] mt-10',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── العناية والخدمة ────────────────────────────────────── */

/**
 * ما يقلق مشتري العباءة فعلاً: متى تصل، وكيف تُدفع، ومن يردّ
 * حين يُسأل عن المقاس. كل بند مقروء من إعدادات التاجر — ولا
 * وعد يكتبه القالب نيابةً عنه.
 */
function Care() {
  const { store } = useAtelier();
  const cur = store.currency;

  const rows = [
    {
      icon: Truck, title: 'الشحن',
      note: store.deliveryFreeOver
        ? `مجاني فوق ${ar(store.deliveryFreeOver)} ${cur}`
        : store.deliveryFee ? `${ar(store.deliveryFee)} ${cur} للطلب` : 'شحن مجاني',
    },
    store.payMethods.includes('cod') && {
      icon: Wallet, title: 'الدفع',
      note: 'عند الاستلام — تدفعين حين تستلمين',
    },
    store.whatsapp && {
      icon: MessageCircle, title: 'استشارة المقاس',
      note: store.hours || 'نردّ عليك مباشرة',
    },
    store.verified
      ? { icon: BadgeCheck, title: 'متجر موثّق', note: 'وثّقته منصة RVIOS Store' }
      : { icon: ShieldCheck, title: 'خياطة البيت', note: 'قطعٌ مختارة قبل عرضها' },
  ].filter(Boolean) as { icon: typeof Truck; title: string; note: string }[];

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="grid divide-y divide-line border-y border-line
                      sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.title} className="flex items-start gap-3 py-6 sm:px-6">
            <r.icon className="mt-0.5 size-4 shrink-0 text-shop-text" />
            <span>
              <span className="block text-2xs font-extrabold tracking-[.18em]">{r.title}</span>
              <span className="mt-1.5 block text-xs text-soft">{r.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── التواصل ────────────────────────────────────────────── */

/**
 * لا حقل بريد هنا أيضاً: القاعدة لا تحفظ مشتركين، وحقلٌ يجمع
 * عنواناً ثم يهمله أسوأ من غيابه. وقناة المتجر واتساب — فالزرّ
 * يفتحها فعلاً.
 */
function Reach() {
  const { store } = useAtelier();
  if (!store.whatsapp) return null;

  return (
    <section className="mx-auto w-[min(1280px,100%-2rem)] pt-[var(--bay)]">
      <div className="border border-line px-6 py-14 text-center">
        <span className="text-2xs font-extrabold tracking-[.22em] text-soft">قبل الطلب</span>
        <h2 className="mt-4 font-display text-[clamp(1.5rem,3vw,2.1rem)] font-bold">
          محتارة في المقاس؟
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-sm text-soft">
          راسلينا على واتساب بطولك ومقاسك المعتاد، ونرشّح لك المقاس المناسب
          {store.hours ? ` — خلال ساعات العمل (${store.hours})` : ''}.
        </p>
        <a
          href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
            `مرحباً ${store.name}، أحتاج مساعدة في اختيار المقاس.`,
          )}`}
          target="_blank" rel="noreferrer"
          className="mt-8 inline-flex items-center gap-2 bg-ink px-9 py-3.5 text-xs font-bold
                     tracking-[.18em] text-cream transition-opacity hover:opacity-90"
        >
          <MessageCircle className="size-4" />
          اسألينا على واتساب
        </a>
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
