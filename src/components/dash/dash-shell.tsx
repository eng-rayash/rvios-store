'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft, Check, ChevronsUpDown, Copy, Ellipsis, ExternalLink, LogOut, Plus, RotateCw,
} from 'lucide-react';
import { accentOn, paletteStyle } from '@/lib/theme';
import { ar, cn, initial, plural } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useDash, type Me, type Plan, type Store, type StoreLite } from '@/components/dash/dash-context';
import { ALL, NAV, PRIMARY, isActive, titleOf, type NavItem } from '@/components/dash/nav';

/**
 * قشرة اللوحة: شريطٌ جانبي على المكتب، وشريطٌ سفلي على الهاتف.
 *
 * ★ لماذا ليست الشريط الجانبي نفسه منزلقاً على الهاتف؟
 * كانت اللوحة القديمة تُخفي الشريط خلف زرّ ☰ في أعلى الشاشة —
 * أبعد نقطة عن الإبهام. تاجرٌ يمسك هاتفه بيد واحدة ويردّ على
 * عميل بالأخرى يحتاج أن يصل إلى «الطلبات» بإبهامه لا أن يمدّ
 * يده إلى الزاوية. فعلى الهاتف تخطيطٌ آخر بقرارٍ آخر، لا نسخة
 * المكتب مطويّة — وهذا البند السابع حرفياً.
 *
 * ★ ولون المتجر يُحقن على الجذر بـ`accentOn` لا بلوحته كاملة:
 * اللوحة هويّة RVIOS، ولون التاجر نبرةٌ فيها (الرابط المُختار،
 * تاج اللوح، الزرّ الرئيسي) — لا صبغةٌ تبتلع أسطحها. وهو نصّ
 * تعليق `dash.css` الأصلي: «تبقى اللوحة على هوية RVIOS».
 */
