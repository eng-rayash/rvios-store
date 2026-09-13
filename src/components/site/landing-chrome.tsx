'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * زينة صفحة الهبوط: شريط التقدّم وشريط الدعوة السفلي.
 *
 * مجموعان في مكوّن واحد عمداً — كلاهما يقرأ موضع التمرير،
 * وفصلهما يعني مستمعَين ينفّذان الحساب نفسه في كل إطار. هنا
 * مستمع واحد سلبي (passive) يُقيَّد بإطار العرض عبر
 * requestAnimationFrame، فلا يتحوّل التمرير إلى عمل متواصل
 * على الخيط الرئيسي في جهاز متوسط.
 */
export function LandingChrome() {
  const [progress, setProgress] = useState(0);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const y = window.scrollY;

      setProgress(max > 0 ? Math.min(y / max, 1) : 0);

      /**
       * الشريط السفلي يظهر بعد المشهد الأول وينزوي قبل الختام:
       * دعوةٌ ثابتة فوق قسمٍ دعوتُه هي نفسها تكرارٌ يزاحم الزرّ
       * الحقيقي بدل أن يساعده.
       */
      setShowCta(y > window.innerHeight * 0.9 && y < max - 700);
    };

    const onScroll = () => { frame ||= requestAnimationFrame(read); };

    read();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {/* شريط التقدّم — فوق الشريط العلوي، بلا ارتفاع يزيح المحتوى */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-60 h-[3px] bg-transparent">
        <div
          className="h-full origin-right bg-gradient-to-l from-shop to-brass transition-[transform] duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* دعوة سفلية على الجوّال — حيث لا يظهر زرّ الشريط العلوي */}
      <div
        aria-hidden={!showCta}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 border-t border-line bg-cream/95 backdrop-blur-xl lg:hidden',
          'pb-[env(safe-area-inset-bottom)] transition-[transform,opacity] duration-300',
          showCta ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
        )}
      >
        <div className="wrap flex items-center gap-4 py-3">
          <span className="grid flex-1 leading-tight">
            <b className="text-sm font-bold">ابدأ متجرك اليوم</b>
            <i className="text-2xs not-italic text-soft">مجاناً · بلا بطاقة بنكية</i>
          </span>
          <Link
            href="/onboarding"
            tabIndex={showCta ? undefined : -1}
            aria-hidden={!showCta}
            className="inline-flex shrink-0 items-center gap-2 rounded-pill bg-ink px-6 py-3
                       text-sm font-bold text-cream active:scale-[.98]"
          >
            ابدأ مجاناً
            <ArrowLeft aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
