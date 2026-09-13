'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search, ShoppingBag, Heart, User, BadgeCheck, ChevronDown,
  MapPin, Clock, Phone, Mail, MessageCircle,
} from 'lucide-react';
import type { BrandView, CategoryView, ProductView, StoreView, ZoneView } from '@/lib/store';
import { ar, cn, initial, items, plural } from '@/lib/utils';
import { CurrencyProvider } from '../currency';
import { CartDrawer } from '../cart-drawer';
import { ProductSheet } from '../product-sheet';
import { useCart } from '../use-cart';
import { useWishlist } from '../use-wishlist';
import { ProProvider } from './context';

/**
 * هيكل واجهة «برو».
 *
 * ما يفصل هذه الدرجة عن «دافئ» ليس اللون بل **البنية**: متجر
 * برو له صفحتان لا واحدة (واجهة تُقنع وصفحة تُتصفَّح)، وشريط
 * تنقّل ثابت، وبحث في الهيدر يقود إلى صفحة نتائج قابلة
 * للمشاركة برابطها. وهذا ما تشتريه الباقة فعلاً.
 *
 * الهيدر والتذييل والسلة وورقة المنتج تعيش هنا مرة واحدة،
 * فالانتقال بين الصفحتين لا يعيد بناءها ولا يُفقد السلة.
 */