export function DashShell({ children }: { children: ReactNode }) {
  const { session, overview, retry } = useDash();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const [picker, setPicker] = useState(false);

  /* التنقّل يُغلق «المزيد» — وإلا بقي الدرج فوق الشاشة الجديدة */
  useEffect(() => { setMore(false); setPicker(false); }, [pathname]);

  const ready = session.phase === 'ready' ? session : null;
  const pending = overview.data?.kpis.pending ?? 0;

  return (
    <div
      style={ready ? paletteStyle(accentOn(ready.store)) : undefined}
      className="min-h-dvh bg-cream lg:grid lg:grid-cols-[264px_minmax(0,1fr)]"
    >
      <a
        href="#main"
        className="sr-only z-[var(--z-toast)] rounded-sm bg-ink px-base py-snug text-sm font-bold text-cream focus:not-sr-only focus:fixed focus:top-3 focus:start-3"
      >
        تخطَّ إلى المحتوى
      </a>

      {/* ═══ الشريط الجانبي — المكتب ═══ */}
      <aside
        aria-label="القائمة الرئيسية"
        className="grain sticky top-0 hidden h-dvh flex-col overflow-hidden bg-ink text-cream lg:flex"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_30%_0%,rgba(200,164,93,.10),transparent_60%)]"
        />
        <div className="relative z-1 flex h-full flex-col">
          <Brand className="px-roomy pt-roomy" />

          <div className="px-base pt-roomy">
            {ready
              ? <StorePlaque store={ready.store} plan={ready.plan} me={ready.me} onPick={() => setPicker(true)} />
              : <Skeleton className="h-[86px] rounded-lg bg-cream/10" />}
          </div>

          <nav aria-label="أقسام اللوحة" className="hairline mt-roomy flex-1 overflow-y-auto px-snug pt-snug pb-base">
            {NAV.map((g) => (
              <div key={g.group}>
                <p className="px-snug pt-base pb-1.5 text-2xs font-bold tracking-[2px] text-cream/55">{g.group}</p>
                <ul className="space-y-0.5">
                  {g.items.map((item) => (
                    <li key={item.href}>
                      <SideLink item={item} active={isActive(pathname, item)} count={item.badge ? pending : 0} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="hairline px-roomy py-base text-xs">
            {ready && (
              <p className="flex items-center justify-between gap-snug text-cream/65">
                باقة {ready.plan.name}
                <Link href="/dashboard/plan" className="font-bold text-brass hover:underline">ترقية ←</Link>
              </p>
            )}
            <LogoutButton className="mt-snug text-cream/65 hover:text-cream" />
          </div>
        </div>
      </aside>

      {/* ═══ المحتوى ═══ */}
      <div className="flex min-w-0 flex-col">
        <Topbar title={titleOf(pathname)} store={ready?.store ?? null} />

        <main id="main" tabIndex={-1} className="flex-1 px-base pt-roomy pb-28 focus:outline-none sm:px-roomy lg:px-airy lg:pb-airy">
          {session.phase === 'ready' && children}
          {session.phase === 'loading' && <ScreenSkeleton />}
          {session.phase === 'error' && (
            <EmptyState
              icon={<RotateCw className="size-6" aria-hidden />}
              title="تعذّر فتح اللوحة"
              action={<Button tone="line" onClick={retry}>حاول مجدداً</Button>}
            >
              {session.message}
            </EmptyState>
          )}
        </main>
      </div>

      {/* ═══ الشريط السفلي — الهاتف ═══ */}
      <nav
        aria-label="التنقّل"
        className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {ALL.filter((i) => PRIMARY.includes(i.href)).map((item) => (
            <li key={item.href}>
              <TabLink item={item} active={isActive(pathname, item)} count={item.badge ? pending : 0} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              aria-expanded={more}
              className="flex w-full flex-col items-center gap-0.5 pt-2.5 pb-2 text-2xs text-soft"
            >
              <Ellipsis className="size-5" aria-hidden />
              المزيد
            </button>
          </li>
        </ul>
      </nav>

      {/* «المزيد» — كل ما ليس تحت الإبهام */}
      <Sheet open={more} onClose={() => setMore(false)} title="القائمة">
        {ready && (
          <div className="pt-4 pb-base">
            <StorePlaque store={ready.store} plan={ready.plan} me={ready.me} onPick={() => { setMore(false); setPicker(true); }} />
          </div>
        )}
        {NAV.map((g) => {
          const rest = g.items.filter((i) => !PRIMARY.includes(i.href));
          if (!rest.length) return null;
          return (
            <div key={g.group} className="mt-base">
              <p className="pb-1.5 text-2xs font-bold tracking-[2px] text-soft">{g.group}</p>
              <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
                {rest.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn('flex items-center gap-snug px-base py-3.5 text-sm', active && 'font-bold text-shop-text')}
                      >
                        <Icon className="size-4.5 shrink-0 text-soft" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        <ArrowLeft className="size-4 text-line-strong" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <LogoutButton className="mt-roomy text-soft hover:text-ink" />
      </Sheet>

      {/* منتقي المتاجر */}
      {ready && (
        <Sheet open={picker} onClose={() => setPicker(false)} title="متاجرك" side="center">
          <StoreList me={ready.me} current={ready.store} />
        </Sheet>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- شعار ثابت صغير */}
      <img src="/assets/img/logo.png" alt="" width={34} height={22} className="w-[34px]" />
      <span>
        <b className="block font-en text-xl leading-none">RVIOS</b>
        <i className="mt-0.5 block text-2xs not-italic tracking-[3px] text-cream/55">S T O R E</i>
      </span>
    </Link>
  );
}

/**
 * لوحة المتجر المعلّقة في رأس الشريط.
 *
 * ★ هنا يصير العنصر التوقيعي هويّةَ اللوحة لا زينتها.
 * كانت اللوحة القديمة تضع اسم المتجر في «أفاتار» صغير بالشريط
 * العلوي — كأي لوحة SaaS تعرض اسم المستخدم. والتاجر هنا ليس
 * «مستخدماً» بل صاحب محلّ، ولوحته معلّقة فوق كل ما يديره: بتاجٍ
 * بلونه، وقضيبٍ نحاسي، واسمه ورابطه. وهذا بالضبط ما يفرّق
 * «تحريري/بوتيك» عن «النمط المؤسسي البارد» الذي تعلن الوثيقة
 * أنها تُميّز المنصة عنه.
 */
function StorePlaque({
  store, plan, me, onPick,
}: { store: Store; plan: Plan; me: Me; onPick: () => void }) {
  const switchable = me.stores.length > 1 || me.slots.free > 0;

  const body = (
    <>
      <StoreAvatar name={store.name} logo={store.logo} />
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-bold">{store.name}</span>
        <span dir="ltr" className="block truncate text-start text-2xs text-soft">
          rviosstore.com/<b className="font-bold text-shop-text">{store.slug}</b>
        </span>
      </span>
      {switchable
        ? <ChevronsUpDown className="size-4 shrink-0 text-soft" aria-hidden />
        : <span className="shrink-0 rounded-pill bg-brass/15 px-2 py-0.5 text-2xs font-bold text-brass-deep">{plan.name}</span>}
    </>
  );

  return (
    <div className="pt-3.5">
      {switchable ? (
        <Plaque
          as="button"
          type="button"
          crest
          rail
          lift
          onClick={onPick}
          aria-haspopup="dialog"
          aria-label={`${store.name} — بدّل المتجر`}
          className="flex w-full items-center gap-snug px-snug pt-3.5 pb-3"
        >
          {body}
        </Plaque>
      ) : (
        <Plaque crest rail className="flex items-center gap-snug px-snug pt-3.5 pb-3">{body}</Plaque>
      )}
    </div>
  );
}

function StoreAvatar({ name, logo, color, className }: {
  name: string; logo: string | null; color?: string; className?: string;
}) {
  return logo ? (
    /* eslint-disable-next-line @next/next/no-img-element -- صورة التاجر؛ مضغوطة عند الرفع */
    <img src={logo} alt="" className={cn('size-10 shrink-0 rounded-full bg-sand object-cover', className)} />
  ) : (
    <span
      aria-hidden
      style={color ? { background: color } : undefined}
      className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-shop font-display text-lg text-on-shop', className)}
    >
      {initial(name)}
    </span>
  );
}

function SideLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-snug rounded-sm px-snug py-2.5 text-sm transition-colors',
        active ? 'bg-cream/[.08] font-bold text-cream' : 'text-cream/75 hover:bg-cream/[.05] hover:text-cream',
      )}
    >
      {/* ★ المختار شعرةٌ نحاسية لا كتلةٌ بلون المتجر.
          كان الرابط المُختار `background:var(--shop)` كاملاً — كتلة
          حمراء على حبرٍ داكن تسحب العين من المحتوى إلى القائمة.
          والشعرة تقول «أنت هنا» بصوتٍ منخفض، بخامة التعليق نفسها. */}
      {active && <span aria-hidden className="absolute inset-y-2 start-0 w-[2px] rounded-full bg-brass" />}
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-pill bg-brass px-1.5 text-2xs font-extrabold tabular text-ink">
          {ar(count)}<span className="sr-only">{` ${plural(count, ['طلب معلّق', 'طلبان معلّقان', 'طلبات معلّقة', 'طلباً معلّقاً'])}`}</span>
        </span>
      )}
    </Link>
  );
}

function TabLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-2xs transition-colors',
        active ? 'font-bold text-shop-text' : 'text-soft',
      )}
    >
      {active && <span aria-hidden className="absolute top-0 h-[2px] w-6 rounded-full bg-shop" />}
      <span className="relative">
        <Icon className="size-5" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-1.5 -end-2 grid h-4 min-w-4 place-items-center rounded-pill bg-shop px-1 text-[10px] font-extrabold tabular text-on-shop">
            {ar(count)}<span className="sr-only"> معلّقة</span>
          </span>
        )}
      </span>
      {item.label}
    </Link>
  );
}

