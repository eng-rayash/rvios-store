'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { Search, ShoppingBag, BadgeCheck, MapPin, Clock, X } from 'lucide-react';
import type { CategoryView, ProductView, StoreView, ZoneView } from '@/lib/store';
import { ar, cn, initial } from '@/lib/utils';
import { ProductCard } from './product-card';
import { CartDrawer } from './cart-drawer';
import { ProductSheet } from './product-sheet';
import { useCart } from './use-cart';
import { CurrencyProvider, useCurrency } from './currency';

/**
 * واجهة المتجر.
 *
 * درجة التصميم (`tier`) ليست لوناً مختلفاً بل **بنية مختلفة**:
 *   نقي    — مسطّح صريح، بلا تدرّجات، فراغ سخيّ
 *   دافئ   — هيرو متدرّج، شريط ثقة، بطاقات ترتفع، قصة المتجر
 *   فاخر   — أرضية داكنة، وهج محيط، هيدر زجاجي، عنوان متدرّج
 *
 * ولو كانت الدرجات ألواناً فقط لما استحقّت الترقية — وهذا ما
 * تبيعه الباقة فعلاً.
 */
export function Storefront({
  store, products, categories, zones, tier,
}: {
  store: StoreView;
  products: ProductView[];
  categories: CategoryView[];
  zones: ZoneView[];
  tier: 'clean' | 'warm' | 'signature';
}) {
  const cart = useCart(store.slug);
  const reduced = useReducedMotion();
  const [cat, setCat] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<ProductView | null>(null);
  const [flash, setFlash] = useState<number | null>(null);

  const dark = tier === 'signature';

  const shown = useMemo(() => {
    const needle = q.trim();
    return products.filter((p) => {
      if (cat !== null && p.categoryId !== cat) return false;
      if (!needle) return true;
      return (p.name + ' ' + p.summary + ' ' + p.variant).includes(needle);
    });
  }, [products, cat, q]);

  const quickAdd = (p: ProductView) => {
    cart.add({
      id: p.id, variantId: 0, name: p.name, variant: p.variant,
      price: p.price, image: p.image, max: p.qty,
    });
    setFlash(p.id);
    setTimeout(() => setFlash(null), 1100);
  };

  return (
    <CurrencyProvider value={store.currency}>
    <div className="min-h-dvh bg-cream text-ink" data-tier={tier}>
      {/* وهج محيط — «فاخر» وحدها */}
      {dark && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-1/4 -end-1/4 size-[46rem] rounded-full bg-shop/25 blur-[130px]" />
          <div className="absolute -bottom-1/3 -start-1/4 size-[38rem] rounded-full bg-shop-lift/20 blur-[130px]" />
        </div>
      )}

      {/* ── الهيدر ── */}
      <header className={cn(
        'sticky top-0 z-30 border-b',
        dark
          ? 'border-white/10 bg-cream/70 backdrop-blur-xl'
          : 'border-line bg-cream/92 backdrop-blur-md',
      )}>
        <div className="mx-auto flex w-[min(1220px,100%-2rem)] items-center gap-4 py-3.5">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl
                           bg-shop text-lg font-extrabold text-on-shop">
            {store.logo
              ? <Image src={store.logo} alt="" width={44} height={44} className="size-full object-cover" />
              : initial(store.name)}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate font-display
                           text-xl font-bold leading-none">
              {store.name}
              {store.verified && <BadgeCheck className="size-4 shrink-0 text-shop" />}
            </h1>
            {store.tagline && (
              <p className="mt-0.5 truncate text-[11px] text-soft">{store.tagline}</p>
            )}
          </div>

          <button
            type="button" onClick={() => setCartOpen(true)}
            aria-label={`السلة — ${cart.count} قطعة`}
            className="relative grid size-11 shrink-0 place-items-center rounded-full
                       border border-line transition-colors hover:border-shop"
          >
            <ShoppingBag className="size-[18px]" />
            {cart.count > 0 && (
              <motion.i
                key={cart.count}
                initial={reduced ? false : { scale: 0.5 }} animate={{ scale: 1 }}
                className="absolute -top-1 -end-1 grid size-5 place-items-center rounded-full
                           bg-shop text-[10px] font-extrabold not-italic text-on-shop"
              >
                {ar(cart.count)}
              </motion.i>
            )}
          </button>
        </div>
      </header>

      {/* ── الهيرو ── */}
      <section className={cn('relative overflow-hidden', dark && 'border-b border-white/10')}>
        {store.showcase || store.banner ? (
          <div className="relative">
            <Image
              src={store.showcase || store.banner}
              alt="" width={1600} height={640} priority
              className="h-[clamp(15rem,34vw,24rem)] w-full object-cover"
            />
            <div className={cn(
              'absolute inset-0',
              tier === 'clean'
                ? 'bg-ink/35'
                : 'bg-gradient-to-t from-shop-deep/85 via-shop/35 to-transparent',
            )} />
            <div className="absolute inset-x-0 bottom-0">
              <div className="mx-auto w-[min(1220px,100%-2rem)] pb-8">
                <HeroCopy store={store} tier={tier} onLight />
              </div>
            </div>
          </div>
        ) : (
          <div className={cn(
            'py-14',
            tier === 'warm' && 'bg-gradient-to-bl from-shop to-shop-deep',
            tier === 'clean' && 'bg-shop',
            dark && 'bg-transparent',
          )}>
            <div className="mx-auto w-[min(1220px,100%-2rem)]">
              <HeroCopy store={store} tier={tier} onLight={!dark} />
            </div>
          </div>
        )}
      </section>

      {/* ── شريط الثقة — «دافئ» و«فاخر» ── */}
      {tier !== 'clean' && (
        <div className={cn('border-b', dark ? 'border-white/10' : 'border-line bg-paper')}>
          <div className="mx-auto flex w-[min(1220px,100%-2rem)] flex-wrap items-center
                          justify-center gap-x-8 gap-y-2 py-3.5 text-[11px] font-bold text-soft">
            <span>طلبك يصل عبر واتساب</span>
            <Dot /><span>الدفع عند الاستلام</span>
            <Dot /><span>{store.deliveryFee ? `التوصيل ${ar(store.deliveryFee)} ${store.currency}` : 'توصيل مجاني'}</span>
            {store.city && <><Dot /><span>{store.city}</span></>}
          </div>
        </div>
      )}

      {/* ── الترشيح ── */}
      <div className="sticky top-[68px] z-20 border-b border-line bg-cream/92 backdrop-blur-md">
        <div className="mx-auto flex w-[min(1220px,100%-2rem)] items-center gap-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip on={cat === null} onClick={() => setCat(null)}>الكل</Chip>
            {categories.map((c) => (
              <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name} <span className="opacity-60">{ar(c.count)}</span>
              </Chip>
            ))}
          </div>

          <label className="relative shrink-0">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4
                               -translate-y-1/2 text-soft" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث…" aria-label="ابحث في المنتجات"
              className="w-[9.5rem] rounded-full border border-line bg-paper py-2.5 ps-9 pe-3
                         text-xs outline-none transition-[width,border-color] focus:w-[13rem] focus:border-shop"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="مسح البحث"
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-soft">
                <X className="size-3.5" />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* ── الشبكة ── */}
      <main className="mx-auto w-[min(1220px,100%-2rem)] py-10">
        {shown.length === 0 ? (
          <div className="grid place-items-center gap-3 py-24 text-center">
            <Search className="size-10 text-line" strokeWidth={1.2} />
            <p className="text-sm text-soft">
              {q ? `لا نتائج لـ «${q}»` : 'لا منتجات في هذا التصنيف بعد'}
            </p>
            {(q || cat !== null) && (
              <button type="button" onClick={() => { setQ(''); setCat(null); }}
                      className="text-xs font-bold text-shop-text underline underline-offset-4">
                اعرض كل المنتجات
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-5 text-xs text-soft">
              {ar(shown.length)} من {ar(products.length)} منتج
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((p, i) => (
                <ProductCard
                  key={p.id} product={p} index={i}
                  onOpen={setSheet} onAdd={quickAdd} added={flash === p.id}
                  lift={tier !== 'clean'}
                />
              ))}
            </div>
          </>
        )}

        {/* قصة المتجر — «دافئ» و«فاخر» */}
        {tier !== 'clean' && store.about && (
          <section className={cn(
            'mt-16 rounded-3xl border p-8 md:p-12',
            dark ? 'border-white/10 bg-white/[.04]' : 'border-line bg-paper',
          )}>
            <h2 className="mb-3 font-display text-3xl font-bold">
              عن {store.name}
            </h2>
            <p className="max-w-[65ch] text-sm leading-[2] text-soft">{store.about}</p>
            <div className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-xs text-soft">
              {store.address && <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{store.address}</span>}
              {store.hours && <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{store.hours}</span>}
            </div>
          </section>
        )}
      </main>

      <footer className={cn('border-t py-8', dark ? 'border-white/10' : 'border-line')}>
        <div className="mx-auto flex w-[min(1220px,100%-2rem)] flex-wrap items-center
                        justify-between gap-3 text-[11px] text-soft">
          <span>{store.name}</span>
          <span>
            متجر على <a href="/" className="font-bold text-shop-text">RVIOS Store</a>
          </span>
        </div>
      </footer>

      {/* شريط سلة عائم على الجوال — الدرج بعيد عن الإبهام */}
      {cart.count > 0 && !cartOpen && (
        <motion.button
          type="button" onClick={() => setCartOpen(true)}
          initial={reduced ? false : { y: 80 }} animate={{ y: 0 }}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full
                     bg-shop px-6 py-4 text-on-shop shadow-lg md:hidden"
        >
          <span className="text-sm font-bold">{ar(cart.count)} في السلة</span>
          <span className="text-sm font-extrabold tabular">{ar(cart.subtotal)} {store.currency}</span>
        </motion.button>
      )}

      <CartDrawer
        store={store} zones={zones} lines={cart.lines} subtotal={cart.subtotal}
        open={cartOpen} onClose={() => setCartOpen(false)}
        onQty={cart.setQty} onRemove={cart.remove} onDone={cart.clear}
      />

      <ProductSheet
        store={store} product={sheet} onClose={() => setSheet(null)}
        onAdd={(line) => { cart.add(line); setSheet(null); }}
      />
    </div>
    </CurrencyProvider>
  );
}

function HeroCopy({ store, tier, onLight }: {
  store: StoreView; tier: string; onLight?: boolean;
}) {
  return (
    <div className={onLight ? 'text-on-shop' : ''}>
      <h2 className={cn(
        'font-display text-[clamp(2.2rem,5.5vw,3.8rem)] font-bold leading-[1.24]',
        tier === 'signature' && 'bg-gradient-to-l from-shop to-brass bg-clip-text text-transparent',
      )}>
        {store.tagline || store.name}
      </h2>
      {store.city && (
        <p className={cn('mt-2.5 flex items-center gap-1.5 text-sm', onLight ? 'opacity-85' : 'text-soft')}>
          <MapPin className="size-4" />{store.city}
        </p>
      )}
    </div>
  );
}

const Dot = () => <i aria-hidden className="size-1 rounded-full bg-line" />;

function Chip({ on, children, onClick }: {
  on: boolean; children: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition-colors',
        on
          ? 'border-shop bg-shop text-on-shop'
          : 'border-line bg-paper hover:border-shop',
      )}
    >
      {children}
    </button>
  );
}
