'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * شريط العناوين.
 *
 * يبدأ شفافاً فوق الهيرو الداكن ثم يتكثّف عند التمرير: الزائر
 * لا يحتاج إطاراً يفصله عن الصورة في أول شاشة، ويحتاجه بعدها
 * ليقرأ الروابط فوق محتوى فاتح متغيّر. الانتقال يحدث مرة واحدة
 * عند عتبة واضحة لا تدريجياً، فلا يومض الشريط مع كل حركة.
 */
const LINKS = [
  { href: '/#steps', id: 'steps', label: 'كيف يعمل' },
  { href: '/#features', id: 'features', label: 'المزايا' },
  { href: '/#sectors', id: 'sectors', label: 'القطاعات' },
  { href: '/#pricing', id: 'pricing', label: 'الباقات' },
  { href: '/#faq', id: 'faq', label: 'أسئلة' },
];

/** وجهات مستقلة لا أقسام في الصفحة — تظهر في قائمة الجوّال والتذييل */
const DEEP = [
  { href: '/pricing', label: 'تفاصيل الباقات' },
  { href: '/sectors', label: 'تفاصيل القطاعات' },
  { href: '/about', label: 'عن المنصة' },
  { href: '/contact', label: 'تواصل معنا' },
];

export function Header() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  /**
   * تتبّع القسم الحالي.
   *
   * الصفحة صارت هبوطاً واحداً طويلاً، وشريط روابط لا يقول أين
   * أنت يترك الزائر بلا إحساس بموضعه بعد التمرير الثالث.
   * المراقب يرصد الشريط الأوسط من الشاشة وحده، فلا يتأرجح
   * التمييز بين قسمين متجاورين عند حافة كل منهما.
   *
   * ولا يوجد شيء ليُتتبَّع في الصفحات الأخرى — المراقب لا يجد
   * أياً من المرابط فيبقى صامتاً بلا حالة خاطئة.
   */
  useEffect(() => {
    const seen = new Map<string, number>();
    const nodes = LINKS
      .map((l) => document.getElementById(l.id))
      .filter((n): n is HTMLElement => n !== null);

    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        const [top] = [...seen.entries()]
          .filter(([, r]) => r > 0)
          .sort((a, b) => b[1] - a[1]);
        setAt(top ? top[0] : null);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01] },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  // القائمة المفتوحة تمنع تمرير الصفحة خلفها
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,padding] duration-300',
        stuck
          ? 'border-b border-line bg-cream/90 py-2.5 backdrop-blur-xl'
          : 'border-b border-transparent py-4',
      )}
    >
      <div className="wrap flex items-center gap-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <Image
            src="/assets/img/logo.png"
            alt="RVIOS"
            width={38}
            height={25}
            className="w-[38px] transition-transform duration-500 group-hover:scale-105"
            priority
          />
          <span className={cn('grid leading-none', stuck ? 'text-ink' : 'text-cream')}>
            <b className="font-en text-xl font-bold">RVIOS</b>
            <i className="font-en text-[8.5px] font-bold tracking-[.32em] not-italic opacity-60">S T O R E</i>
          </span>
        </Link>

        <nav className="mx-auto hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => {
            const on = at === l.id;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'relative py-1 text-sm font-bold transition-colors',
                  'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-right',
                  'after:bg-current after:transition-transform after:duration-300',
                  on ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
                  stuck
                    ? on ? 'text-ink' : 'text-ink/75 hover:text-ink'
                    : on ? 'text-cream' : 'text-cream/75 hover:text-cream',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className={cn(
              'rounded-pill px-4 py-2 text-sm font-bold transition-colors',
              stuck ? 'text-ink/75 hover:text-ink' : 'text-cream/75 hover:text-cream',
            )}
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/onboarding"
            className={cn(
              'group inline-flex items-center gap-2 rounded-pill px-5 py-2.5 text-sm font-bold',
              'transition-transform duration-200 hover:-translate-y-0.5',
              stuck ? 'bg-ink text-cream' : 'bg-cream text-ink',
            )}
          >
            ابدأ مجاناً
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
          className={cn('ms-auto grid size-10 place-items-center rounded-full lg:hidden',
            stuck ? 'text-ink' : 'text-cream')}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-x-0 top-full border-b border-line bg-cream shadow-soft lg:hidden"
          >
            <nav className="wrap grid gap-1 py-4">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={at === l.id ? 'true' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-3 text-md font-bold transition-colors hover:bg-sand',
                    at === l.id ? 'bg-sand text-shop-text' : 'text-ink',
                  )}
                >
                  {l.label}
                </Link>
              ))}

              {/* الصفحات المتعمّقة: خارج المرابط لأنها وجهات لا أقسام */}
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-3 pt-3">
                {DEEP.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="inline-block py-1 text-sm font-bold text-soft transition-colors hover:text-shop-text"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>

              <div className="mt-2 grid gap-2 border-t border-line pt-4">
                <Link href="/login" onClick={() => setOpen(false)}
                      className="rounded-pill border border-line px-5 py-3 text-center text-sm font-bold">
                  تسجيل الدخول
                </Link>
                <Link href="/onboarding" onClick={() => setOpen(false)}
                      className="rounded-pill bg-ink px-5 py-3 text-center text-sm font-bold text-cream">
                  ابدأ مجاناً
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