/**
 * الشريط العلوي: عنوان الشاشة ورابط المتجر.
 *
 * ★ زرّ النسخ يُعلن نجاحه بـ`aria-live` لا بإشعارٍ عائم.
 * الإشعار العائم يظهر في زاوية الشاشة بعيداً عن الزرّ، ويختفي
 * قبل أن يُقرأ على هاتف بطيء. والتأكيد في مكان الضغط نفسه
 * (أيقونة ✓ تحلّ محلّ أيقونة النسخ) يُرى حيث تنظر العين.
 */
function Topbar({ title, store }: { title: string; store: Store | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${store.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* الحافظة محجوبة — الرابط ظاهرٌ بجوار الزرّ على أي حال */ }
  }

  return (
    <header className="sticky top-0 z-[var(--z-header)] flex items-center gap-snug border-b border-line bg-cream/90 px-base py-3 backdrop-blur-md sm:px-roomy lg:px-airy">
      <h1 className="font-heading min-w-0 flex-1 truncate text-title leading-tight font-semibold">{title}</h1>

      {store && (
        <>
          <a
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener"
            dir="ltr"
            className="hidden items-center gap-1.5 rounded-pill border border-line bg-paper px-3.5 py-1.5 text-xs text-soft transition-colors hover:border-shop md:flex"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            rviosstore.com/<b className="font-bold text-shop-text">{store.slug}</b>
            <span className="sr-only">(يُفتح في نافذة جديدة)</span>
          </a>
          <a
            href={`/${store.slug}`}
            target="_blank"
            rel="noopener"
            aria-label="افتح متجرك في نافذة جديدة"
            className="grid size-9 place-items-center rounded-sm border border-line bg-paper text-soft md:hidden"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'نُسخ الرابط' : 'انسخ رابط المتجر'}
            className="grid size-9 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-ink hover:text-ink"
          >
            {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
          <span aria-live="polite" className="sr-only">{copied ? 'نُسخ رابط المتجر' : ''}</span>
        </>
      )}
    </header>
  );
}

