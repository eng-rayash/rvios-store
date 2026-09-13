import Image from 'next/image';
import type { Sector } from '@/lib/sectors';

/**
 * لوح القطاع — صورة إن وُجدت، وإلا أيقونته الخطّية.
 *
 * الاحتياط ليس ترفاً: القائمة تسبق الصور أحياناً (قطاع يُضاف
 * اليوم وصورته تصل بعد أسبوع)، وبلا هذا اللوح تُترك بطاقةٌ
 * بمربّع مكسور في صفحةٍ كل غرضها إقناع تاجر متردّد. ووضع الملف
 * في `/assets/img/sectors/` يُبدّل العرض تلقائياً بلا لمس كود.
 *
 * والصور قصاصات شفافة تُعرض بـ`object-contain` على لوح ملوّن،
 * لا صور ممتلئة تُقصّ بـ`cover` — القصّ يبتر الموضوع نفسه.
 */
export function SectorPlate({
  sector,
  size,
  pad = '9%',
}: {
  sector: Sector;
  /** الضلع بالبكسل — للتصيير لا للتنسيق */
  size: number;
  /** حشوة داخل اللوح، فلا يلامس الموضوعُ الحافّة */
  pad?: string;
}) {
  const shell = 'aspect-square w-full transition-transform duration-500 group-hover:scale-105';

  if (!sector.img) {
    return (
      <div className={`${shell} grid place-items-center text-soft`} style={{ padding: pad }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} className="size-3/5">
          <path d={sector.icon} />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={`/assets/img/sectors/${sector.img}`}
      alt={sector.name}
      width={size}
      height={size}
      loading="lazy"
      className={`${shell} object-contain`}
      style={{ padding: pad }}
    />
  );
}