export function ProShell({
  store, categories, brands, zones, active, children,
}: {
  store: StoreView;
  categories: CategoryView[];
  brands: BrandView[];
  zones: ZoneView[];
  active: 'home' | 'shop';
  children: React.ReactNode;
}) {
  const cart = useCart(store.slug);
  const wish = useWishlist(store.slug);
  const reduced = useReducedMotion();

  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<ProductView | null>(null);
  const [flashed, setFlashed] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');

  const shopHref = `/${store.slug}/shop`;

  const ctx = useMemo(() => ({
    store, categories, brands, flashed,
    open: (p: ProductView) => setSheet(p),
    add: (p: ProductView) => {
      if (p.hasVariants) { setSheet(p); return; }
      cart.add({
        id: p.id, variantId: 0, name: p.name, variant: p.variant,
        price: p.price, image: p.image, max: p.qty,
      });
      setFlashed(p.id);
      setTimeout(() => setFlashed(null), 1100);
    },
    wished: wish.has,
    wish: wish.toggle,
  }), [store, categories, brands, flashed, cart, wish.has, wish.toggle]);

  return (
    <CurrencyProvider value={store.currency}>
      <ProProvider value={ctx}>
        <div className="min-h-dvh bg-cream text-ink" data-tier="signature">
          {/*
            وهج محيط خافت — يميّز «فاخر» بلا أن يشوّش القراءة.

            تدرّجان شعاعيان لا دائرتان بمرشّح `blur`: المرشّح على
            عنصر بحجم ٤٤rem يجبر المتصفّح على إعادة تركيب طبقة
            بهذا الحجم مع كل إطار تمرير، والصفحة تتلعثم على الأجهزة
            المتوسّطة. والتدرّج يعطي المظهر نفسه بكلفة صفر.
          */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              backgroundImage:
                'radial-gradient(46rem 34rem at 88% -8%, rgba(var(--shop-rgb),.10), transparent 70%),'
                + 'radial-gradient(40rem 30rem at 4% 104%, color-mix(in oklab, var(--color-brass) 22%, transparent), transparent 70%)',
            }}
          />

          {/* ═══ الهيدر ═══ */}
          <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-xl">
            <div className="mx-auto flex w-[min(1280px,100%-2rem)] items-center gap-4 py-3.5">
              {/* الأدوات — أقصى البداية في RTL كما في تصميم المرجع */}
              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton
                  label={`السلة — ${ar(cart.count)} ${plural(cart.count, ['قطعة', 'قطعتان', 'قطع', 'قطعة'])}`}
                  onClick={() => setCartOpen(true)}
                  badge={cart.count}
                >
                  <ShoppingBag className="size-[18px]" />
                </IconButton>

                <IconButton
                  label={`المفضّلة — ${items(wish.count)}`}
                  href={`${shopHref}?wish=1`}
                  badge={wish.count}
                >
                  <Heart className="size-[18px]" />
                </IconButton>

                <IconButton label="حسابي" href="/login">
                  <User className="size-[18px]" />
                </IconButton>
              </div>

              {/* البحث — يقود إلى صفحة نتائج برابط قابل للمشاركة */}
              <form
                action={shopHref}
                className="relative mx-auto hidden w-full max-w-[30rem] md:block"
              >
                <Search className="pointer-events-none absolute start-4 top-1/2 size-4
                                   -translate-y-1/2 text-soft" />
                <input
                  name="q" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث عن منتجات…" aria-label="ابحث في المتجر"
                  className="w-full rounded-pill border border-line bg-paper py-3 ps-11 pe-4
                             text-xs outline-none transition-colors
                             placeholder:text-soft/70 focus:border-shop focus:bg-cream"
                />
              </form>

              {/* الهوية — أقصى النهاية */}
              <Link href={`/${store.slug}`} className="ms-auto flex shrink-0 items-center gap-2.5">
                <span className="text-end leading-none">
                  <span className="flex items-center justify-end gap-1.5 font-display text-xl font-bold">
                    {store.name.replace(/^متجر\s+/, '')}
                    {store.verified && <BadgeCheck className="size-4 text-shop" />}
                  </span>
                  <span className="mt-1 block text-[9px] font-bold tracking-[.34em] text-soft">
                    STORE
                  </span>
                </span>
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden
                                 rounded-xl bg-shop-veil text-lg font-extrabold text-shop-text">
                  {store.logo
                    ? <Image src={store.logo} alt="" width={88} height={88}
                             className="size-full object-contain p-1" priority />
                    : initial(store.name)}
                </span>
              </Link>
            </div>

            {/* ═══ شريط التنقّل ═══ */}
            <nav className="border-t border-line/70">
              <div className="mx-auto flex w-[min(1280px,100%-2rem)] items-center
                              justify-center gap-1 overflow-x-auto
                              [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <NavLink href={`/${store.slug}`} on={active === 'home'}>الرئيسية</NavLink>
                <NavLink href={shopHref} on={active === 'shop'}>المتجر</NavLink>

                {categories.length > 0 && (
                  <div
                    className="relative"
                    onMouseEnter={() => setMenu(true)}
                    onMouseLeave={() => setMenu(false)}
                  >
                    <button
                      type="button" onClick={() => setMenu((v) => !v)}
                      aria-expanded={menu}
                      className="flex items-center gap-1 whitespace-nowrap px-4 py-3.5
                                 text-xs font-bold text-soft transition-colors hover:text-ink"
                    >
                      التصنيفات
                      <ChevronDown className={cn('size-3.5 transition-transform', menu && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {menu && (
                        <motion.div
                          initial={reduced ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? undefined : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className="absolute start-1/2 top-full z-50 w-[19rem] -translate-x-1/2
                                     rounded-xl border border-line bg-cream p-2 shadow-lift"
                        >
                          {categories.map((c) => (
                            <Link
                              key={c.id} href={`${shopHref}?cat=${c.id}`}
                              onClick={() => setMenu(false)}
                              className="flex items-center justify-between rounded-lg px-3 py-2.5
                                         text-xs font-bold transition-colors hover:bg-shop-veil
                                         hover:text-shop-text"
                            >
                              {c.name}
                              <span className="text-[11px] font-normal text-soft">
                                {items(c.count)}
                              </span>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <NavLink href={`${shopHref}?deals=1`}>العروض</NavLink>
                <NavLink href="/track">تتبع الطلب</NavLink>
              </div>
            </nav>
          </header>

          {children}

          {/* ═══ التذييل ═══ */}
          <footer className="mt-[var(--bay)] bg-ink text-cream/75">
            <div className="mx-auto grid w-[min(1280px,100%-2rem)] gap-10 py-14
                            sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="mb-4 font-display text-lg font-bold text-cream">
                  عن {store.name.replace(/^متجر\s+/, '')}
                </h3>
                <p className="max-w-[34ch] text-xs leading-[2]">
                  {store.about || store.tagline}
                </p>
                {/* قناة واحدة لأن القاعدة تحفظ واحدة. صفٌّ من
                    أيقونات تويتر وإنستغرام يقود كلّها إلى الرقم
                    نفسه يوهم بحضورٍ لا وجود له. */}
                {store.whatsapp && (
                  <a
                    href={`https://wa.me/${store.whatsapp}`}
                    target="_blank" rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-pill border
                               border-cream/20 px-4 py-2.5 text-xs font-bold text-cream
                               transition-colors hover:border-shop-lift hover:bg-cream/5"
                  >
                    <MessageCircle className="size-4" />
                    راسلنا على واتساب
                  </a>
                )}
              </div>

              <div>
                <h3 className="mb-4 font-display text-lg font-bold text-cream">خدمة العملاء</h3>
                <ul className="space-y-3 text-xs">
                  {store.whatsapp && (
                    <li className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-shop-lift" />
                      <a href={`https://wa.me/${store.whatsapp}`} dir="ltr" className="hover:text-cream">
                        +{store.whatsapp}
                      </a>
                    </li>
                  )}
                  {store.hours && (
                    <li className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0 text-shop-lift" />{store.hours}
                    </li>
                  )}
                  {store.address && (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-shop-lift" />{store.address}
                    </li>
                  )}
                  {store.payNote && (
                    <li className="flex items-start gap-2">
                      <Mail className="mt-0.5 size-3.5 shrink-0 text-shop-lift" />{store.payNote}
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-display text-lg font-bold text-cream">روابط سريعة</h3>
                <ul className="space-y-3 text-xs">
                  <li><Link href={shopHref} className="hover:text-cream">كل المنتجات</Link></li>
                  <li><Link href={`${shopHref}?deals=1`} className="hover:text-cream">العروض</Link></li>
                  <li><Link href="/track" className="hover:text-cream">تتبع الطلب</Link></li>
                  {categories.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link href={`${shopHref}?cat=${c.id}`} className="hover:text-cream">{c.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-display text-lg font-bold text-cream">الشحن والدفع</h3>
                <ul className="space-y-3 text-xs">
                  {store.deliveryNote && <li>{store.deliveryNote}</li>}
                  {zones.length > 0 && (
                    <li>
                      مناطق التوصيل:{' '}
                      {zones.map((z) => z.name).join(' · ')}
                    </li>
                  )}
                  <li className="flex flex-wrap gap-2 pt-1">
                    {PAY_LABELS.filter(([id]) => store.payMethods.includes(id)).map(([id, label]) => (
                      <span key={id} className="rounded-md border border-cream/15 px-2.5 py-1
                                                text-[11px] font-bold text-cream/85">
                        {label}
                      </span>
                    ))}
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-cream/10">
              <div className="mx-auto flex w-[min(1280px,100%-2rem)] flex-wrap items-center
                              justify-between gap-3 py-5 text-[11px]">
                <span>جميع الحقوق محفوظة © {store.name}</span>
                <span>
                  متجر على{' '}
                  <a href="/" className="font-bold text-shop-lift hover:underline">RVIOS Store</a>
                </span>
              </div>
            </div>
          </footer>

          {/* شريط سلة عائم على الجوال — الدرج بعيد عن الإبهام */}
          <AnimatePresence>
            {cart.count > 0 && !cartOpen && (
              <motion.button
                type="button" onClick={() => setCartOpen(true)}
                initial={reduced ? false : { y: 90 }} animate={{ y: 0 }}
                exit={reduced ? undefined : { y: 90 }}
                className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between
                           rounded-pill bg-shop px-6 py-4 text-on-shop shadow-lift md:hidden"
              >
                <span className="text-sm font-bold">{ar(cart.count)} في السلة</span>
                <span className="tabular text-sm font-extrabold">
                  {ar(cart.subtotal)} {store.currency}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

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
      </ProProvider>
    </CurrencyProvider>
  );
}

const PAY_LABELS: [string, string][] = [
  ['cod', 'الدفع عند الاستلام'],
  ['wallet', 'محفظة إلكترونية'],
  ['bank', 'تحويل بنكي'],
];

function NavLink({ href, on, children }: {
  href: string; on?: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'relative whitespace-nowrap px-4 py-3.5 text-xs font-bold transition-colors',
        on ? 'text-shop-text' : 'text-soft hover:text-ink',
      )}
    >
      {children}
      {on && <i className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-shop" />}
    </Link>
  );
}

function IconButton({ children, label, badge, onClick, href }: {
  children: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `relative grid size-10 place-items-center rounded-full border border-line
               bg-paper transition-colors hover:border-shop hover:text-shop-text`;

  const dot = badge && badge > 0 ? (
    <i className="absolute -top-1 -end-1 grid size-[1.15rem] place-items-center rounded-full
                  bg-shop text-[10px] font-extrabold not-italic text-on-shop">
      {ar(badge)}
    </i>
  ) : null;

  if (href) {
    return <Link href={href} aria-label={label} className={cls}>{children}{dot}</Link>;
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}{dot}
    </button>
  );
}

/** يُستخدم في الصفحتين — عنوان قسم مع رابط «عرض الكل» */
export function SectionHead({ title, href, label = 'عرض الكل' }: {
  title: string; href?: string; label?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold leading-none">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1.5 text-xs font-bold text-shop-text"
        >
          {label}
          <span aria-hidden className="transition-transform group-hover:-translate-x-1">←</span>
        </Link>
      )}
    </div>
  );
}
