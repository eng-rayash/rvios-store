'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search, ShoppingBag, Heart, User, X, ChevronDown,
  MapPin, Clock, Phone, MessageCircle,
} from 'lucide-react';
import type { BrandView, CategoryView, ProductView, StoreView, ZoneView } from '@/lib/store';
import { ar, cn, initial, items, plural } from '@/lib/utils';
import { CurrencyProvider } from '../currency';
import { CartDrawer } from '../cart-drawer';
import { ProductSheet } from '../product-sheet';
import { useCart } from '../use-cart';
import { useWishlist } from '../use-wishlist';
import { AtelierProvider } from './context';

/**
 * هيكل قالب «أتولييه».
 *
 * القالب الآخر في الباقة نفسها، لا درجة أعلى منه: البنية هي
 * البنية (صفحة أولى وصفحة تسوّق وسلة واحدة)، والمختلف سجلّ
 * العرض. متجر الأزياء يبيع بالصورة، فكل ما يزاحمها يُخفَّض:
 *
 *   · لا وهج محيط ولا زجاجية — البياض هو الفخامة هنا.
 *   · الشعار في الوسط والأدوات على الطرفين، كما في بيوت الأزياء.
 *   · البحث أيقونة تتوسّع، ويبقى نموذجاً حقيقياً يقود إلى صفحة
 *     نتائج برابط قابل للمشاركة — الاختصار في الشكل لا في العقد.
 *   · التصنيفات **على الشريط** لا خلف منسدلة: أربعة أقسام تُخفى
 *     خلف زرّ هي أربعة أقسام لا يراها أحد. والمنسدلة تعود حين
 *     تكثر (فوق ستّة).
 *
 * والتذييل بقي بهيكل «التوقيع» نفسه لأنه صادق أصلاً — لا يطبع
 * إلا ما ملأه التاجر — وغُيّر لونه فقط ليكمل السجلّ الورقي.
 */
