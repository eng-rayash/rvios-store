'use client';

import * as React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * كاروسيل Embla — بنية shadcn نفسها، معرَّبةً.
 *
 * فرقان عن النسخة الأصلية، وكلاهما بسبب أن الواجهة تُقرأ من
 * اليمين:
 *
 *   · الاتجاه يُقرأ من `dir` على الجذر لا يُفترض `ltr`. لو تُرك
 *     الافتراض لبدأ الشريط من طرفه الخطأ وانزلق عكس القراءة —
 *     وهو عيب لا يظهر في أي فحص آلي، يراه الزائر العربي وحده.
 *   · الحوافّ منطقية (`ms`/`ps`) لا يمين ويسار، فالفجوة بين
 *     الشرائح تقع في الجهة الصحيحة في الاتجاهين.
 *
 * وزرّا التقديم والتأخير من عناصر `button` عادية بألوان المنصة —
 * لا نستورد `Button` من shadcn ومعه Radix Slot لأجل سهمين.
 */

export type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  rtl: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

export function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error('useCarousel لا يُستدعى إلا داخل <Carousel />');
  return context;
}

/**
 * الاتجاه يُؤخذ من المستند نفسه.
 *
 * على الخادم لا مستند، فنعود إلى `rtl` لأنها لغة الموقع. والقيمة
 * لا تدخل في المُخرَج المرسوم — إنما في خيارات Embla التي تُقرأ
 * بعد الترطيب — فلا يقع تباين بين تصيير الخادم والمتصفح.
 */
function documentDirection(): 'rtl' | 'ltr' {
  if (typeof document === 'undefined') return 'rtl';
  return document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl';
}

export function Carousel({
  orientation = 'horizontal',
  opts,
  setApi,
  plugins,
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<'div'> & CarouselProps) {
  const direction = opts?.direction ?? documentDirection();
  const rtl = direction === 'rtl';

  const [carouselRef, api] = useEmblaCarousel(
    { ...opts, axis: orientation === 'horizontal' ? 'x' : 'y', direction },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return;
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

  /**
   * السهمان يتبعان القراءة لا الشاشة: في العربية «التالي» على
   * اليسار، فسهم اليسار يقدّم لا يؤخّر. عكسُ ذلك يجعل لوحة
   * المفاتيح تعمل بالمقلوب عند من يقرأ من اليمين.
   */
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === forward) {
        event.preventDefault();
        scrollNext();
      } else if (event.key === back) {
        event.preventDefault();
        scrollPrev();
      }
    },
    [rtl, scrollPrev, scrollNext],
  );

  React.useEffect(() => {
    if (api && setApi) setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) return;
    onSelect(api);
    api.on('reInit', onSelect);
    api.on('select', onSelect);
    return () => {
      api.off('reInit', onSelect);
      api.off('select', onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        opts,
        rtl,
        orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        ref={ref}
        onKeyDownCapture={handleKeyDown}
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({ className, ref, ...props }: React.ComponentProps<'div'>) {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          'flex',
          orientation === 'horizontal' ? '-ms-4' : '-mt-4 flex-col',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CarouselItem({ className, ref, ...props }: React.ComponentProps<'div'>) {
  const { orientation } = useCarousel();

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        'min-w-0 shrink-0 grow-0 basis-full',
        orientation === 'horizontal' ? 'ps-4' : 'pt-4',
        className,
      )}
      {...props}
    />
  );
}

const arrowBase =
  'absolute grid size-9 place-items-center rounded-full border border-line bg-cream text-ink '
  + 'shadow-soft transition-opacity hover:bg-sand disabled:pointer-events-none disabled:opacity-40';

export function CarouselPrevious({ className, ref, ...props }: React.ComponentProps<'button'>) {
  const { orientation, rtl, scrollPrev, canScrollPrev } = useCarousel();
  const Icon = rtl ? ChevronRight : ChevronLeft;

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        arrowBase,
        orientation === 'horizontal'
          ? 'top-1/2 -translate-y-1/2 -start-12'
          : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">السابق</span>
    </button>
  );
}

export function CarouselNext({ className, ref, ...props }: React.ComponentProps<'button'>) {
  const { orientation, rtl, scrollNext, canScrollNext } = useCarousel();
  const Icon = rtl ? ChevronLeft : ChevronRight;

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        arrowBase,
        orientation === 'horizontal'
          ? 'top-1/2 -translate-y-1/2 -end-12'
          : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">التالي</span>
    </button>
  );
}