function StoreList({ me, current }: { me: Me; current: Store }) {
  const { switchStore } = useDash();
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(s: StoreLite) {
    if (s.slug === current.slug) return;
    setBusy(s.slug);
    try { await switchStore(s.slug); } catch { setBusy(null); }
  }

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
        {me.stores.map((s) => {
          const on = s.slug === current.slug;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                disabled={busy !== null}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-snug px-base py-3 text-start transition-colors enabled:hover:bg-cream disabled:opacity-60',
                  on && 'bg-sand/60',
                )}
              >
                <StoreAvatar name={s.name} logo={s.logo} color={s.color} className="size-9 text-md" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', on && 'font-bold')}>{s.name}</span>
                  <span dir="ltr" className="block truncate text-start text-2xs text-soft">rviosstore.com/{s.slug}</span>
                </span>
                {busy === s.slug
                  ? <RotateCw className="size-4 animate-spin text-soft" aria-hidden />
                  : on && <Check className="size-4 text-shop-text" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>

      {me.slots.free > 0 && (
        <a
          href="/onboarding?new=1"
          className="mt-base flex items-center gap-snug rounded-lg border-[1.5px] border-dashed border-line px-base py-3 text-sm font-bold text-shop-text transition-colors hover:border-shop"
        >
          <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-line">
            <Plus className="size-4" aria-hidden />
          </span>
          <span className="flex-1">
            أضف متجراً
            <small className="block text-2xs font-normal text-soft">
              لديك {ar(me.slots.free)} {plural(me.slots.free, ['خانة شاغرة', 'خانتان شاغرتان', 'خانات شاغرة', 'خانةً شاغرة'])}
            </small>
          </span>
        </a>
      )}
    </>
  );
}

function LogoutButton({ className }: { className?: string }) {
  const { logout } = useDash();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { setBusy(true); void logout(); }}
      disabled={busy}
      className={cn('flex items-center gap-1.5 text-xs transition-colors disabled:opacity-60', className)}
    >
      <LogOut className="size-3.5" aria-hidden />
      تسجيل الخروج
    </button>
  );
}

/** هيكل الشاشة أثناء الإقلاع — شكل النظرة العامة، لا دوّارٌ في الوسط */
function ScreenSkeleton() {
  return (
    <div className="space-y-base" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="grid grid-cols-2 gap-base lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={cn('h-[92px] rounded-lg', (i === 0 || i === 3) && 'col-span-2 lg:col-span-1')} />
        ))}
      </div>
      <div className="grid gap-base lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </div>
  );
}