export function AtelierShell({
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
  const [preset, setPreset] = useState<{ v1?: string; v2?: string; cover?: string }>({});
  const [flashed, setFlashed] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);

  const shopHref = `/${store.slug}/shop`;
  const crowded = categories.length > 6;

  const ctx = useMemo(() => ({
    store, categories, brands, flashed,
    open: (p: ProductView, pre?: { v1?: string; v2?: string; cover?: string }) => {
      setPreset(pre ?? {});
      setSheet(p);
    },
    add: (p: ProductView) => {
      // قطعةٌ بمقاسات لا تُضاف بتخمين مقاس
      if (p.hasVariants) { setPreset({}); setSheet(p); return; }
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
      <AtelierProvider value={ctx}>
        <div className="min-h-dvh bg-cream text-ink" data-tier="signature" data-layout="atelier">
          {/* ═══ الهيدر ═══ */}
          <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur-xl">
            <div className="mx-auto grid w-[min(1280px,100%-2rem)] grid-cols-[1fr_auto_1fr]
                            items-center gap-4 py-4">
              <div className="flex items-center gap-1">
                <IconButton
                  label={`السلة — ${ar(cart.count)} ${plural(cart.count, ['قطعة', 'قطعتان', 'قطع', 'قطعة'])}`}
                  onClick={() => setCartOpen(true)} badge={cart.count}
                >
                  <ShoppingBag className="size-[18px]" />
                </IconButton>
                <IconButton label={`المفضّلة — ${items(wish.count)}`} href={`${shopHref}?wish=1`} badge={wish.count}>
                  <Heart className="size-[18px]" />
                </IconButton>
                <IconButton label="بحث" onClick={() => setSearching((v) => !v)}>
                  {searching ? <X className="size-[18px]" /> : <Search className="size-[18px]" />}
                </IconButton>
              </div>

              {/* الشعار في المنتصف — اسم البيت أولاً وآخراً */}
              <Link href={`/${store.slug}`} className="justify-self-center text-center">
                {store.logo ? (
                  <Image
                    src={store.logo} alt={store.name} width={200} height={64}
                    className="h-11 w-auto object-contain"
                  />
                ) : (
                  <span className="font-display text-2xl font-bold tracking-wide">
                    {store.name}
                  </span>
                )}
              </Link>

              <div className="flex items-center justify-end gap-1">
                <IconButton label="حسابي" href="/login">
                  <User className="size-[18px]" />
                </IconButton>
              </div>
            </div>

            {/* البحث المتوسّع — نموذج حقيقي لا مرشّح في الذاكرة */}
            <AnimatePresence initial={false}>
              {searching && (
                <motion.form
                  action={shopHref}
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-line"
                >
                  <div className="mx-auto flex w-[min(1280px,100%-2rem)] items-center gap-3 py-4">
                    <Search className="size-4 shrink-0 text-soft" />
                    <input
                      name="q" autoFocus placeholder="ابحثي عن قطعة…"
                      className="w-full bg-transparent py-1 text-md outline-none placeholder:text-soft/70"
                    />
                    <button type="submit" className="shrink-0 text-xs font-bold text-shop-text hover:underline">
                      بحث
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* ═══ شريط الأقسام ═══ */}
            <nav className="border-t border-line">
              <div className="mx-auto flex w-[min(1280px,100%-2rem)] flex-wrap items-center
                              justify-center gap-x-7 gap-y-2 py-3 text-xs">
                <NavLink href={`/${store.slug}`} on={active === 'home'}>الواجهة</NavLink>

                {!crowded && categories.map((c) => (
                  <NavLink key={c.id} href={`${shopHref}?cat=${c.id}`}>{c.name}</NavLink>
                ))}

                {crowded && (
                  <div className="relative" onMouseLeave={() => setMenu(false)}>
                    <button
                      type="button" onClick={() => setMenu((v) => !v)}
                      onMouseEnter={() => setMenu(true)}
                      className="flex items-center gap-1 font-bold tracking-wide text-soft hover:text-ink"
                    >
                      الأقسام <ChevronDown className="size-3.5" />
                    </button>
                    <AnimatePresence>
                      {menu && (
                        <motion.div
                          initial={reduced ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="absolute start-1/2 top-full z-20 mt-3 w-56 -translate-x-1/2
                                     border border-line bg-cream p-2 shadow-lift"
                        >
                          {categories.map((c) => (
                            <Link
                              key={c.id} href={`${shopHref}?cat=${c.id}`} onClick={() => setMenu(false)}
                              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-paper"
                            >
                              {c.name}
                              <span className="tabular text-2xs text-soft">{ar(c.count)}</span>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <NavLink href={shopHref} on={active === 'shop'}>كل القطع</NavLink>
                <NavLink href="/track">تتبّع الطلب</NavLink>
              </div>
            </nav>
          </header>

          {children}

          {/* ═══ التذييل ═══ */}
          <footer className="mt-[var(--bay)] border-t border-line bg-paper">
            <div className="mx-auto grid w-[min(1280px,100%-2rem)] gap-10 py-14
                            sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <SmallHead>عن {store.name.replace(/^متجر\s+/, '')}</SmallHead>
                <p className="max-w-[34ch] text-xs leading-[2] text-soft">
                  {store.about || store.tagline}
                </p>
                {store.whatsapp && (
                  <a
                    href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 border border-ink px-5 py-2.5
                               text-xs font-bold transition-colors hover:bg-ink hover:text-cream"
                  >
                    <MessageCircle className="size-4" />
                    راسلينا على واتساب
                  </a>
                )}
              </div>

              <div>
                <SmallHead>خدمة العميلات</SmallHead>
                <ul className="space-y-3 text-xs text-soft">
                  {store.whatsapp && (
                    <li className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-shop-text" />
                      <a href={`https://wa.me/${store.whatsapp}`} dir="ltr" className="hover:text-ink">
                        +{store.whatsapp}
                      </a>
                    </li>
                  )}
                  {store.hours && (
                    <li className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0 text-shop-text" />{store.hours}
                    </li>
                  )}
                  {store.address && (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-shop-text" />{store.address}
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <SmallHead>روابط</SmallHead>
                <ul className="space-y-3 text-xs text-soft">
                  <li><Link href={shopHref} className="hover:text-ink">كل القطع</Link></li>
                  <li><Link href={`${shopHref}?deals=1`} className="hover:text-ink">قطع مخفّضة</Link></li>
                  <li><Link href="/track" className="hover:text-ink">تتبّع الطلب</Link></li>
                  {categories.slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link href={`${shopHref}?cat=${c.id}`} className="hover:text-ink">{c.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <SmallHead>الشحن والدفع</SmallHead>
                <ul className="space-y-3 text-xs text-soft">
                  {store.deliveryNote && <li>{store.deliveryNote}</li>}
                  {zones.length > 0 && <li>مناطق التوصيل: {zones.map((z) => z.name).join(' · ')}</li>}
                  {store.payNote && <li>{store.payNote}</li>}
                  <li className="flex flex-wrap gap-2 pt-1">
                    {PAY_LABELS.filter(([id]) => store.payMethods.includes(id)).map(([id, label]) => (
                      <span key={id} className="border border-line px-2.5 py-1 text-[11px] font-bold text-ink/80">
                        {label}
                      </span>
                    ))}
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-line">
              <div className="mx-auto flex w-[min(1280px,100%-2rem)] flex-wrap items-center
                              justify-between gap-3 py-5 text-[11px] text-soft">
                <span>جميع الحقوق محفوظة © {store.name}</span>
                <span>
                  متجر على{' '}
                  <a href="/" className="font-bold text-shop-text hover:underline">RVIOS Store</a>
                </span>
              </div>
            </div>
          </footer>

          {/* شريط السلة العائم على الجوال — كسبٌ في الاستعمال لا زينة */}
          <AnimatePresence>
            {cart.count > 0 && !cartOpen && (
              <motion.button
                type="button" onClick={() => setCartOpen(true)}
                initial={reduced ? false : { y: 90 }} animate={{ y: 0 }}
                exit={reduced ? undefined : { y: 90 }}
                className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between
                           bg-ink px-6 py-4 text-cream shadow-lift md:hidden"
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
            store={store} product={sheet} media="portrait"
            preset={preset} cover={preset.cover}
            onClose={() => setSheet(null)}
            onAdd={(line) => { cart.add(line); setSheet(null); }}
          />
        </div>
      </AtelierProvider>
    </CurrencyProvider>
  );
}

const PAY_LABELS: [string, string][] = [
  ['cod', 'الدفع عند الاستلام'],
  ['wallet', 'محفظة إلكترونية'],
  ['bank', 'تحويل بنكي'],
];

/**
 * عنوان قسم — حرفٌ صغير متباعد فوق خطّ شعري.
 * هذه هي الطباعة التي تفصل متجر الأزياء عن المتجر العام: لا
 * عناوين ضخمة تنافس الصور، بل سطرٌ يقول أين نحن ثم يختفي.
 */
export function SectionHead({ title, href, note }: {
  title: string; href?: string; note?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
        {note && <p className="mt-1 text-xs text-soft">{note}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-2xs font-bold tracking-[.18em] text-soft hover:text-ink">
          عرض الكل
        </Link>
      )}
    </div>
  );
}

function SmallHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-2xs font-extrabold tracking-[.22em] text-ink">{children}</h3>
  );
}

function NavLink({ href, on, children }: {
  href: string; on?: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'font-bold tracking-wide transition-colors',
        on ? 'text-ink' : 'text-soft hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}

function IconButton({ label, badge, href, onClick, children }: {
  label: string;
  badge?: number;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls = 'relative grid size-10 place-items-center text-ink transition-colors hover:text-shop-text';
  const dot = badge != null && badge > 0 && (
    <span className="absolute -top-0.5 end-0 grid min-w-4 place-items-center rounded-full
                     bg-shop px-1 text-[10px] font-extrabold text-on-shop">
      {ar(badge)}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={cls}>
        {children}{dot}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}{dot}
    </button>
  );
}

/** الحرف الأول — يُستعمل حين لا شعار للمتجر */
export const monogram = initial;
