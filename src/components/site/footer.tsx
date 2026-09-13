import Link from 'next/link';
import Image from 'next/image';

const COLUMNS = [
  {
    title: 'المنصة',
    links: [
      { href: '/#steps', label: 'كيف يعمل' },
      { href: '/#features', label: 'المزايا' },
      { href: '/#sectors', label: 'القطاعات' },
      { href: '/#pricing', label: 'الباقات' },
      { href: '/#compare', label: 'مقارنة الباقات' },
      { href: '/#faq', label: 'أسئلة شائعة' },
    ],
  },
  {
    title: 'الدعم',
    links: [
      { href: '/contact', label: 'تواصل معنا' },
      { href: '/contact', label: 'أنشئوا متجري' },
      { href: '/about', label: 'عن المنصة' },
      { href: '/sectors', label: 'القطاعات' },
      { href: '/track', label: 'تتبّع طلب' },
      { href: '/login', label: 'تسجيل الدخول' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { href: '/legal#terms', label: 'الشروط والأحكام' },
      { href: '/legal#privacy', label: 'سياسة الخصوصية' },
    ],
  },
];

export function Footer() {
  return (
    /* الشعرة النحاسية على الحافّة العليا هي نفسها التي تفصل
       شريط الطمأنة عن مشهد الهيرو: حيث ينتهي سطحٌ فاتح ويبدأ
       داكن، يلتقط الطرف ضوءاً. حدٌّ رماديّ يقول «انتهى القسم»،
       والشعرة تقول «هنا حافّة مادّة». */
    <footer className="hairline isolate overflow-hidden bg-ink text-cream">
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 [--grain:.13]" />
      <div className="wrap grid gap-10 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <Image src="/assets/img/logo.png" alt="RVIOS" width={38} height={25} className="w-[38px]" />
            <span className="grid leading-none">
              <b className="font-en text-xl font-bold">RVIOS</b>
              <i className="font-en text-[8.5px] font-bold tracking-[.32em] not-italic opacity-60">S T O R E</i>
            </span>
          </div>
          <p className="text-sm leading-loose text-cream/60 text-pretty">
            منصة متاجر إلكترونية من عائلة RVIOS، تتيح لأي تاجر بناء متجره الخاص
            ومشاركة رابطه مع عملائه — بدأت من اليمن، وتعمل اليوم في تسع دول
            بعملاتها وأرقام جوّالاتها.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-xs font-extrabold tracking-[.16em] text-brass">{col.title}</h4>
            {/* ★ `inline-block py-1` يرفع ارتفاع الهدف من ١٨ إلى ٢٦
                بكسل — فوق حدّ WCAG 2.5.8 (٢٤×٢٤). والفجوة نزلت من
                ١٠ إلى ٢ كي تبقى مسافة السطر ٢٨ بكسل كما كانت:
                الهدف كبُر والإيقاع البصري لم يتغيّر. */}
            <ul className="grid gap-0.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="inline-block py-1 text-sm text-cream/65 transition-colors hover:text-cream">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-cream/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-6 text-2xs text-cream/50">
          <span>© ٢٠٢٦ RVIOS Store. جميع الحقوق محفوظة.</span>
          <span>صُنع في اليمن</span>
        </div>
      </div>
    </footer>
  );
}
